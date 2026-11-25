#!/usr/bin/env node
'use strict';

/**
 * Unsupported-negative check (deterministic, zero-LLM).
 *
 * Companion to skills/verification/complete-retrieval.md. Scores a recorded
 * agent run 0 when the final answer asserts that nothing matched while one of
 * the run's own tool results admitted it had not seen everything, and 1
 * otherwise.
 *
 * Why a separate check: a confident false negative passes every check shaped
 * around what an agent emitted or whether a call errored. A list call that
 * returns 25 of 118 rows is a successful call, the answer contains no secret,
 * and the tool-call count is normal, so "there are none" scores perfectly
 * everywhere else. Only the pairing of an incomplete result with an absence
 * claim exposes it.
 *
 * Detect-and-alert, not enforcement: a false positive costs one warning line,
 * never a blocked answer. The real fix is a tool that reads every page in code
 * and reports `complete` (see the skill); this check catches the cases where
 * that sweep could not finish, and runs where no such tool exists yet.
 *
 * Usage:
 *   node scripts/unsupported-negative-check.js run.json [--locale en[,xx]]
 *
 * run.json: { "toolResults": [ <any JSON> ... ], "answer": "<final text>" }
 * Prints the result as JSON. Exit 0 when the score is 1, 1 when it is 0,
 * 2 on a usage or input error.
 */

const fs = require('fs');

/**
 * Phrases that assert absence, per locale. Deliberately narrow: each has to be
 * a claim that nothing matched, not merely a negative word. "I could not read
 * the whole list" must NOT match, because that is the honest answer this check
 * exists to encourage; neither must "the order has no tracking number".
 *
 * Extension point: an agent that answers in more than one language needs a
 * list for each, or the guard is silently half-off. Add a locale here, or pass
 * `patterns` to checkUnsupportedNegative() from the caller.
 */
const DENIAL_PATTERNS = {
    en: [
        /\bthere (?:are|were|is|was) no\b(?! way\b| guarantee\b)/i,
        /\b(?:none|nothing) (?:matches|matched|exists|existed|is|was|were|are)\b/i,
        /\bno (?:matching|upcoming|such|existing)\b/i,
        /\bno (?:results|records|entries|items|matches)\b/i,
        /\bno\s+\w+(?:\s+\w+)?\s+(?:are|were|is|was|exists?)\b/i,
        /\b(?:is|are|was|were) not (?:found|scheduled|listed|available)\b/i,
        /\b(?:does|do|did)(?:n't| not) exist\b/i,
        /\b(?:did|could)(?:n't| not) find any\b/i
    ]
};

/**
 * Markers a tool result uses to admit it did not return everything. The first
 * is the shape the skill asks a sweeping tool to return; the rest are common
 * pagination envelopes. A cursor counts only when it is a non-empty string,
 * because several APIs send an empty cursor on the last page.
 */
const nonEmptyString = (value) => typeof value === 'string' && value.length > 0;
const INCOMPLETE_MARKERS = [
    ['complete', (value) => value === false],
    ['hasMore', (value) => value === true],
    ['has_more', (value) => value === true],
    ['truncated', (value) => value === true],
    ['incomplete_results', (value) => value === true],
    ['nextPageToken', nonEmptyString],
    ['next_cursor', nonEmptyString],
    ['nextCursor', nonEmptyString]
];

/**
 * How deep to look for a marker. A wrapper may nest the payload it was handed
 * and a tool may return an array of pages, so the marker is not always at the
 * top, but it is never far down either.
 */
const MAX_DEPTH = 4;

/**
 * True when a tool result, anywhere within MAX_DEPTH, admits it is incomplete.
 *
 * Breadth-first with a depth cap and a visited set rather than plain
 * recursion: the value comes from a tool, so its shape is not ours to assume.
 * A cycle would recurse forever and a deeply nested value would exhaust the
 * stack, and a check that can crash the scoring path is worse than one that
 * misses a marker. The trade, stated plainly: a marker buried deeper than
 * MAX_DEPTH is not found. That is the safe direction for an advisory signal.
 */
function isIncomplete(result, { markers = INCOMPLETE_MARKERS, maxDepth = MAX_DEPTH } = {}) {
    const seen = new Set();
    const queue = [{ value: result, depth: 0 }];

    while (queue.length > 0) {
        const { value, depth } = queue.shift();
        if (value === null || typeof value !== 'object') continue;
        if (seen.has(value)) continue;
        seen.add(value);

        for (const [key, test] of markers) {
            if (Object.prototype.hasOwnProperty.call(value, key) && test(value[key])) {
                return true;
            }
        }

        if (depth >= maxDepth) continue;
        for (const child of Object.values(value)) {
            queue.push({ value: child, depth: depth + 1 });
        }
    }

    return false;
}

function patternsFor(locales) {
    const patterns = [];
    for (const locale of locales) {
        const list = DENIAL_PATTERNS[locale];
        // An unknown locale is a configuration error, not a data condition:
        // a guard set up for a language it has no phrases for would quietly
        // never fire. Fail loudly at setup instead.
        if (!list) {
            throw new Error(`No denial phrases registered for locale '${locale}'. Add them to DENIAL_PATTERNS or pass patterns explicitly.`);
        }
        patterns.push(...list);
    }
    return patterns;
}

/**
 * Score one run.
 *
 * @param {object} run
 * @param {unknown[]} run.toolResults Every tool result the agent saw this run.
 * @param {string} run.answer The agent's final answer text.
 * @param {string[]} [run.locales] Phrase lists to apply, default ['en'].
 * @param {RegExp[]} [run.patterns] Extra caller-supplied denial phrases.
 * @returns {{ score: 0|1, incomplete: boolean, denial: string|null }}
 */
function checkUnsupportedNegative({ toolResults = [], answer = '', locales = ['en'], patterns = [] }) {
    const denialPatterns = [...patternsFor(locales), ...patterns];
    const incomplete = toolResults.some((result) => isIncomplete(result));
    if (!incomplete) {
        return { score: 1, incomplete: false, denial: null };
    }

    const text = String(answer);
    for (const pattern of denialPatterns) {
        const match = text.match(pattern);
        if (match) {
            return { score: 0, incomplete: true, denial: match[0] };
        }
    }
    return { score: 1, incomplete: true, denial: null };
}

function main(argv) {
    const args = argv.slice(2);
    const file = args.find((arg) => !arg.startsWith('--'));
    const localeIndex = args.indexOf('--locale');
    const locales = localeIndex >= 0 && args[localeIndex + 1]
        ? args[localeIndex + 1].split(',').map((locale) => locale.trim()).filter(Boolean)
        : ['en'];

    if (!file) {
        console.error('Usage: node scripts/unsupported-negative-check.js run.json [--locale en[,xx]]');
        return 2;
    }

    let run;
    try {
        run = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`Could not read ${file}: ${error.message}`);
        return 2;
    }
    if (!Array.isArray(run.toolResults) || typeof run.answer !== 'string') {
        console.error(`${file} must hold { "toolResults": [...], "answer": "..." }.`);
        return 2;
    }

    let result;
    try {
        result = checkUnsupportedNegative({ ...run, locales });
    } catch (error) {
        console.error(error.message);
        return 2;
    }
    console.log(JSON.stringify(result, null, 2));
    return result.score === 1 ? 0 : 1;
}

if (require.main === module) {
    process.exitCode = main(process.argv);
}

module.exports = {
    DENIAL_PATTERNS,
    INCOMPLETE_MARKERS,
    MAX_DEPTH,
    isIncomplete,
    checkUnsupportedNegative,
    main
};

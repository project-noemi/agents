'use strict';

/**
 * Untrusted text inside model prompts and forge comments.
 *
 * fenceData wraps issue, plan, and file text in a tag the prompt calls DATA.
 * A body that contains `</plan>` (any case, any spacing, any attributes)
 * would close the fence and put the rest of the body in instruction
 * position, so every opening or closing occurrence of ANY loop fence tag
 * inside the data has its `<` replaced with `&lt;`. The model still reads
 * the text; it can no longer end the fence.
 *
 * neutralizeForgeRefs keeps model- or issue-derived text from acting on the
 * forge when it is posted: `Closes #42` would close another issue on merge
 * and `@someone` would page a person. Both are wrapped in backticks, which
 * GitHub and Azure DevOps render as code and do not act on.
 */

const FENCE_TAGS = [
  'plan', 'issue', 'file', 'findings', 'change_set', 'answer', 'answers',
  'system', 'user', 'assistant', 'data',
];

const FENCE_TAG_RE = new RegExp(
  `<(?=\\s*/?\\s*(?:${FENCE_TAGS.join('|')})(?![\\w-]))`,
  'gi',
);

function neutralizeFenceTags(text) {
  return String(text == null ? '' : text).replace(FENCE_TAG_RE, '&lt;');
}

function fenceData(tag, text) {
  const name = String(tag);
  if (!FENCE_TAGS.includes(name)) {
    throw new Error(`fenceData: unknown fence tag ${name}`);
  }
  return [`<${name}>`, neutralizeFenceTags(text), `</${name}>`].join('\n');
}

// The reference after the keyword may be `#7`, `owner/repo#7`, a full issue
// or PR URL on any host (github.com or GHES: `https://host/o/r/issues/7`),
// or Azure Boards' `AB#123`, which GitHub links and closes the work item on.
const CLOSING_REF = [
  'https?:\\/\\/[A-Za-z0-9.-]+(?::\\d+)?(?:\\/[A-Za-z0-9_.-]+){2}\\/(?:issues|pull)\\/\\d+',
  'AB#\\d+',
  '(?:[A-Za-z0-9_.-]+\\/[A-Za-z0-9_.-]+)?#\\d+',
].join('|');
const CLOSING_KEYWORD_RE = new RegExp(
  `(?<!\\w)((?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\s*:?\\s+(?:${CLOSING_REF}))`,
  'gi',
);
// A mention starts after a non-word, non-path character, so an email
// (a@b.com) or a scoped package path (pkg/@scope) is left alone.
const MENTION_RE = /(?<![\w/.@-])(@[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})(?:\/[A-Za-z0-9_.-]+)?)(?![\w-])/g;

// Fenced blocks and inline code spans are already inert. Rewriting inside
// them would split the span and put the mention back in plain text.
const CODE_SPAN_RE = /((?<!\\)```[\s\S]*?```|(?<!\\)`[^`\n]*`)/;

function neutralizeForgeRefs(text) {
  return String(text == null ? '' : text)
    .split(CODE_SPAN_RE)
    // A backtick left in a plain part is unmatched. Escape it, or it would
    // pair with an inserted one and push the mention back out of code.
    .map((part, index) => (index % 2 === 1
      ? part
      : part.replace(/(?<!\\)`/g, '\\`')
        .replace(CLOSING_KEYWORD_RE, '`$1`')
        .replace(MENTION_RE, '`$1`')))
    .join('');
}

module.exports = {
  FENCE_TAGS,
  fenceData,
  neutralizeFenceTags,
  neutralizeForgeRefs,
};

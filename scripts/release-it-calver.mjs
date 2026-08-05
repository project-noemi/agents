// Calendar-date CalVer (YYYY.MM.DD) version provider for release-it.
//
// SCHEME
// ------
// The version is the UTC calendar DATE of the promotion that stamps it:
//
//     YYYY.MM.DD          e.g. 2026.08.04   (four-digit year . zero-padded
//                                             month . zero-padded day, no `v`)
//
// A version is minted PER CONTENT-BEARING PROMOTION (see
// docs/RELEASE_PROCESS.md and .github/workflows/release.yml), so more than one
// release can land on the same calendar day. When a tag for today's date
// already exists, the version is disambiguated with a numeric `.N` suffix,
// counting up from 1:
//
//     2026.08.04          first release of the day
//     2026.08.04.1        second release of the same day
//     2026.08.04.2        third, and so on
//
// This makes "how far behind am I?" readable straight off the tag: the gap
// between `2026.05.30` and `2026.08.04` is visibly ~two months, no lookup
// table required.
//
// WHY A PLUGIN AT ALL
// -------------------
// release-it is built around SemVer. Its stock increment logic runs every
// candidate version through `semver`, and a zero-padded calendar date is not
// valid SemVer: `semver.valid('2026.08.04')` is null because "08" has a leading
// zero. This is the failure captured in release-it#754 ("CalVer zero-padded
// format does not work"): the increment path yields a null version and aborts.
//
// A release-it plugin, however, may supply the version directly. By overriding
// `getIncrementedVersionCI` (used in --ci / non-interactive runs) we hand
// release-it the CalVer string outright and never enter the SemVer increment
// path. The @release-it/conventional-changelog plugin is kept ONLY to write the
// CHANGELOG and is configured with `ignoreRecommendedBump: true`, so it does
// not try to compute a competing SemVer bump — CalVer owns the version.
//
// Paired with `"npm": false` in .release-it.json, nothing ever writes the
// non-SemVer version into package.json (npm would reject it), so the tag, the
// GitHub Release, and the changelog header all carry a clean `YYYY.MM.DD`.
//
// This file is intentionally dependency-free beyond release-it itself (provided
// at run time by the release workflow) and Node's built-in child_process, which
// it uses only to read existing tags for same-day disambiguation.

import { Plugin } from 'release-it';
import { execSync } from 'node:child_process';

/** Today's date as CalVer `YYYY.MM.DD` in UTC, e.g. "2026.08.04". */
function calverDate(date = new Date()) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
}

/** Read the repository's existing tags. Returns [] if git is unavailable. */
function listExistingTags() {
    try {
        return execSync('git tag --list', { encoding: 'utf8' })
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
    } catch {
        // No git / no tags yet — treat as an empty tag set.
        return [];
    }
}

/**
 * Resolve the version for this promotion: today's `YYYY.MM.DD`, disambiguated
 * with `.N` when a tag for the same date already exists.
 *
 * @param {Date}     date - the promotion date (defaults to now).
 * @param {string[]} tags - existing tags (defaults to reading them from git).
 */
function nextCalVer(date = new Date(), tags = listExistingTags()) {
    const base = calverDate(date);
    if (!tags.includes(base)) {
        return base;
    }
    let n = 1;
    while (tags.includes(`${base}.${n}`)) {
        n += 1;
    }
    return `${base}.${n}`;
}

export default class CalVerPlugin extends Plugin {
    // Always participate: the version is date-derived, not commit-derived.
    static isEnabled() {
        return true;
    }

    // Non-interactive (--ci) path used by the release workflow.
    getIncrementedVersionCI() {
        return nextCalVer();
    }

    // Interactive path, for completeness when a human runs release-it locally.
    getIncrementedVersion() {
        return nextCalVer();
    }
}

export { calverDate, listExistingTags, nextCalVer };

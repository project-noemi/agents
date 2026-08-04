// CalVer (YYYY.0M) version provider for release-it.
//
// WHY THIS EXISTS
// ---------------
// release-it is built around SemVer. Its stock increment logic runs every
// candidate version through `semver`, and a zero-padded calendar month is not
// valid SemVer: `semver.valid('2026.08')` is null because "08" has a leading
// zero and the string has only two segments. This is the exact failure captured
// in release-it#754 ("CalVer zero-padded month format does not work"): the
// increment path yields a null version and the run aborts.
//
// A release-it plugin, however, may supply the version directly. By overriding
// `getIncrementedVersionCI` (used in --ci / non-interactive runs) we hand
// release-it the CalVer string outright and never enter the SemVer increment
// path. The @release-it/conventional-changelog plugin is kept ONLY to write the
// CHANGELOG and is configured with `ignoreRecommendedBump: true`, so it does not
// try to compute a competing SemVer bump — CalVer owns the version.
//
// Paired with `"npm": false` in .release-it.json, nothing ever writes the
// non-SemVer version into package.json (npm would reject it), so the tag, the
// GitHub Release, and the changelog header all carry a clean `YYYY.0M`.
//
// The scheme is documented in docs/RELEASE_PROCESS.md. This file is intentionally
// dependency-free beyond release-it itself, which is provided at run time by the
// release workflow (see .github/workflows/release.yml).

import { Plugin } from 'release-it';

/** Compute the current governance cycle as CalVer YYYY.0M (UTC), e.g. "2026.08". */
function currentCalVer(date = new Date()) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}.${month}`;
}

export default class CalVerPlugin extends Plugin {
    // Always participate: the version is date-derived, not commit-derived.
    static isEnabled() {
        return true;
    }

    // Non-interactive (--ci) path used by the release workflow.
    getIncrementedVersionCI() {
        return currentCalVer();
    }

    // Interactive path, for completeness when a human runs release-it locally.
    getIncrementedVersion() {
        return currentCalVer();
    }
}

export { currentCalVer };

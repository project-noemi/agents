/**
 * scripts/resilience_helpers.mjs
 *
 * ESM bridge for `scripts/resilience_helpers.js` (CommonJS).
 *
 * Lets ESM tools and tests import the retry helpers with named syntax:
 *
 *   import { withRetry, sleep } from '../../scripts/resilience_helpers.mjs';
 *
 * Resolves CLARIFICATIONS.md Q [2026-06-19] Resilience Helper Module System
 * Mismatch (resilience_helpers.js portion) and the ESM/CJS bullet in PR #236.
 * The underlying scope decision ([2026-04-04] and [2026-06-19-0004]) remains:
 * `resilience_helpers` is a reusable reference pattern, not a forced
 * dependency on deterministic local-FS tools.
 */

import resilience from './resilience_helpers.js';

export const withRetry = resilience.withRetry;
export const sleep = resilience.sleep;

export default resilience;

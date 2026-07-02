// ESM shim over scripts/resilience_helpers.js so ESM-native services
// (e.g., tools/executive-assistant/) can import { withRetry } without
// a wrapper. See Decision [2026-07-02] Resilience/Audit ESM Dual-Module Support.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const impl = require('./resilience_helpers.js');

export const withRetry = impl.withRetry;
export const sleep = impl.sleep;

export default impl;

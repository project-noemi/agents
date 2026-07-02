// ESM shim over scripts/audit_logger.js so ESM-native services
// (e.g., tools/executive-assistant/ with "type":"module") can import
// the shared JSON Audit Log emitter without a wrapper.
// See Decision [2026-07-02] Resilience/Audit ESM Dual-Module Support.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const impl = require('./audit_logger.js');

export const REQUIRED_FIELDS = impl.REQUIRED_FIELDS;
export const emit = impl.emit;
export const mapEvent = impl.mapEvent;
export const logEvent = impl.logEvent;
export const normalize = impl.normalize;

export default impl;

/**
 * scripts/audit_logger.mjs
 *
 * ESM bridge for `scripts/audit_logger.js` (CommonJS).
 *
 * Node.js ≥ 22 can `import` a CJS module and receive the `module.exports`
 * object as the default import; named imports work via the static-analysis
 * compatibility layer. This shim makes that contract explicit so ESM tools
 * (e.g. `tools/executive-assistant/`) can import named symbols directly:
 *
 *   import { emit, createLogger } from '../../scripts/audit_logger.mjs';
 *
 * Resolves CLARIFICATIONS.md Q [2026-06-19] Resilience Helper Module System
 * Mismatch (audit_logger.js portion) and the ESM/CJS bullet in PR #236.
 */

import auditLogger from './audit_logger.js';

export const emit = auditLogger.emit;
export const createLogger = auditLogger.createLogger;
export const normalize = auditLogger.normalize;
export const validate = auditLogger.validate;
export const REQUIRED_FIELDS = auditLogger.REQUIRED_FIELDS;

export default auditLogger;

#!/usr/bin/env node
/**
 * audit_logger.js — Shared structured Audit Log emitter for Node.js tools and reference services.
 *
 * Implements the canonical Audit Log schema mandated by AGENTS.md and REQUIREMENTS.md:
 *   { "task": "...", "inputs": [], "actions": [], "risks": [], "result": "..." }
 *
 * Emission contract:
 *   - One JSON object per event, written to stderr followed by a newline.
 *   - Logs are parseable JSON containing all five canonical fields; orchestrators
 *     that need to disambiguate technical crashes from structured audit logs rely
 *     on the shape, not a prefix or dedicated file descriptor (Decision [2026-06-25-0012]).
 *
 * Usage:
 *   const { emitAuditLog, fromInternalEvent } = require('./audit_logger');
 *
 *   emitAuditLog({
 *     task: 'sync-upstream',
 *     inputs: ['upstream/develop', 'upstream/main'],
 *     actions: ['fetched', 'merged'],
 *     risks: [],
 *     result: 'success'
 *   });
 *
 *   // Internal-event mapping helper for tool-specific events (e.g., SYNC_COMPLETE)
 *   const record = fromInternalEvent('SYNC_COMPLETE', {
 *     inputs: ['origin/main'],
 *     actions: ['pulled', 'rebased'],
 *     result: 'clean'
 *   });
 *   emitAuditLog(record);
 */

const REQUIRED_FIELDS = ['task', 'inputs', 'actions', 'risks', 'result'];

/**
 * Build a canonical Audit Log record, filling defaults for omitted fields so the
 * schema invariant (all five fields present) holds without forcing every caller
 * to spell out empty arrays.
 *
 * @param {Object} fields
 * @param {string} fields.task     - Required. The task or operation being logged.
 * @param {Array}  [fields.inputs] - Inputs consumed by the task (default []).
 * @param {Array}  [fields.actions]- Actions performed by the task (default []).
 * @param {Array}  [fields.risks]  - Risks surfaced or mitigated during execution (default []).
 * @param {string} [fields.result] - Outcome summary (default 'completed').
 * @returns {Object} A schema-conformant Audit Log record.
 */
function buildAuditLog(fields = {}) {
    if (!fields.task || typeof fields.task !== 'string') {
        throw new Error('audit_logger: `task` is required and must be a string');
    }
    const record = {
        task: fields.task,
        inputs: Array.isArray(fields.inputs) ? fields.inputs : [],
        actions: Array.isArray(fields.actions) ? fields.actions : [],
        risks: Array.isArray(fields.risks) ? fields.risks : [],
        result: typeof fields.result === 'string' ? fields.result : 'completed'
    };
    return record;
}

/**
 * Validate that a record contains all five canonical fields. Throws on violation.
 *
 * @param {Object} record
 */
function assertSchema(record) {
    for (const field of REQUIRED_FIELDS) {
        if (!(field in record)) {
            throw new Error(`audit_logger: missing required field "${field}"`);
        }
    }
    if (typeof record.task !== 'string' || record.task.length === 0) {
        throw new Error('audit_logger: `task` must be a non-empty string');
    }
    for (const arrayField of ['inputs', 'actions', 'risks']) {
        if (!Array.isArray(record[arrayField])) {
            throw new Error(`audit_logger: \`${arrayField}\` must be an array`);
        }
    }
    if (typeof record.result !== 'string') {
        throw new Error('audit_logger: `result` must be a string');
    }
}

/**
 * Emit a canonical Audit Log entry to stderr as a single-line JSON object.
 *
 * @param {Object} fields - Either a complete Audit Log record or a partial set of fields.
 */
function emitAuditLog(fields) {
    const record = buildAuditLog(fields);
    assertSchema(record);
    process.stderr.write(`${JSON.stringify(record)}\n`);
}

/**
 * Map an internal operational event (e.g., `SYNC_COMPLETE`, `TRIAGE_VIP`,
 * `CONFIG_UPDATE`) to the canonical Audit Log shape. The event name becomes the
 * `task` field; remaining fields default to empty unless supplied.
 *
 * The same 5-field schema is used for both agent personas and infrastructure-level
 * events (Decision [2026-06-25-0002]) to keep fleet observability uniform.
 *
 * @param {string} eventName - Internal event identifier (e.g., 'SYNC_COMPLETE').
 * @param {Object} [payload] - Optional structured payload to attach to the record.
 * @returns {Object} A schema-conformant Audit Log record.
 */
function fromInternalEvent(eventName, payload = {}) {
    if (!eventName || typeof eventName !== 'string') {
        throw new Error('audit_logger: `eventName` is required and must be a string');
    }
    return buildAuditLog({
        task: eventName.toLowerCase(),
        inputs: payload.inputs,
        actions: payload.actions,
        risks: payload.risks,
        result: payload.result
    });
}

module.exports = {
    buildAuditLog,
    assertSchema,
    emitAuditLog,
    fromInternalEvent,
    REQUIRED_FIELDS
};
module.exports.default = module.exports;

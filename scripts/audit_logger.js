/**
 * audit_logger.js — Shared JSON Audit Log emitter for Node.js tools and services.
 *
 * Satisfies AGENTS.md "Internal Tool & Service Audit Logs" mandate and
 * REQUIREMENTS.md §"Internal Tool Observability" requirement.
 *
 * Canonical shape (aligned with agent persona Audit Log contract):
 *   { "task": "...", "inputs": [...], "actions": [...], "risks": [...], "result": "..." }
 *
 * Emission channel: stderr (Decision [2026-04-13] — Technical Sink for Audit Logs).
 *
 * Dual-module support: exposed as both CommonJS (module.exports) and via a small
 * shim (audit_logger.mjs) for ESM consumers to unblock ESM-native services like
 * tools/executive-assistant/. See Decision [2026-07-02].
 *
 * Usage (CJS):
 *   const { emit, mapEvent } = require('../../scripts/audit_logger');
 *   emit({ task: 'CONFIG_SYNC', inputs: ['config.json'], actions: ['reloaded'], risks: [], result: 'ok' });
 *
 * Usage (ESM):
 *   import { emit } from '../../scripts/audit_logger.mjs';
 */

'use strict';

const REQUIRED_FIELDS = ['task', 'inputs', 'actions', 'risks', 'result'];

/**
 * Validate and normalize an audit log record against the canonical schema.
 * Missing fields are populated with safe defaults so a malformed call still
 * produces a schema-compliant record, but a warning is written to stderr.
 */
function normalize(record) {
    const out = {};
    let hadMissing = false;
    for (const field of REQUIRED_FIELDS) {
        if (record && Object.prototype.hasOwnProperty.call(record, field)) {
            out[field] = record[field];
        } else {
            hadMissing = true;
            out[field] = field === 'task' || field === 'result' ? '' : [];
        }
    }
    if (hadMissing) {
        // Emit a soft warning on stderr but preserve structured emission below.
        process.stderr.write(
            `[audit_logger] WARN: record missing fields (${REQUIRED_FIELDS.filter(f => !record || !Object.prototype.hasOwnProperty.call(record, f)).join(',')})\n`
        );
    }
    return out;
}

/**
 * Emit an Audit Log record as a single JSON line to stderr.
 * Records are prefixed with "AUDIT_LOG " so orchestrators that multiplex
 * stderr (n8n, custom Docker wrappers) can disambiguate structured audit
 * lines from unstructured technical error output.
 * @param {object} record
 * @param {object} [options]
 * @param {boolean} [options.prefix=true] Set false to emit raw JSON without the marker.
 */
function emit(record, options = {}) {
    const normalized = normalize(record);
    const line = JSON.stringify(normalized);
    const prefix = options.prefix === false ? '' : 'AUDIT_LOG ';
    process.stderr.write(`${prefix}${line}\n`);
    return normalized;
}

/**
 * Map an internal tool/service event to a canonical Audit Log record.
 * Provides a light adapter layer so tool authors can call
 *   mapEvent('SYNC_COMPLETE', { messagesProcessed: 42 })
 * without hand-rolling the schema each time.
 *
 * @param {string} eventName Internal event identifier (uppercase snake_case).
 * @param {object} details Event-specific detail bag; folded into `inputs` (context) and `result` (summary).
 * @param {object} [extras]
 * @param {string[]} [extras.actions] Explicit action list; defaults to a single-entry echo of the event.
 * @param {string[]} [extras.risks] Any known/observed risks for this event.
 * @param {string}   [extras.result] Overriding result string; defaults to a compact summary of `details`.
 */
function mapEvent(eventName, details = {}, extras = {}) {
    const inputs = Object.entries(details).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`);
    return {
        task: String(eventName),
        inputs,
        actions: Array.isArray(extras.actions) && extras.actions.length ? extras.actions : [eventName.toLowerCase()],
        risks: Array.isArray(extras.risks) ? extras.risks : [],
        result: typeof extras.result === 'string'
            ? extras.result
            : (Object.keys(details).length ? 'ok' : 'noop')
    };
}

/**
 * Convenience: build via mapEvent and emit in one call.
 */
function logEvent(eventName, details, extras) {
    return emit(mapEvent(eventName, details, extras));
}

module.exports = {
    REQUIRED_FIELDS,
    emit,
    mapEvent,
    logEvent,
    normalize
};

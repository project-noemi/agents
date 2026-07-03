/**
 * scripts/audit_logger.js
 *
 * Shared structured JSON Audit Log emitter for Node.js-based internal tools
 * (`tools/`) and reference services (`examples/`).
 *
 * Mandated by AGENTS.md ("Internal Tool & Service Audit Logs") and
 * REQUIREMENTS.md §2 Audit Log Shape. Resolves the long-standing
 * "Internal Tool Observability Gap" listed under Current Known Limitations.
 *
 * Canonical schema (lightweight; agents and services share it):
 *   {
 *     "task": string,            // operation name, e.g. "dashboard.ingest.report"
 *     "inputs": Array<string>,   // non-sensitive identifiers/parameters
 *     "actions": Array<string>,  // discrete steps the tool took
 *     "risks": Array<string>,    // detected anomalies / refusal triggers / warnings
 *     "result": string           // terminal state, e.g. "ok", "rejected", "error"
 *   }
 *
 * Emission rule: always to stderr, one event per line (NDJSON), so orchestrators
 * can capture audit records separately from user-facing stdout payloads.
 *
 * Secrets, credentials, and PII MUST NOT be passed in. Callers are responsible
 * for redaction at the boundary; this module performs a defensive structural
 * check only and will not introspect string values.
 */

'use strict';

const REQUIRED_FIELDS = ['task', 'inputs', 'actions', 'risks', 'result'];

/**
 * Normalize an arbitrary input into the canonical Audit Log shape.
 * Missing fields are filled with safe defaults so a partial caller still
 * produces a schema-valid record.
 *
 * @param {object} record
 * @returns {object}
 */
function normalize(record) {
    const safe = record && typeof record === 'object' ? record : {};
    return {
        task: typeof safe.task === 'string' && safe.task.length > 0 ? safe.task : 'unspecified',
        inputs: Array.isArray(safe.inputs) ? safe.inputs : [],
        actions: Array.isArray(safe.actions) ? safe.actions : [],
        risks: Array.isArray(safe.risks) ? safe.risks : [],
        result: typeof safe.result === 'string' && safe.result.length > 0 ? safe.result : 'unspecified'
    };
}

/**
 * Emit one structured audit record to stderr as a single NDJSON line.
 *
 * @param {object} record  Canonical Audit Log shape (see module header).
 * @param {object} [options]
 * @param {string} [options.source]  Optional tool/service name; appended as `source` field.
 * @param {NodeJS.WritableStream} [options.stream]  Override sink (defaults to process.stderr).
 */
function emit(record, options) {
    const opts = options || {};
    const sink = opts.stream || process.stderr;
    const payload = normalize(record);
    if (opts.source && typeof opts.source === 'string') {
        payload.source = opts.source;
    }
    if (!payload.timestamp) {
        payload.timestamp = new Date().toISOString();
    }
    sink.write(`${JSON.stringify(payload)}\n`);
}

/**
 * Convenience: build a logger bound to a tool/service name. Each call to
 * `.emit(record)` will automatically tag the record with `source`.
 *
 * @param {string} source  Tool/service identifier (e.g. "executive-assistant").
 * @returns {{ emit: (record: object) => void }}
 */
function createLogger(source) {
    return {
        emit(record) {
            emit(record, { source });
        }
    };
}

/**
 * Validate a record against the canonical schema without emitting.
 * Returns an array of human-readable problems; empty array means valid.
 *
 * @param {object} record
 * @returns {Array<string>}
 */
function validate(record) {
    const problems = [];
    if (!record || typeof record !== 'object') {
        problems.push('record must be an object');
        return problems;
    }
    for (const field of REQUIRED_FIELDS) {
        if (!(field in record)) {
            problems.push(`missing required field: ${field}`);
        }
    }
    if ('task' in record && typeof record.task !== 'string') {
        problems.push('task must be a string');
    }
    if ('result' in record && typeof record.result !== 'string') {
        problems.push('result must be a string');
    }
    for (const arrField of ['inputs', 'actions', 'risks']) {
        if (arrField in record && !Array.isArray(record[arrField])) {
            problems.push(`${arrField} must be an array`);
        }
    }
    return problems;
}

module.exports = {
    emit,
    createLogger,
    normalize,
    validate,
    REQUIRED_FIELDS
};

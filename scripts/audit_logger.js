// scripts/audit_logger.js
//
// Shared utility for emitting structured JSON Audit Logs to stderr from
// Node.js-based tools and reference services, as mandated by AGENTS.md and
// REQUIREMENTS.md.
//
// The canonical Audit Log shape is:
//   {
//     "task": "...",          // short imperative description of what was attempted
//     "inputs": [],           // sanitised list of inputs (paths, IDs, identifiers) — never secrets
//     "actions": [],          // ordered list of actions actually performed
//     "risks": [],            // recognised risks, warnings, or refusals
//     "result": "..."         // brief outcome (success | partial | failure | refused)
//   }
//
// The utility also exposes an internal-event mapping (e.g., SYNC_COMPLETE,
// TRIAGE_VIP) so internal tools can translate their operational events into
// the canonical Audit Log schema without re-inventing the mapping each time.
//
// Reference: Decisions [2026-04-13] (stderr emission), [2026-05-28-0001]
// (logging-mcp transport envelope), [2026-06-27-0001] (this utility’s
// canonical schema and event mapping).

'use strict';

const REQUIRED_FIELDS = ['task', 'inputs', 'actions', 'risks', 'result'];

// Canonical event-to-task mapping for internal tools and reference services.
// Tools should pass their internal event name to mapEventToTask() to ensure
// consistent audit semantics across the fleet.
const EVENT_TASK_MAP = Object.freeze({
    SYNC_COMPLETE: 'Synchronize state from upstream source',
    SYNC_FAILED: 'Synchronize state from upstream source (failed)',
    TRIAGE_VIP: 'Triage inbound message against VIP rules',
    TRIAGE_GENERAL: 'Triage inbound message against general rules',
    CONFIG_UPDATE: 'Apply configuration change',
    CONFIG_RELOAD: 'Reload configuration from disk',
    OAUTH_REFRESH: 'Refresh OAuth credentials',
    INGEST_REPORT: 'Ingest signed report into dashboard',
    INGEST_REJECTED: 'Reject malformed or unsigned ingest request',
    LEARNING_RESOLUTION: 'Record human resolution for learning feedback loop',
    HEALTHCHECK: 'Verify service liveness',
    SCHEDULED_RUN: 'Execute scheduled task',
    AUDIT_RUN: 'Run repository audit',
    GENERATE_CONTEXT: 'Generate AI context files'
});

function mapEventToTask(event, fallback) {
    if (event && typeof event === 'string' && EVENT_TASK_MAP[event]) {
        return EVENT_TASK_MAP[event];
    }
    return fallback || (typeof event === 'string' ? event : 'Unspecified internal event');
}

function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null) return [];
    return [value];
}

// Strip well-known secret-bearing keys before emission. This is best-effort —
// callers are still responsible for never passing raw secrets in the first
// place, but this provides a safety net.
const SECRET_KEY_PATTERN = /(secret|password|token|api[_-]?key|credential|authorization|bearer)/i;

function redactValue(value) {
    if (typeof value === 'string') {
        if (value.length > 200) return `${value.slice(0, 200)}…[truncated]`;
        return value;
    }
    if (Array.isArray(value)) return value.map(redactValue);
    if (isPlainObject(value)) {
        const out = {};
        for (const [key, val] of Object.entries(value)) {
            if (SECRET_KEY_PATTERN.test(key)) {
                out[key] = '[REDACTED]';
            } else {
                out[key] = redactValue(val);
            }
        }
        return out;
    }
    return value;
}

function buildAuditLog({ task, inputs, actions, risks, result, event, meta } = {}) {
    const resolvedTask = task || mapEventToTask(event, 'Unspecified internal event');
    const payload = {
        task: String(resolvedTask),
        inputs: ensureArray(inputs).map(redactValue),
        actions: ensureArray(actions).map(redactValue),
        risks: ensureArray(risks).map(redactValue),
        result: String(result || 'success')
    };
    if (meta && isPlainObject(meta)) {
        payload.meta = redactValue(meta);
    }
    if (event && typeof event === 'string') {
        payload.event = event;
    }
    return payload;
}

function validateAuditLog(record) {
    const errors = [];
    if (!isPlainObject(record)) {
        return ['Audit Log must be a plain JSON object.'];
    }
    for (const field of REQUIRED_FIELDS) {
        if (!(field in record)) {
            errors.push(`Missing mandatory field: ${field}`);
            continue;
        }
        const value = record[field];
        if (field === 'task' || field === 'result') {
            if (typeof value !== 'string' || value.trim() === '') {
                errors.push(`Field ${field} must be a non-empty string.`);
            }
        } else if (!Array.isArray(value)) {
            errors.push(`Field ${field} must be an array.`);
        }
    }
    return errors;
}

// Emit a single Audit Log line to stderr, prefixed with `AUDIT_LOG: ` to make
// unambiguous capture possible in orchestrator environments that share stderr
// across multiple sinks (n8n, Docker compose, GitHub Actions).
//
// Prefixing is intentionally lightweight so that the line remains valid JSON
// after the prefix is stripped, allowing tools to either pattern-match the
// prefix or simply parse the trailing JSON.
function emit(input, streams = { stderr: process.stderr }) {
    let record;
    if (isPlainObject(input) && REQUIRED_FIELDS.every((f) => f in input)) {
        record = input;
    } else {
        record = buildAuditLog(input || {});
    }
    const errors = validateAuditLog(record);
    if (errors.length > 0) {
        // Surface the misuse but do not throw — observability must not break
        // the caller's primary control flow.
        streams.stderr.write(
            `AUDIT_LOG_WARN: invalid audit log shape (${errors.join('; ')}); raw=${JSON.stringify(record)}\n`
        );
        return record;
    }
    streams.stderr.write(`AUDIT_LOG: ${JSON.stringify(record)}\n`);
    return record;
}

module.exports = {
    EVENT_TASK_MAP,
    REQUIRED_FIELDS,
    buildAuditLog,
    emit,
    mapEventToTask,
    validateAuditLog
};

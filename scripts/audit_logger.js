/**
 * audit_logger.js — Standardized JSON logging utility for Project NoéMI.
 *
 * Mandated by REQUIREMENTS.md and AGENTS.md to ensure fleet-wide observability.
 * Emits a structured JSON Audit Log to stderr.
 */

function emitAuditLog({ task, inputs = [], actions = [], risks = [], result }) {
    const auditLog = {
        timestamp: new Date().toISOString(),
        task,
        inputs,
        actions,
        risks,
        result
    };

    process.stderr.write(`${JSON.stringify(auditLog, null, 2)}\n`);
}

module.exports = { emitAuditLog };

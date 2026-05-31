/**
 * scripts/audit_logger.js
 *
 * Shared utility for emitting structured JSON Audit Logs to stderr.
 * Follows the mandated shape for Project NoéMI agentic observability.
 */

/**
 * Emits a structured JSON Audit Log to stderr.
 *
 * @param {string} task - The task being performed.
 * @param {string[]} inputs - List of inputs used for the task.
 * @param {string[]} actions - List of actions taken during the task.
 * @param {string[]} risks - List of risks encountered or mitigated.
 * @param {string} result - The outcome of the task.
 */
function logAudit(task, inputs = [], actions = [], risks = [], result = '') {
    const auditLog = {
        task,
        inputs,
        actions,
        risks,
        result
    };

    process.stderr.write(`${JSON.stringify(auditLog, null, 2)}\n`);
}

module.exports = { logAudit };

/**
 * Shared utility for emitting structured JSON Audit Logs to stderr.
 * This aligns with the project's observability mandate for agents and tools.
 */
function logAudit(task, { inputs = [], actions = [], risks = [], result = "success" } = {}) {
  const auditLog = {
    timestamp: new Date().toISOString(),
    task,
    inputs,
    actions,
    risks,
    result
  };
  process.stderr.write(JSON.stringify(auditLog) + "\n");
}

module.exports = { logAudit };

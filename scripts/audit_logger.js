/**
 * audit_logger.js
 * Standard utility for emitting mandated JSON Audit Logs to stderr.
 */

class AuditLogger {
    /**
     * @param {string} task The name of the task being performed.
     */
    constructor(task) {
        this.task = task;
        this.inputs = [];
        this.actions = [];
        this.risks = [];
        this.result = 'pending';
    }

    /**
     * @param {string} input
     */
    addInput(input) {
        if (input) this.inputs.push(input);
        return this;
    }

    /**
     * @param {string} action
     */
    addAction(action) {
        if (action) this.actions.push(action);
        return this;
    }

    /**
     * @param {string} risk
     */
    addRisk(risk) {
        if (risk) this.risks.push(risk);
        return this;
    }

    /**
     * @param {string} result
     */
    setResult(result) {
        this.result = result;
        return this;
    }

    /**
     * Emits the structured JSON Audit Log to stderr.
     */
    emit() {
        const auditLog = {
            task: this.task,
            inputs: this.inputs,
            actions: this.actions,
            risks: this.risks,
            result: this.result
        };
        process.stderr.write(JSON.stringify(auditLog) + '\n');
    }
}

module.exports = AuditLogger;

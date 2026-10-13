import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(fileURLToPath(import.meta.url));
const cliPath = join(root, "..", "src", "cli.js");
const fixture = (name) => join(root, "..", "fixtures", name);

function runCli(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [cliPath, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => { stdout += chunk; });
    proc.stderr.on("data", (chunk) => { stderr += chunk; });
    proc.on("error", reject);
    proc.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

test("CLI emits audit log on validation failure", async () => {
  const result = await runCli(["compile", fixture("broken.missing-refusal.md"), "--provider", "mock"]);
  
  assert.equal(result.code, 1);
  
  const stderrLines = result.stderr.trim().split("\n");
  assert.ok(stderrLines.length >= 2, "expected at least audit log line + error JSON start");
  
  // First line should be the audit log (single-line JSON)
  const auditLog = JSON.parse(stderrLines[0]);
  assert.equal(auditLog.task, "compile:coding/broken");
  assert.deepEqual(auditLog.inputs, [fixture("broken.missing-refusal.md"), "mock"]);
  assert.deepEqual(auditLog.actions, ["parse", "validate"]);
  assert.deepEqual(auditLog.risks, []);
  assert.equal(auditLog.result, "error:validation-failed");
  
  // Remaining lines form the error JSON (may be multiline pretty-printed)
  const errorOutput = JSON.parse(stderrLines.slice(1).join("\n"));
  assert.equal(errorOutput.ok, false);
  assert.ok(errorOutput.errors.some((e) => e.code === "MISSING_REFUSAL"));
});

test("CLI emits audit log on parse error", async () => {
  const result = await runCli(["compile", "nonexistent-file.md", "--provider", "mock"]);
  
  assert.equal(result.code, 1);
  
  const stderrLines = result.stderr.trim().split("\n");
  assert.ok(stderrLines.length >= 2, "expected at least audit log line + error JSON start");
  
  // First line should be the audit log (single-line JSON)
  const auditLog = JSON.parse(stderrLines[0]);
  assert.equal(auditLog.task, "compile:nonexistent-file.md");
  assert.deepEqual(auditLog.inputs, ["nonexistent-file.md", "mock"]);
  assert.deepEqual(auditLog.actions, ["parse"]);
  assert.deepEqual(auditLog.risks, []);
  assert.match(auditLog.result, /^error:/);
  
  // Remaining lines form the error JSON (may be multiline pretty-printed)
  const errorOutput = JSON.parse(stderrLines.slice(1).join("\n"));
  assert.equal(errorOutput.ok, false);
  assert.ok(errorOutput.errors.length > 0);
});

test("CLI emits audit log on success", async () => {
  const result = await runCli(["compile", fixture("architect.core.md"), "--provider", "mock"]);
  
  assert.equal(result.code, 0);
  
  const stderrLines = result.stderr.trim().split("\n");
  assert.ok(stderrLines.length >= 1, "expected at least audit log");
  
  // First line should be the audit log (single-line JSON)
  const auditLog = JSON.parse(stderrLines[0]);
  assert.equal(auditLog.task, "compile:coding/architect");
  assert.deepEqual(auditLog.inputs, [fixture("architect.core.md"), "mock"]);
  assert.ok(auditLog.actions.includes("parse"));
  assert.ok(auditLog.actions.includes("validate"));
  assert.ok(auditLog.actions.includes("run:mock"));
  assert.equal(auditLog.result, "ok");
  
  const successOutput = JSON.parse(result.stdout);
  assert.equal(successOutput.ok, true);
  assert.equal(successOutput.ir.id, "coding/architect");
});

test("CLI audit log distinguishes provider config errors from validation errors", async () => {
  // Provider config error (e.g., missing API key) should result in error:provider-provider_config
  const result = await runCli(["compile", fixture("architect.core.md"), "--provider", "gemini"]);
  
  assert.equal(result.code, 1);
  
  const stderrLines = result.stderr.trim().split("\n");
  assert.ok(stderrLines.length >= 2, "expected at least audit log line + error JSON start");
  
  // First line should be the audit log (single-line JSON)
  const auditLog = JSON.parse(stderrLines[0]);
  assert.equal(auditLog.task, "compile:coding/architect");
  assert.deepEqual(auditLog.inputs, [fixture("architect.core.md"), "gemini"]);
  assert.deepEqual(auditLog.actions, ["parse", "validate", "run"]);
  assert.deepEqual(auditLog.risks, []);
  assert.equal(auditLog.result, "error:provider-provider_config");
  
  // Remaining lines form the error JSON (may be multiline pretty-printed)
  const errorOutput = JSON.parse(stderrLines.slice(1).join("\n"));
  assert.equal(errorOutput.ok, false);
  assert.ok(errorOutput.errors.some((e) => e.code === "PROVIDER_CONFIG"));
});

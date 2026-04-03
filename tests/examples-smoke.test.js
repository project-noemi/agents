const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('docker env inventories use vault references instead of placeholder secrets', () => {
    const envFiles = [
        'examples/docker/.env.example',
        'examples/fleet-deployment/.env.example',
        'examples/gatekeeper-deployment/.env.example',
        'examples/video-automation-pod/.env.example'
    ];

    for (const envFile of envFiles) {
        const content = read(envFile);
        assert.doesNotMatch(content, /changeme/i, `${envFile} still contains insecure placeholder values`);
        assert.match(content, /op:\/\//, `${envFile} should contain vault-reference examples`);
    }
});

test('compose examples point to Fetch-on-Demand inventories', () => {
    const composeFiles = [
        'examples/docker/docker-compose.yml',
        'examples/fleet-deployment/docker-compose.yml',
        'examples/gatekeeper-deployment/docker-compose.yml'
    ];

    for (const composeFile of composeFiles) {
        const content = read(composeFile);
        assert.match(content, /op run --env-file=.env.example -- docker compose up -d/);
        assert.doesNotMatch(content, /--env-file=.env -- docker compose up -d/);
    }
});

test('gatekeeper deployment includes the signed dashboard ingest path', () => {
    const compose = read('examples/gatekeeper-deployment/docker-compose.yml');
    const entrypoint = read('examples/gatekeeper-deployment/entrypoint.sh');

    assert.match(compose, /dashboard-ingest:/);
    assert.match(compose, /DASHBOARD_API_URL=http:\/\/dashboard-ingest:8081\/ingest/);
    assert.match(entrypoint, /X-Signature-256/);
    assert.match(entrypoint, /retry_with_backoff/);
});

test('video watcher leaves Dropbox inputs retryable when manager execution fails', () => {
    const watcher = read('examples/video-automation-pod/dropbox_watcher.py');
    assert.match(watcher, /Leaving source files in Dropbox inbound for retry/);
    assert.match(watcher, /return False/);
});

test('Docker Agent Home guide connects the current example topologies', () => {
    const guide = read('docs/examples/docker-agent-home.md');
    assert.match(guide, /examples\/docker/);
    assert.match(guide, /examples\/fleet-deployment/);
    assert.match(guide, /examples\/gatekeeper-deployment/);
    assert.match(guide, /not a runtime or execution engine/i);
});

test('Google Workspace docs separate Gemini CLI, generic MCP, and n8n setup paths', () => {
    const geminiQuickstart = read('docs/tool-usages/gemini-workspace-quickstart.md');
    const n8nQuickstart = read('docs/examples/n8n-google-workspace-quickstart.md');
    const genericGoogleSetup = read('docs/mcp-setup/google-workspace.md');
    const matrix = read('docs/mcp-setup/google-n8n-credential-matrix.md');

    assert.match(geminiQuickstart, /gemini extensions install https:\/\/github\.com\/gemini-cli-extensions\/workspace/);
    assert.match(geminiQuickstart, /does \*\*not\*\* use the generic `GOOGLE_CLIENT_ID`/);
    assert.match(n8nQuickstart, /uses \*\*n8n credentials\*\*, not the Gemini CLI Workspace extension/i);
    assert.match(genericGoogleSetup, /generic Google Workspace MCP server pattern/i);
    assert.match(genericGoogleSetup, /Gemini CLI with the official Workspace extension/i);
    assert.match(genericGoogleSetup, /n8n Google Workspace nodes/i);
    assert.match(matrix, /Gemini CLI \+ Workspace extension/);
    assert.match(matrix, /n8n Gmail \/ Docs \/ Drive \/ Sheets nodes/);
});

test('n8n guidance avoids invented helper APIs and documents the real runtime surface', () => {
    const persona = read('docs/tool-usages/n8n-expert-persona.md');
    const protocol = read('mcp-protocols/n8n.md');

    assert.doesNotMatch(persona, /tools_documentation\(\)|validate_node\(|validate_workflow/);
    assert.match(persona, /n8n editor or API/i);
    assert.match(protocol, /Do Not Assume Hidden Helper Tools/);
});

test('RFP responder workflow uses the current Google Gemini node path', () => {
    const workflow = JSON.parse(read('examples/workflows/rfp-responder.json'));
    const workflowText = read('examples/workflows/rfp-responder.json');
    const geminiNode = workflow.nodes.find((node) => node.name === 'Analyze Request (Gemini)');

    assert.ok(geminiNode, 'Expected Analyze Request (Gemini) node to exist');
    assert.equal(geminiNode.type, '@n8n/n8n-nodes-langchain.googleGemini');
    assert.match(workflowText, /models\/gemini-2\.5-flash/);
    assert.match(workflowText, /REPLACE_WITH_YOUR_GEMINI_API_CREDENTIAL_ID/);
    assert.doesNotMatch(workflowText, /@n8n\/n8n-nodes-langchain\.chainLlm/);
});

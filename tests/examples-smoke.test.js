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

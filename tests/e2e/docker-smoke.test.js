const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');
const dockerTimeoutMs = Number(process.env.NOEMI_DOCKER_SMOKE_TIMEOUT_MS || 600000);
const pollIntervalMs = Number(process.env.NOEMI_DOCKER_SMOKE_POLL_INTERVAL_MS || 2000);
const artifactsRoot = path.join(
    repoRoot,
    process.env.NOEMI_DOCKER_SMOKE_ARTIFACT_DIR || 'test-artifacts/docker-smoke'
);

function run(command, args, options = {}) {
    return spawnSync(command, args, {
        cwd: options.cwd || repoRoot,
        env: { ...process.env, ...(options.env || {}) },
        encoding: 'utf8',
        timeout: options.timeout || dockerTimeoutMs
    });
}

function dockerIsAvailable() {
    const dockerVersion = run('docker', ['version']);
    const composeVersion = run('docker', ['compose', 'version']);
    return dockerVersion.status === 0 && composeVersion.status === 0;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function compose(stack, args, timeout = dockerTimeoutMs) {
    return run('docker', ['compose', ...args], {
        cwd: stack.cwd,
        env: stack.env,
        timeout
    });
}

function down(stack) {
    compose(stack, ['down', '-v', '--remove-orphans'], 180000);
}

function getRunningServices(stack) {
    const result = compose(stack, ['ps', '--services', '--status', 'running'], 30000);
    if (result.status !== 0) {
        return [];
    }

    return result.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

async function waitForRunningServices(stack) {
    const deadline = Date.now() + dockerTimeoutMs;

    while (Date.now() < deadline) {
        const running = getRunningServices(stack);
        if (stack.expectedServices.every((service) => running.includes(service))) {
            return running;
        }
        await sleep(pollIntervalMs);
    }

    const ps = compose(stack, ['ps'], 30000);
    const logs = compose(stack, ['logs', '--tail', '100'], 120000);
    throw new Error(
        `Timed out waiting for ${stack.name} to reach expected running services.\n` +
        `Expected: ${stack.expectedServices.join(', ')}\n\n` +
        `docker compose ps:\n${ps.stdout}\n${ps.stderr}\n\n` +
        `docker compose logs --tail 100:\n${logs.stdout}\n${logs.stderr}`
    );
}

function assertSuccess(result, description) {
    assert.equal(
        result.status,
        0,
        `${description} failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );
}

function ensureArtifactDir(stack) {
    const stackDir = path.join(artifactsRoot, stack.name);
    fs.mkdirSync(stackDir, { recursive: true });
    return stackDir;
}

function writeArtifact(filePath, content) {
    fs.writeFileSync(filePath, `${content || ''}\n`, 'utf8');
}

function captureDiagnostics(stack, phase, failureResult = null) {
    const stackDir = ensureArtifactDir(stack);
    const composeConfig = compose(stack, ['config'], 30000);
    const composePs = compose(stack, ['ps'], 30000);
    const composeLogs = compose(stack, ['logs', '--tail', '200'], 120000);
    const envKeys = Object.keys(stack.env).sort();

    writeArtifact(path.join(stackDir, `${phase}-env-keys.txt`), envKeys.join('\n'));
    writeArtifact(
        path.join(stackDir, `${phase}-result.txt`),
        failureResult
            ? `status=${failureResult.status}\nstdout:\n${failureResult.stdout}\nstderr:\n${failureResult.stderr}`
            : 'No direct command failure result captured.'
    );
    writeArtifact(
        path.join(stackDir, `${phase}-compose-config.txt`),
        `status=${composeConfig.status}\nstdout:\n${composeConfig.stdout}\nstderr:\n${composeConfig.stderr}`
    );
    writeArtifact(
        path.join(stackDir, `${phase}-compose-ps.txt`),
        `status=${composePs.status}\nstdout:\n${composePs.stdout}\nstderr:\n${composePs.stderr}`
    );
    writeArtifact(
        path.join(stackDir, `${phase}-compose-logs.txt`),
        `status=${composeLogs.status}\nstdout:\n${composeLogs.stdout}\nstderr:\n${composeLogs.stderr}`
    );
}

function stack(name, relativeDir, env, expectedServices) {
    return {
        name,
        cwd: path.join(repoRoot, relativeDir),
        env: {
            COMPOSE_PROJECT_NAME: `noemi-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${process.pid}`,
            ...env
        },
        expectedServices
    };
}

const dockerAvailable = dockerIsAvailable();
const dockerTestOptions = dockerAvailable
    ? { timeout: dockerTimeoutMs + 30000 }
    : { skip: 'Docker CLI or Docker Compose is not available in this environment.' };

const stacks = [
    stack(
        'local-builder-home',
        'examples/docker',
        {
            POSTGRES_PASSWORD: 'smoke-postgres-password',
            GEMINI_API_KEY: 'smoke-gemini-api-key'
        },
        ['agent-memory', 'agent-runtime']
    ),
    stack(
        'fleet-operator-home',
        'examples/fleet-deployment',
        {
            GF_ADMIN_PASSWORD: 'smoke-grafana-password',
            CASDOOR_DB_PASSWORD: 'smoke-casdoor-password',
            COHORT01_DB_PASSWORD: 'smoke-cohort01-password',
            COHORT02_DB_PASSWORD: 'smoke-cohort02-password'
        },
        ['traefik', 'db-casdoor', 'casdoor', 'loki', 'grafana', 'db-cohort01', 'n8n-cohort01', 'db-cohort02', 'n8n-cohort02']
    ),
    stack(
        'gatekeeper-specialist-home',
        'examples/gatekeeper-deployment',
        {
            GH_TOKEN: 'smoke-gh-token',
            GATEKEEPER_ORG: 'smoke-org',
            GATEKEEPER_REPOS: '',
            GATEKEEPER_DRY_RUN: 'true',
            GATEKEEPER_INTERVAL_HOURS: '4',
            GATEKEEPER_HMAC_SECRET: 'smoke-hmac-secret',
            INFLUXDB_PASSWORD: 'smoke-influx-password',
            INFLUXDB_ADMIN_TOKEN: 'smoke-influx-admin-token',
            GF_ADMIN_PASSWORD: 'smoke-grafana-password',
            SLACK_WEBHOOK_URL: 'https://example.invalid/slack-webhook'
        },
        ['influxdb', 'grafana', 'dashboard-ingest', 'gatekeeper', 'alert-relay']
    )
];

for (const candidate of stacks) {
    test(`${candidate.name} boots its expected Docker services`, dockerTestOptions, async (t) => {
        t.after(() => down(candidate));

        const configResult = compose(candidate, ['config', '-q'], 30000);
        if (configResult.status !== 0) {
            captureDiagnostics(candidate, 'config-failure', configResult);
        }
        assertSuccess(configResult, `${candidate.name} docker compose config`);

        const upResult = compose(candidate, ['up', '-d', '--build']);
        if (upResult.status !== 0) {
            captureDiagnostics(candidate, 'up-failure', upResult);
        }
        assertSuccess(upResult, `${candidate.name} docker compose up`);

        try {
            const running = await waitForRunningServices(candidate);
            for (const service of candidate.expectedServices) {
                assert.ok(running.includes(service), `${candidate.name} did not report running service ${service}`);
            }
        } catch (error) {
            captureDiagnostics(candidate, 'runtime-failure');
            throw error;
        }
    });
}

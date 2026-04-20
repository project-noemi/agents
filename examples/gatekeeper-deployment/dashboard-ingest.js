#!/usr/bin/env node

const crypto = require('crypto');
const http = require('http');

const PORT = Number(process.env.PORT || '8081');
const DASHBOARD_API_TOKEN = process.env.DASHBOARD_API_TOKEN;
const GATEKEEPER_HMAC_SECRET = process.env.GATEKEEPER_HMAC_SECRET;
const INFLUXDB_WRITE_URL = process.env.INFLUXDB_WRITE_URL;
const INFLUXDB_AUTH_TOKEN = process.env.INFLUXDB_AUTH_TOKEN;

for (const [name, value] of Object.entries({
    DASHBOARD_API_TOKEN,
    GATEKEEPER_HMAC_SECRET,
    INFLUXDB_WRITE_URL,
    INFLUXDB_AUTH_TOKEN
})) {
    if (!value) {
        console.error(`${new Date().toISOString()} ERROR: Missing required environment variable ${name}`);
        process.exit(1);
    }
}

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(payload));
}

function logError(message) {
    console.error(`${new Date().toISOString()} ERROR: ${message}`);
}

function escapeTag(value) {
    return String(value).replace(/([,= ])/g, '\\$1');
}

function escapeField(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildInfluxLine(report) {
    const summary = report.summary || {};
    const timestampMs = Date.parse(report.cycle_completed_at || new Date().toISOString());
    const timestampNs = Number.isFinite(timestampMs) ? timestampMs * 1000000 : Date.now() * 1000000;
    const fields = [
        `repos_scanned=${Number(report.repos_scanned || 0)}i`,
        `pr_count=${Number(report.prs_evaluated || 0)}i`,
        `auto_merged=${Number(summary.auto_merged || 0)}i`,
        `flagged_for_review=${Number(summary.flagged_for_review || 0)}i`,
        `closed_stale_conflict=${Number(summary.closed_stale_conflict || 0)}i`,
        `skipped=${Number(summary.skipped || 0)}i`,
        `errors=${Number(summary.errors || 0)}i`,
        `mode="${escapeField(report.mode || 'unknown')}"`
    ];

    return `cycle_report,agent_id=${escapeTag(report.agent_id || 'unknown')},org=${escapeTag(report.org || 'unknown')} ${fields.join(',')} ${timestampNs}`;
}

async function writeInflux(lineProtocol) {
    const response = await fetch(INFLUXDB_WRITE_URL, {
        method: 'POST',
        headers: {
            Authorization: `Token ${INFLUXDB_AUTH_TOKEN}`,
            'Content-Type': 'text/plain; charset=utf-8'
        },
        body: lineProtocol
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`InfluxDB write failed with HTTP ${response.status}: ${body}`);
    }
}

function signatureMatches(rawBody, receivedSignature) {
    const expected = `sha256=${crypto.createHmac('sha256', GATEKEEPER_HMAC_SECRET).update(rawBody).digest('hex')}`;
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(receivedSignature || '');

    if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

const server = http.createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
        sendJson(response, 200, { status: 'ok' });
        return;
    }

    if (request.method !== 'POST' || request.url !== '/ingest') {
        sendJson(response, 404, { error: 'Not found' });
        return;
    }

    if (request.headers.authorization !== `Bearer ${DASHBOARD_API_TOKEN}`) {
        sendJson(response, 401, { error: 'Unauthorized' });
        return;
    }

    const signature = request.headers['x-signature-256'];
    const chunks = [];

    request.on('data', (chunk) => {
        chunks.push(chunk);
    });

    request.on('end', async () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');

        if (!signatureMatches(rawBody, signature)) {
            sendJson(response, 401, { error: 'Invalid signature' });
            return;
        }

        let report;
        try {
            report = JSON.parse(rawBody);
        } catch (error) {
            sendJson(response, 400, { error: `Invalid JSON payload: ${error.message}` });
            return;
        }

        try {
            const lineProtocol = buildInfluxLine(report);
            await writeInflux(lineProtocol);
            sendJson(response, 202, { status: 'accepted' });
        } catch (error) {
            logError(error.message);
            sendJson(response, 502, { error: 'Failed to persist report' });
        }
    });

    request.on('error', (error) => {
        logError(error.message);
        sendJson(response, 500, { error: 'Request handling failed' });
    });
});

server.listen(PORT, () => {
    console.log(`${new Date().toISOString()} Dashboard ingest listening on :${PORT}`);
});

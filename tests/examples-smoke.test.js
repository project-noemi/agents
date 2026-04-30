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
    assert.match(compose, /DASHBOARD_API_URL=http:\/\/dashboard-ingest:8081\/api\/v1\/reports/);
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
    assert.match(guide, /zero-to-first-agent\.md/);
    assert.match(guide, /node:24-alpine/);
});

test('beginner builder docs start with a safe local success before Docker', () => {
    const beginnerGuide = read('docs/examples/zero-to-first-agent.md');
    const builderGuide = read('docs/examples/builder-first-30-minutes.md');
    const readme = read('README.md');
    const platformGuide = read('docs/examples/cross-platform-kickstart.md');
    const macGuide = read('docs/examples/macos-linux-kickstart.md');
    const windowsGuide = read('docs/examples/windows-kickstart.md');
    const chromeOsGuide = read('docs/examples/chromeos-kickstart.md');

    assert.match(beginnerGuide, /read-only AI task against local repository content/i);
    assert.match(beginnerGuide, /does \*\*not\*\* require Docker/i);
    assert.match(beginnerGuide, /engineering agents in this repository/i);
    assert.match(beginnerGuide, /human approval before external action/i);
    assert.match(beginnerGuide, /cross-platform-kickstart\.md/);
    assert.match(beginnerGuide, /macos-linux-kickstart\.md/);
    assert.match(beginnerGuide, /windows-kickstart\.md/);
    assert.match(beginnerGuide, /chromeos-kickstart\.md/);
    assert.match(builderGuide, /phase-two Docker path/i);
    assert.match(builderGuide, /Decision Point: Pick The Docker Host Path/i);
    assert.match(builderGuide, /verify-env\.sh --mode=docker/);
    assert.match(builderGuide, /verify-env\.ps1 -Mode docker/i);
    assert.match(platformGuide, /Choose Your Workstation Path First/i);
    assert.match(platformGuide, /macos-linux-kickstart\.md/);
    assert.match(platformGuide, /windows-kickstart\.md/);
    assert.match(platformGuide, /chromeos-kickstart\.md/);
    assert.match(macGuide, /macOS or Linux/i);
    assert.match(macGuide, /bash scripts\/verify-env\.sh --mode=builder/i);
    assert.match(windowsGuide, /PowerShell/i);
    assert.match(windowsGuide, /powershell -ExecutionPolicy Bypass -File scripts\/verify-env\.ps1 -Mode builder/i);
    assert.match(windowsGuide, /You do \*\*not\*\* need WSL/i);
    assert.match(chromeOsGuide, /Linux development environment/i);
    assert.match(chromeOsGuide, /bash scripts\/verify-env\.sh --mode=builder/i);
    assert.match(chromeOsGuide, /ChromeOS is often \*\*not\*\* the easiest place to start the Docker phase/i);
});

test('template infrastructure is grouped under templates/context and the root no longer carries the old template files or stray n8n workflow folder', () => {
    const templatesReadme = read('templates/README.md');
    const geminiTemplate = read('templates/context/GEMINI.template.md');
    const claudeTemplate = read('templates/context/CLAUDE.template.md');

    assert.match(templatesReadme, /generated context templates/i);
    assert.match(geminiTemplate, /<!-- GLOBAL_MANDATES_START -->/);
    assert.match(claudeTemplate, /templates\/context\/\{GEMINI,CLAUDE\}\.template\.md/);
    assert.ok(!fs.existsSync(path.join(repoRoot, 'GEMINI.template.md')));
    assert.ok(!fs.existsSync(path.join(repoRoot, 'CLAUDE.template.md')));
    assert.ok(!fs.existsSync(path.join(repoRoot, 'n8n')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'examples/workflows/legacy/invoice-downloader-no-ai-no-key.json')));
});

test('secret management guide leads beginners through a local-first choice between Infisical and 1Password', () => {
    const guide = read('docs/tool-usages/secure-secret-management.md');

    assert.match(guide, /Beginner Quick Path: Local First/);
    assert.match(guide, /Infisical/);
    assert.match(guide, /1Password CLI/);
    assert.match(guide, /repo-only, read-only tasks can start without secrets/i);
    assert.match(guide, /machine identities/i);
});

test('phase zero assessment kit separates security readiness from AI readiness and speaks in business-value terms', () => {
    const kit = read('docs/phase-zero-assessment/README.md');
    const security = read('docs/phase-zero-assessment/security-assessment.md');
    const readiness = read('docs/phase-zero-assessment/ai-readiness-assessment.md');
    const report = read('docs/phase-zero-assessment/report-template.md');
    const rubric = read('docs/phase-zero-assessment/readiness-rubric.md');
    const roadmap = read('docs/phase-zero-assessment/roadmap-template.md');

    assert.match(kit, /Security Assessment/);
    assert.match(kit, /AI Readiness Assessment/);
    assert.match(kit, /can we do this safely/i);
    assert.match(kit, /can we do this in a way that creates real business value/i);
    assert.match(security, /Can we begin this AI initiative safely/i);
    assert.match(security, /business owner/i);
    assert.match(readiness, /real business value/i);
    assert.match(readiness, /manage AI doing the task/i);
    assert.match(readiness, /more output/i);
    assert.match(readiness, /lower unit cost/i);
    assert.match(report, /Security readiness:/);
    assert.match(report, /AI readiness:/);
    assert.match(report, /Role Uplift And Operating Model Recommendation/);
    assert.match(rubric, /Overall recommendation:/);
    assert.match(rubric, /First pilot recommendation:/);
    assert.match(roadmap, /Security Track/);
    assert.match(roadmap, /AI Readiness Track/);
});

test('front-door docs frame NoeMI as productivity uplift rather than labor replacement', () => {
    const visualsIndex = read('docs/visuals/README.md');

    assert.match(visualsIndex, /lower unit cost on first-pass operational tasks/i);
});

test('Google Workspace docs separate Gemini CLI, generic MCP, and n8n setup paths', () => {
    const gwsMachineSetup = read('docs/mcp-setup/gws-cli-machine-setup.md');
    const geminiQuickstart = read('docs/tool-usages/gemini-workspace-quickstart.md');
    const n8nQuickstart = read('docs/examples/n8n-google-workspace-quickstart.md');
    const genericGoogleSetup = read('docs/mcp-setup/google-workspace.md');
    const clientGuide = read('docs/mcp-setup/google-workspace-agentic-clients.md');
    const matrix = read('docs/mcp-setup/google-n8n-credential-matrix.md');

    assert.match(gwsMachineSetup, /gws auth setup/);
    assert.match(gwsMachineSetup, /gws auth login -s drive,gmail,sheets/);
    assert.match(gwsMachineSetup, /gws drive files list --params/);
    assert.match(gwsMachineSetup, /gemini extensions install https:\/\/github\.com\/googleworkspace\/cli/);
    assert.match(gwsMachineSetup, /not an officially supported Google product/i);
    assert.match(gwsMachineSetup, /Claude Code/);
    assert.match(gwsMachineSetup, /Codex/);
    assert.match(geminiQuickstart, /gemini extensions install https:\/\/github\.com\/gemini-cli-extensions\/workspace/);
    assert.match(geminiQuickstart, /does \*\*not\*\* use the generic `GOOGLE_CLIENT_ID`/);
    assert.match(geminiQuickstart, /gws-cli-machine-setup\.md/);
    assert.match(n8nQuickstart, /uses \*\*n8n credentials\*\*, not the Gemini CLI Workspace extension/i);
    assert.match(genericGoogleSetup, /generic Google Workspace MCP server pattern/i);
    assert.match(genericGoogleSetup, /Gemini CLI with the official Workspace extension/i);
    assert.match(genericGoogleSetup, /n8n Google Workspace nodes/i);
    assert.match(clientGuide, /Shared Local Foundation: `gws`/);
    assert.match(clientGuide, /gws-cli-machine-setup\.md/);
    assert.match(matrix, /Gemini CLI \+ Workspace extension/);
    assert.match(matrix, /n8n Gmail \/ Docs \/ Drive \/ Sheets nodes/);
});

test('local workspace docs explain CLI-first builder habits across Gemini, Claude, and Codex', () => {
    const overview = read('docs/tool-usages/agentic-local-workspaces.md');
    const google = read('docs/tool-usages/google-local-workspace.md');
    const claude = read('docs/tool-usages/claude-code-local-workspace.md');
    const codex = read('docs/tool-usages/openai-codex-local-workspace.md');
    const googleClients = read('docs/mcp-setup/google-workspace-agentic-clients.md');
    const microsoftClients = read('docs/mcp-setup/microsoft-365-agentic-clients.md');

    assert.match(overview, /Builders \/ Practitioners/i);
    assert.match(overview, /Accelerators/i);
    assert.match(overview, /CLI is usually the most durable source of truth/i);
    assert.match(google, /Antigravity/i);
    assert.match(google, /gws-cli-machine-setup\.md/);
    assert.match(google, /gemini mcp add/);
    assert.match(claude, /gws-cli-machine-setup\.md/);
    assert.match(claude, /claude mcp add/);
    assert.match(codex, /gws-cli-machine-setup\.md/);
    assert.match(codex, /codex mcp add/);
    assert.match(googleClients, /Gemini CLI/);
    assert.match(googleClients, /Antigravity/);
    assert.match(googleClients, /OpenAI Codex/);
    assert.match(googleClients, /Claude Code app/);
    assert.match(googleClients, /Claude Code CLI/);
    assert.match(microsoftClients, /Microsoft 365, also commonly called Office 365/i);
    assert.match(microsoftClients, /gemini mcp add microsoft365/);
    assert.match(microsoftClients, /codex mcp add microsoft365/);
    assert.match(microsoftClients, /claude mcp add microsoft365/);
});

test('localized operating profile docs separate culture from translation and guard against stereotypes', () => {
    const framework = read('docs/frameworks/localized-operating-profiles.md');
    const profilesReadme = read('operating-profiles/README.md');

    assert.match(framework, /without collapsing everything into simple translation/i);
    assert.match(framework, /language family/i);
    assert.match(framework, /subregion or city cluster/i);
    assert.match(framework, /inferred gender/i);
    assert.match(profilesReadme, /culturally grounded execution/i);
    assert.match(profilesReadme, /assumed identity/i);
});

test('value lens docs separate success logic from identity and define starter comparison lenses', () => {
    const framework = read('docs/frameworks/value-lenses.md');
    const lensesReadme = read('value-lenses/README.md');
    const performance = read('value-lenses/performance-efficiency.md');
    const care = read('value-lenses/care-continuity.md');
    const balanced = read('value-lenses/balanced-enterprise.md');

    assert.match(framework, /what counts as success here/i);
    assert.match(framework, /should use \*\*neutral operational names\*\*/i);
    assert.match(framework, /should never be silently inferred from gender or identity/i);
    assert.match(framework, /Demographic Math[ée]sis/i);
    assert.match(lensesReadme, /explicit success criteria and tradeoff logic/i);
    assert.match(lensesReadme, /Comparison Mode/i);
    assert.match(performance, /ROI/i);
    assert.match(performance, /Demographic Debt/i);
    assert.match(care, /Care Capital/i);
    assert.match(care, /10-year horizon/i);
    assert.match(balanced, /default/i);
    assert.match(balanced, /Demographic Footprint/i);
    assert.match(balanced, /business viability/i);
});

test('visual guides provide distinct views for structure, navigation, execution, and workshop exploration', () => {
    const visualsIndex = read('docs/visuals/README.md');
    const systemMap = read('docs/visuals/noemi-system-map.md');
    const audienceMap = read('docs/visuals/noemi-audience-entry-map.md');
    const runtimeFlow = read('docs/visuals/noemi-runtime-flow.md');
    const mindMap = read('docs/visuals/noemi-workshop-mind-map.md');

    assert.match(visualsIndex, /system map/i);
    assert.match(visualsIndex, /audience entry map/i);
    assert.match(visualsIndex, /runtime flow/i);
    assert.match(visualsIndex, /mind map/i);
    assert.match(systemMap, /Phase 0 Security/i);
    assert.match(systemMap, /Value Lenses/i);
    assert.match(audienceMap, /Client \/ Buyer/i);
    assert.match(audienceMap, /Builder \/ Accelerator/i);
    assert.match(runtimeFlow, /Guardian and Governance/i);
    assert.match(runtimeFlow, /Audit and ROI/i);
    assert.match(mindMap, /mindmap/);
    assert.match(mindMap, /Virtual Workforce/i);
});

test('n8n guidance avoids invented helper APIs and documents the real runtime surface', () => {
    const persona = read('docs/tool-usages/n8n-expert-persona.md');
    const protocol = read('mcp-protocols/n8n.md');

    assert.doesNotMatch(persona, /tools_documentation\(\)|validate_node\(|validate_workflow/);
    assert.match(persona, /n8n editor or API/i);
    assert.match(protocol, /Do Not Assume Hidden Helper Tools/);
});

test('rfp-split, gmu-validation, and secure-secret-management examples meet baseline contracts', () => {
    // rfp-split is a static fixture set used by example workflows; ensure all six section files are present in both PDF and TXT form.
    const rfpSections = [
        'Section_1_General_Information',
        'Section_2_Authority_Overview_Scope',
        'Section_3_Procurement_Requirements',
        'Section_4_Solicitation_Process',
        'Section_5_Award_and_Negotiation',
        'Section_6_Additional_Information'
    ];
    for (const section of rfpSections) {
        assert.ok(
            fs.existsSync(path.join(repoRoot, `examples/rfp-split/${section}.pdf`)),
            `rfp-split missing ${section}.pdf`
        );
        assert.ok(
            fs.existsSync(path.join(repoRoot, `examples/rfp-split/${section}.txt`)),
            `rfp-split missing ${section}.txt`
        );
    }

    // gmu-validation: must remain a Node.js example aligned with the canonical runtime baseline.
    const gmuBot = read('examples/gmu-validation/verification-bot.js');
    assert.match(gmuBot, /Phase 0 Security/);
    assert.match(gmuBot, /Red Team Gauntlet/);

    // secure-secret-management: legacy header on Python sample, vault wrapper in setup.
    const secretAgent = read('examples/secure-secret-management/agent_logic.py');
    const secretSetup = read('examples/secure-secret-management/setup.sh');
    assert.match(secretAgent, /LEGACY\/ILLUSTRATIVE/);
    assert.match(secretAgent, /os\.getenv\(/);
    assert.doesNotMatch(secretAgent, /load_dotenv|dotenv\.parse/);
    assert.match(secretSetup, /infisical|op /);
});

test('red-team-gauntlet exposes machine-readable test vectors for the onboarding validation suite', () => {
    const vectors = read('examples/red-team-gauntlet/test-vectors.yaml');
    assert.match(vectors, /id: PI-01-direct-override/);
    assert.match(vectors, /id: PI-02-roleplay-context-switch/);
    assert.match(vectors, /id: PI-03-invisible-prompting/);
    assert.match(vectors, /id: PII-01-standard-leak-redact/);
    assert.match(vectors, /id: PII-02-confidential-block/);
    assert.match(vectors, /target: PromptShield/);
    assert.match(vectors, /target: PIIGuard/);
});

test('client onboarding tier templates exist for basic, standard, and premium', () => {
    const readme = read('templates/tiers/README.md');
    assert.match(readme, /Client Tier Templates/);
    for (const tier of ['basic', 'standard', 'premium']) {
        const content = read(`templates/tiers/${tier}.yaml`);
        assert.match(content, new RegExp(`tier:\\s+${tier}`));
        assert.match(content, /active_mcps:/);
        assert.match(content, /agents:/);
    }
    const clientsReadme = read('clients/README.md');
    assert.match(clientsReadme, /Client Onboarding/);
});

test('ROI baseline configuration is available as a local JSON fallback', () => {
    const baseline = JSON.parse(read('tools/roi/baseline-config.json'));
    assert.equal(baseline.currency, 'USD');
    assert.ok(baseline.human_baseline_minutes && Object.keys(baseline.human_baseline_minutes).length > 0);
    assert.ok(baseline.labor_rates_per_hour && Object.keys(baseline.labor_rates_per_hour).length > 0);
    assert.ok(baseline.labor_savings_categories.standard);
    assert.ok(baseline.labor_savings_categories.complex);
});

test('logging-mcp protocol documents InfluxDB and the embedded audit-log shape', () => {
    const protocol = read('mcp-protocols/logging-mcp.md');
    assert.match(protocol, /InfluxDB \(Time-Series Aggregation\)/);
    assert.match(protocol, /Audit Log Embedding/);
    assert.match(protocol, /metadata\.audit_log/);
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

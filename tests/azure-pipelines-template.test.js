// Static checks of the Azure Pipelines coding-loop host template. Text-level,
// like the GitHub workflow assertions in coding-loop-control-hardening.test.js:
// the host must stay thin, fail closed and never expand payload text into a
// script body.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const TEMPLATE = 'templates/ci/azure-pipelines/coding-loop.yml';
const GUIDE = 'docs/examples/azure-devops-coding-loop.md';
const yml = fs.readFileSync(path.join(root, TEMPLATE), 'utf8');

// Every `script:` / `bash:` / `inlineScript:` block-scalar body, as text.
function scriptBodies(text) {
  const lines = text.split('\n');
  const bodies = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^(\s*)(?:- )?(script|bash|inlineScript|powershell|pwsh):\s*(.*)$/);
    if (!m) continue;
    const keyIndent = m[1].length + (lines[i].trimStart().startsWith('- ') ? 2 : 0);
    if (!/^[|>]/.test(m[3])) { bodies.push(m[3]); continue; }
    const body = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j];
      if (line.trim() !== '' && line.length - line.trimStart().length <= keyIndent) break;
      body.push(line);
    }
    bodies.push(body.join('\n'));
  }
  return bodies;
}

const bodies = scriptBodies(yml);

test('azure template: has script bodies to check', () => {
  // Validate, two token mints, run.
  assert.equal(bodies.length, 4, bodies.map((b) => b.slice(0, 40)).join(' | '));
});

test('azure template: no template expression or variable macro inside any script body', () => {
  for (const body of bodies) {
    assert.doesNotMatch(body, /\$\{\{/, 'no ${{ }} template expansion in a script');
    assert.doesNotMatch(body, /\$\[/, 'no $[ ] runtime expression in a script');
    // Azure macro syntax $(Name) / $(Name.Sub). Bash command substitution
    // `$(cmd ...)` starts lower-case and is allowed.
    assert.doesNotMatch(body, /\$\([A-Z][A-Za-z0-9_.-]*\)/, 'no $(Variable) macro in a script');
    assert.doesNotMatch(body, /parameters\./i);
    assert.doesNotMatch(body, /NoemiWorkItemCreated/);
  }
});

test('azure template: payload expressions appear only in the variables block, and only id/project/event', () => {
  const uses = yml.match(/\$\{\{[^}]*parameters\.NoemiWorkItemCreated[^}]*\}\}/g) || [];
  assert.deepEqual(uses.sort(), [
    "${{ parameters.NoemiWorkItemCreated.eventType }}",
    "${{ parameters.NoemiWorkItemCreated.resource.fields['System.TeamProject'] }}",
    '${{ parameters.NoemiWorkItemCreated.resource.id }}',
  ].sort());
  const varsBlock = yml.slice(yml.indexOf('\nvariables:'), yml.indexOf('\njobs:'));
  for (const use of uses) assert.ok(varsBlock.includes(use), `${use} only under variables:`);
  // System.CreatedBy is a display string; identity comes from the API.
  assert.doesNotMatch(yml.replace(/^\s*#.*$/gm, ''), /System\.CreatedBy/);
});

test('azure template: webhook needs workitem.created only; manual runs take a workItemId', () => {
  assert.match(yml, /webhooks:\n\s+- webhook: NoemiWorkItemCreated\n\s+connection: [\w-]+[^\n]*\n\s+filters:\n\s+- path: eventType\n\s+value: workitem\.created/);
  assert.doesNotMatch(yml, /workitem\.(updated|commented)\s*$/m);
  assert.match(yml, /- name: workItemId\n[^\n]*\n\s+type: string\n\s+default: ''/);
  assert.match(yml, /HMAC/, 'header documents the secret requirement');
  assert.match(yml, /^trigger: none$/m);
  assert.match(yml, /^lockBehavior: sequential$/m);
});

test('azure template: inputs are validated by regex before tooling checkout and the CLI', () => {
  const validate = yml.indexOf("displayName: 'Validate inputs'");
  const checkout = yml.indexOf('- checkout: noemi');
  const cli = yml.indexOf('node coding-loop/run.js');
  assert.ok(validate > 0 && validate < checkout && checkout < cli);
  const body = bodies.find((b) => b.includes('RAW_MANUAL_ITEM'));
  assert.ok(body);
  assert.match(body, /id_re='\^\[1-9\]\[0-9\]\{0,9\}\$'/, 'digits-only id');
  assert.match(body, /\[\[ "\$item" =~ \$id_re \]\] \|\| fail/);
  assert.match(body, /RAW_HOOK_PROJECT[^\n]*!= "\$project"/, 'project checked against CODING_LOOP_REPO');
  assert.match(body, /RAW_HOOK_EVENT[^\n]*== "workitem\.created"/);
  // The CLI only ever sees the validated variables.
  const run = bodies.find((b) => b.includes('node coding-loop/run.js'));
  assert.doesNotMatch(run, /RAW_/);
  assert.match(run, /--item "\$NOEMI_ITEM_ID"/);
  assert.match(run, /--requested-by-author/);
  assert.match(yml, /NOEMI_ITEM_ID: \$\(NOEMI_ITEM_ID\)/);
});

test('azure template: System.AccessToken never feeds the conductor or producer', () => {
  const code = yml.replace(/^\s*#.*$/gm, '');
  assert.doesNotMatch(code, /System\.AccessToken/);
  assert.doesNotMatch(code, /SYSTEM_ACCESSTOKEN/);
  assert.match(code, /ADO_CONDUCTOR_TOKEN: \$\(ADO_CONDUCTOR_TOKEN\)/);
  assert.match(code, /ADO_AGENT_TOKEN: \$\(ADO_AGENT_TOKEN\)/);
});

test('azure template: separate conductor and producer service connections, minted via Entra WIF', () => {
  const conductor = yml.match(/- name: NOEMI_CONDUCTOR_CONNECTION\n\s+value: '([^']*)'/);
  const producer = yml.match(/- name: NOEMI_PRODUCER_CONNECTION\n\s+value: '([^']*)'/);
  assert.ok(conductor && producer);
  assert.notEqual(conductor[1], producer[1]);
  assert.match(yml, /azureSubscription: \$\{\{ variables\.NOEMI_CONDUCTOR_CONNECTION \}\}/);
  assert.match(yml, /azureSubscription: \$\{\{ variables\.NOEMI_PRODUCER_CONNECTION \}\}/);
  assert.equal((yml.match(/task: AzureCLI@2/g) || []).length, 2);
  assert.equal((yml.match(/--resource 499b84ac-1321-427f-aa17-267ca6975798/g) || []).length, 2);
  assert.match(yml, /variable=ADO_CONDUCTOR_TOKEN;issecret=true/);
  assert.match(yml, /variable=ADO_AGENT_TOKEN;issecret=true/);
  assert.match(yml, /Conductor and producer must use different service connections/);
});

test('azure template: budget, live critic, post and implement fail closed', () => {
  const run = bodies.find((b) => b.includes('node coding-loop/run.js'));
  assert.match(run, /if \[\[ "\$\{BUDGET_OK:-\}" == "true" \]\]; then\n\s+extra\+=\(--budget-ok\)/);
  assert.match(run, /if \[\[ "\$\{LIVE_CRITIC:-\}" == "true" \]\]; then/);
  assert.match(run, /live-critic requested without AI_GW_API_TOKEN[^\n]*\n\s+exit 1/);
  assert.match(run, /ADO_CONDUCTOR_TOKEN:-\}" \]\]; then\n\s+extra\+=\(--post\)/);
  assert.match(run, /ADO_AGENT_EXPECTED_ID:-\}" \]\]; then[\s\S]*?else\n\s+extra\+=\(--implement\)/);
  // --budget-ok, --post, --implement only ever come from the guarded branches.
  const cliLine = run.slice(run.indexOf('node coding-loop/run.js'));
  assert.doesNotMatch(cliLine, /--budget-ok|--post|--implement|--live-critic/);
  assert.match(yml, /BUDGET_OK: \$\(CODING_LOOP_BUDGET_OK\)/);
  assert.match(yml, /LIVE_CRITIC: \$\(CODING_LOOP_LIVE_CRITIC\)/);
});

test('azure template: Node 24 and tooling from project-noemi/agents', () => {
  assert.match(yml, /task: UseNode@1\n[^\n]*\n\s+inputs:\n\s+version: '24\.x'/);
  assert.match(yml, /repository: noemi\n\s+type: github\n\s+endpoint: [\w-]+[^\n]*\n\s+name: project-noemi\/agents/);
  assert.match(yml, /persistCredentials: false/);
});

test('azure guide: every relative link resolves', () => {
  const guidePath = path.join(root, GUIDE);
  const md = fs.readFileSync(guidePath, 'utf8');
  const links = [...md.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]).filter((l) => !/^[a-z]+:/i.test(l));
  assert.ok(links.length >= 4, 'guide links the README, architecture, schema and template');
  for (const link of links) {
    const file = link.split('#')[0];
    assert.ok(fs.existsSync(path.resolve(path.dirname(guidePath), file)), link);
  }
  assert.ok(links.some((l) => l.endsWith(TEMPLATE.split('/').pop())));
  // The template points back at the guide.
  assert.ok(yml.includes(GUIDE));
});

test('azure template: webhook runs require the operator HMAC attestation before anything else; manual runs do not', () => {
  const body = bodies.find((b) => b.includes('RAW_MANUAL_ITEM'));
  const guard = body.indexOf('[[ "${HMAC_CONFIRMED:-}" == "true" ]] || fail');
  assert.ok(guard > 0, 'guard present');
  // Inside the webhook branch (after the manual-run check), before the event and id checks.
  assert.ok(body.indexOf('if [[ -n "${RAW_MANUAL_ITEM:-}" ]]; then') < guard);
  assert.ok(guard < body.indexOf('RAW_HOOK_EVENT:-}" == "workitem.created"'));
  assert.ok(guard < body.indexOf('[[ "$item" =~ $id_re ]]'));
  assert.match(body, /for v in [^\n]*HMAC_CONFIRMED; do/, 'an undefined variable (literal macro) is unset, so it fails');
  assert.match(yml, /HMAC_CONFIRMED: \$\(CODING_LOOP_WEBHOOK_HMAC_CONFIRMED\)/);
  // The step is the first one that runs.
  assert.ok(yml.indexOf("displayName: 'Validate inputs'") < yml.indexOf('- checkout: noemi'));
  const guide = fs.readFileSync(path.join(root, GUIDE), 'utf8');
  assert.match(guide, /CODING_LOOP_WEBHOOK_HMAC_CONFIRMED/);
  assert.match(guide, /Service connections/);
});

test('azure template: the HMAC guard behaves as written (bash)', (t) => {
  const { spawnSync } = require('child_process');
  const probe = spawnSync('bash', ['-c', 'true']);
  if (probe.error) {
    t.skip('bash not available');
    return;
  }
  const body = bodies.find((b) => b.includes('RAW_MANUAL_ITEM'))
    // Stop after the input checks; the setvariable lines are not needed.
    .replace(/echo "##vso\[task\.setvariable[^\n]*\n/g, '');
  const script = body.split('\n').map((l) => l.replace(/^ {10}/, '')).join('\n');
  const runWith = (env) => spawnSync('bash', ['-c', script], {
    env: {
      PATH: process.env.PATH, REPO_SPEC: 'contoso/Web/api', CONDUCTOR_CONN: 'c', PRODUCER_CONN: 'p', ...env,
    },
    encoding: 'utf8',
  });
  const hook = { RAW_HOOK_ITEM: '42', RAW_HOOK_PROJECT: 'Web', RAW_HOOK_EVENT: 'workitem.created' };
  const missing = runWith({ ...hook, HMAC_CONFIRMED: '$(CODING_LOOP_WEBHOOK_HMAC_CONFIRMED)' });
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /CODING_LOOP_WEBHOOK_HMAC_CONFIRMED=true/);
  assert.equal(runWith({ ...hook, HMAC_CONFIRMED: 'yes' }).status, 1);
  assert.equal(runWith({ ...hook, HMAC_CONFIRMED: 'true' }).status, 0);
  assert.equal(runWith({ RAW_MANUAL_ITEM: '42' }).status, 0, 'manual runs need no attestation');
});

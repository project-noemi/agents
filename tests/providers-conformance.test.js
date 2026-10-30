'use strict';

/**
 * Forge provider conformance. Each provider plugs its own fake forge into
 * tests/helpers/provider-conformance.js. GitHub runs through the real gh()
 * client (so retry rules are the production ones) over a fetch-level fake.
 */

const { runConformance } = require('./helpers/provider-conformance.js');
const { createFakeGitHub } = require('./helpers/fake-github.js');
const { createGithubProvider } = require('../coding-loop/providers/github/index.js');

// gh() reads the retry base at call time; keep retried GETs fast.
process.env.GITHUB_RETRY_BASE_MS = '1';

const CONDUCTOR = 'ghs_conductor_fake_value';
const PRODUCER = 'github_pat_producer_fake_value';

runConformance({
  name: 'github',
  makeHarness() {
    const fake = createFakeGitHub({ owner: 'acme', name: 'widgets' });
    fake.tokens.set(CONDUCTOR, 'noemi-conductor[bot]');
    fake.tokens.set(PRODUCER, 'noemi-agent');
    fake.seedIssue(12, { login: 'alice' });
    fake.seedIssue(13, { login: 'renovate[bot]', type: 'Bot' });
    fake.seedIssue(14, { labels: ['noemi:queued', 'bug'] });
    const provider = createGithubProvider({ fetchImpl: fake.fetchImpl });
    const ref = provider.parseRepo('acme/widgets', { env: {} });
    return {
      provider,
      ref,
      parseCases: {
        valid: [
          ['acme/widgets', 'github:acme/widgets'],
          ['github:Acme/Widgets', 'github:acme/widgets'],
          ['gh:acme/widgets', 'github:acme/widgets'],
          ['https://github.com/acme/widgets', 'github:acme/widgets'],
          ['https://github.com/acme/widgets.git', 'github:acme/widgets'],
        ],
        invalid: [
          '', 'acme', 'acme/widgets/extra', '../etc/passwd', 'acme/wid gets', 'azure-devops:o/p/r',
          'http://github.com/acme/widgets', 'https://gitlab.com/acme/widgets', 'https://github.com/acme/widgets/issues/1',
          'https://u:p@github.com/acme/widgets',
        ],
      },
      env: {
        none: {},
        conductor: { CONDUCTOR_GH_TOKEN: CONDUCTOR },
        reader: { CONDUCTOR_GH_TOKEN: CONDUCTOR },
        producer: { AGENT_GH_TOKEN: PRODUCER },
        conductorAsProducer: { CONDUCTOR_GH_TOKEN: CONDUCTOR, AGENT_GH_TOKEN: CONDUCTOR },
      },
      secrets: [CONDUCTOR, PRODUCER],
      humanItem: '12',
      botItem: '13',
      labelledItem: '14',
      seedFile(path, content, { executable = false } = {}) {
        fake.seedBase({ [path]: { content, executable } });
      },
      seedForeignBranch(head) {
        fake.seedBranch(head, { 'other.txt': 'someone else\n' });
      },
      fail(op, status) {
        fake.fail(op === 'commit' ? 'commit-object' : op, status);
      },
      attempts(op) {
        return fake.attempts.get(op) || 0;
      },
      branchExists: (name) => fake.branchExists(name),
      fileAt(branch, path) {
        const files = fake.filesAt(branch);
        const file = files && files[path];
        return file ? { content: file.content, executable: file.mode === '100755' } : null;
      },
      itemLabels: (id) => fake.issueLabels(id),
      grantPermission: (login, permission) => fake.permissions.set(login, permission),
      tenantOwnerEntry: 'acme',
      capabilities: { executableBit: true },
    };
  },
});

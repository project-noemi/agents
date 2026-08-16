const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(
    path.join(__dirname, '..', 'scripts', 'deploy-ai-review.sh'),
    'utf8',
);

test('deploy: prefers develop, then dev, and never opens a caller PR against main', () => {
    assert.match(script, /integration_branch\(\)/);
    assert.match(script, /git\/ref\/heads\/develop/);
    assert.match(script, /git\/ref\/heads\/dev/);
    assert.match(script, /PHASE0_TITLE=/);
    assert.match(script, /require-develop-source/);
    assert.match(script, /--base "\$target"/);
    assert.doesNotMatch(script, /--base "\$default_branch"/);
});

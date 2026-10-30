'use strict';

/**
 * Skeleton for a new forge provider. NOT registered, and never will be by
 * existing: providers/index.js registers each provider by name.
 *
 * To add a forge:
 *   1. Copy this directory to coding-loop/providers/<id>/ and set ID/LABEL.
 *   2. Export `create<Forge>Provider({ ...transport seams })` and a default
 *      `provider` instance, like providers/github/index.js. Every network
 *      call must go through an injectable seam so the conformance suite can
 *      run it against a fake.
 *   3. Replace every `notImplemented` below. Keep the security property
 *      each comment names; the core relies on it and does not re-check.
 *   4. Plug the provider into tests/helpers/provider-conformance.js with a
 *      fake of your forge (see tests/providers-conformance.test.js).
 *   5. Add `registerProvider(require('./<id>/index.js').provider)` in
 *      providers/index.js.
 *
 * Contract: providers/contract.js. Path rules and carve-outs are NOT per
 * provider: they are the union in coding-loop/paths.js. If your forge has a
 * new CI or governance file, add it there.
 */

const { providerError } = require('../contract.js');

const ID = 'example-forge';
const LABEL = 'Example Forge';

function notImplemented(method) {
  return providerError(`${ID}.${method} is not implemented`, 501, 'not-implemented');
}

function createTemplateProvider() {
  return {
    id: ID,
    label: LABEL,
    // Informational only: paths this forge treats as CI / governance.
    carveOutHints: [],

    // → RepoRef (contract.makeRepoRef) or null when the input is not this
    // forge. Accept `<id>:…` and your web URLs. Allow-list every segment
    // (no `..`, `%`, `/` inside a segment): the slug becomes a URL path.
    parseRepo(input, opts) { throw notImplemented('parseRepo'); },

    // → positive integer string. Throw status 400 for anything else; the id
    // is interpolated into API paths.
    parseItemId(input) { throw notImplemented('parseItemId'); },

    // → human reference for logs and refusals, e.g. `org/project/repo#12`.
    itemDisplay(ref, id) { throw notImplemented('itemDisplay'); },

    // → the line that links the change request to the item. `closes: false`
    // must NOT auto-close the item on merge (Decision [2026-10-05-0001]).
    closingLine(id, { closes } = {}) { throw notImplemented('closingLine'); },

    // → head branch name for the item (`noemi/issue-<id>`). Must pass
    // paths.isSafeRepoPath.
    branchForItem(id) { throw notImplemented('branchForItem'); },

    // role 'conductor' | 'producer' | 'reader' → opaque cred or null.
    // Identity split: the producer credential must be refused when it is the
    // conductor's; the conductor never opens change requests. Never put the
    // secret in an enumerable property (audit lines must not carry it).
    async resolveCredential({ role, ref, env, deps } = {}) { throw notImplemented('resolveCredential'); },

    // → { id, login } of the credential's identity. dispatch compares login
    // with expectedProducerLogin before any write.
    async whoAmI(ref, cred) { throw notImplemented('whoAmI'); },

    // → the login the producer credential must resolve to.
    expectedProducerLogin(env) { throw notImplemented('expectedProducerLogin'); },

    // → WorkItem. bodyFormat 'markdown' (convert HTML first); text a human
    // cannot see but a model could goes in hiddenText (it is scanned).
    // repoKey must come from the forge's response, not from `ref`, so a
    // renamed or moved repository is refused.
    async getItem(ref, id, cred) { throw notImplemented('getItem'); },

    // Post once. Do NOT retry on 5xx: the write may have landed.
    async postComment(ref, id, markdown, cred) { throw notImplemented('postComment'); },

    // Keep exactly one `noemi:*` label/tag: add the new one FIRST, then
    // remove the others, so a mid-way failure never leaves none.
    async syncLoopLabel(ref, item, label, cred) { throw notImplemented('syncLoopLabel'); },

    // → null when the tenant lists the owner; else { grant: { accountId,
    // suspended }, client } or { error }. Any lookup failure is { error },
    // never an allow.
    async resolveEntitlement({ ref, tenant, env, deps } = {}) { throw notImplemented('resolveEntitlement'); },

    // → { login, permission: admin|maintain|write|read|none } or
    // { login, error }. Unknown user is 'none'; a failed lookup is error.
    async requesterPermission(ref, login, cred) { throw notImplemented('requesterPermission'); },

    // → existing integration branches, preference order (develop, dev).
    // Exact-name lookups, not prefix matches.
    async listIntegrationBranches(ref, cred) { throw notImplemented('listIntegrationBranches'); },

    // → { content, mode } | { missing: true } | { notFile: true }. Build
    // the URL with paths.encodeRepoPath (it refuses unsafe paths).
    async readFile(ref, path, gitRef, cred) { throw notImplemented('readFile'); },

    // → { status: created|resumed|head-exists|missing-base, sha }.
    // Atomic: nothing visible on the forge until the whole change is (create
    // the branch last, or push one commit). Re-check isSafeRepoPath and
    // isCarvedOut. Same content already on `head` → resumed; different →
    // head-exists, never overwrite. Preserve an existing file's executable
    // bit; never write a symlink.
    async commitFiles(ref, { base, head, files, message } = {}, cred) { throw notImplemented('commitFiles'); },

    // → { url, number, existing }. A conflict with an open change request
    // for the same head returns that one with existing: true.
    async openChangeRequest(ref, { base, head, title, body, itemId } = {}, cred) {
      throw notImplemented('openChangeRequest');
    },

    // → true for service accounts / apps; intake skips their items.
    isBotIdentity(author) { throw notImplemented('isBotIdentity'); },
  };
}

module.exports = {
  createTemplateProvider,
  provider: createTemplateProvider(),
};

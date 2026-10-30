'use strict';

/**
 * In-memory GitHub REST fake at the fetch() level, so the provider runs
 * through the real scripts/github-client.js gh() — including its
 * method-aware retry rules. Covers only the endpoints the coding-loop
 * provider calls. Git objects are content-addressed like the real thing, so
 * the same files produce the same tree sha (resume) and refs point at
 * commits (atomic visibility).
 */

const crypto = require('crypto');

const API = 'https://api.github.com';

function sha(value) {
  return crypto.createHash('sha1').update(JSON.stringify(value)).digest('hex');
}

function json(status, body) {
  if (status === 204) return new Response(null, { status });
  return new Response(JSON.stringify(body === undefined ? {} : body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createFakeGitHub({ owner = 'acme', name = 'widgets' } = {}) {
  const slug = `${owner}/${name}`;
  const blobs = new Map();
  const trees = new Map();
  const commits = new Map();
  const refs = new Map();
  const issues = new Map();
  const comments = [];
  const pulls = [];
  const permissions = new Map();
  const tokens = new Map();
  const failures = new Map();
  const attempts = new Map();

  /** Flat { path: { mode, content } } → nested trees; returns root sha. */
  function writeTree(flat) {
    const dirs = new Map([['', []]]);
    const ensureDir = (dir) => {
      if (dirs.has(dir)) return;
      const parent = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
      ensureDir(parent);
      dirs.set(dir, []);
      dirs.get(parent).push({ name: dir.split('/').pop(), dir });
    };
    for (const filePath of Object.keys(flat)) {
      const dir = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';
      ensureDir(dir);
    }
    const build = (dir) => {
      const entries = [];
      for (const child of dirs.get(dir)) {
        entries.push({ path: child.name, mode: '040000', type: 'tree', sha: build(child.dir) });
      }
      for (const [filePath, file] of Object.entries(flat)) {
        const fileDir = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';
        if (fileDir !== dir) continue;
        const blobSha = sha(['blob', file.content]);
        blobs.set(blobSha, file.content);
        entries.push({ path: filePath.split('/').pop(), mode: file.mode, type: 'blob', sha: blobSha });
      }
      entries.sort((a, b) => a.path.localeCompare(b.path));
      const treeSha = sha(['tree', entries]);
      trees.set(treeSha, entries);
      return treeSha;
    };
    return build('');
  }

  function flatten(treeSha, prefix = '', out = {}) {
    for (const entry of trees.get(treeSha) || []) {
      const full = prefix ? `${prefix}/${entry.path}` : entry.path;
      if (entry.type === 'tree') flatten(entry.sha, full, out);
      else out[full] = { mode: entry.mode, content: blobs.get(entry.sha) };
    }
    return out;
  }

  function commitTree(flat, message = 'seed', parents = []) {
    const tree = writeTree(flat);
    const commitSha = sha(['commit', tree, parents, message]);
    commits.set(commitSha, { sha: commitSha, tree: { sha: tree }, parents: parents.map((p) => ({ sha: p })), message });
    return commitSha;
  }

  function filesAt(branch) {
    const head = refs.get(branch);
    if (!head) return null;
    return flatten(commits.get(head).tree.sha);
  }

  // Seed: develop with a README.
  refs.set('develop', commitTree({ 'README.md': { mode: '100644', content: '# widgets\n' } }));

  function shouldFail(op) {
    const status = failures.get(op);
    return status ? json(status, { message: `injected ${status}` }) : null;
  }

  function bump(op) {
    attempts.set(op, (attempts.get(op) || 0) + 1);
  }

  async function fetchImpl(url, init = {}) {
    const method = String(init.method || 'GET').toUpperCase();
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname);
    const auth = String((init.headers && init.headers.Authorization) || '');
    const token = auth.replace(/^Bearer /, '');
    const body = init.body ? JSON.parse(init.body) : undefined;
    const repo = `/repos/${slug}`;

    if (path === '/user') {
      const login = tokens.get(token);
      return login ? json(200, { login, id: login.length }) : json(401, { message: 'Bad credentials' });
    }
    if (!path.startsWith(repo)) return json(404, { message: 'Not Found' });
    const rest = path.slice(repo.length);

    let m = /^\/issues\/(\d+)$/.exec(rest);
    if (m && method === 'GET') {
      const issue = issues.get(m[1]);
      return issue ? json(200, issue) : json(404, { message: 'Not Found' });
    }
    m = /^\/issues\/(\d+)\/comments$/.exec(rest);
    if (m && method === 'POST') {
      bump('comment');
      const failed = shouldFail('comment');
      if (failed) return failed;
      comments.push({ issue: m[1], body: body.body });
      return json(201, { id: comments.length });
    }
    m = /^\/issues\/(\d+)\/labels$/.exec(rest);
    if (m && method === 'POST') {
      const issue = issues.get(m[1]);
      for (const label of body.labels) {
        if (!issue.labels.some((l) => l.name === label)) issue.labels.push({ name: label });
      }
      return json(200, issue.labels);
    }
    m = /^\/issues\/(\d+)\/labels\/(.+)$/.exec(rest);
    if (m && method === 'DELETE') {
      const issue = issues.get(m[1]);
      const before = issue.labels.length;
      issue.labels = issue.labels.filter((l) => l.name !== m[2]);
      return before === issue.labels.length ? json(404, { message: 'Label does not exist' }) : json(200, issue.labels);
    }
    m = /^\/collaborators\/([^/]+)\/permission$/.exec(rest);
    if (m && method === 'GET') {
      const failed = shouldFail('permission');
      if (failed) return failed;
      const permission = permissions.get(m[1]);
      return permission ? json(200, { permission }) : json(404, { message: 'Not Found' });
    }
    m = /^\/git\/ref\/heads\/(.+)$/.exec(rest);
    if (m && method === 'GET') {
      const at = refs.get(m[1]);
      return at ? json(200, { ref: `refs/heads/${m[1]}`, object: { sha: at } }) : json(404, { message: 'Not Found' });
    }
    m = /^\/git\/commits\/([0-9a-f]+)$/.exec(rest);
    if (m && method === 'GET') {
      const commit = commits.get(m[1]);
      return commit ? json(200, commit) : json(404, { message: 'Not Found' });
    }
    m = /^\/git\/trees\/([0-9a-f]+)$/.exec(rest);
    if (m && method === 'GET') {
      const entries = trees.get(m[1]);
      return entries ? json(200, { sha: m[1], tree: entries, truncated: false }) : json(404, { message: 'Not Found' });
    }
    if (rest === '/git/trees' && method === 'POST') {
      const flat = flatten(body.base_tree);
      for (const entry of body.tree) flat[entry.path] = { mode: entry.mode, content: entry.content };
      return json(201, { sha: writeTree(flat) });
    }
    if (rest === '/git/commits' && method === 'POST') {
      const failed = shouldFail('commit-object');
      if (failed) return failed;
      const commitSha = sha(['commit', body.tree, body.parents, body.message]);
      commits.set(commitSha, {
        sha: commitSha, tree: { sha: body.tree }, parents: body.parents.map((p) => ({ sha: p })), message: body.message,
      });
      return json(201, { sha: commitSha });
    }
    if (rest === '/git/refs' && method === 'POST') {
      const branch = body.ref.replace(/^refs\/heads\//, '');
      if (refs.has(branch)) return json(422, { message: 'Reference already exists' });
      refs.set(branch, body.sha);
      return json(201, { ref: body.ref });
    }
    m = /^\/contents\/(.+)$/.exec(rest);
    if (m && method === 'GET') {
      const files = filesAt(parsed.searchParams.get('ref'));
      if (!files) return json(404, { message: 'No commit found for the ref' });
      const target = m[1];
      if (files[target]) {
        return json(200, {
          type: 'file', encoding: 'base64', path: target, content: Buffer.from(files[target].content).toString('base64'),
        });
      }
      const children = Object.keys(files).filter((p) => p.startsWith(`${target}/`));
      return children.length ? json(200, children.map((p) => ({ type: 'file', path: p }))) : json(404, { message: 'Not Found' });
    }
    if (rest === '/pulls' && method === 'POST') {
      if (pulls.some((pr) => pr.head === body.head && pr.state === 'open')) {
        return json(422, { message: 'A pull request already exists' });
      }
      const number = 100 + pulls.length;
      const pr = {
        number, head: body.head, base: body.base, title: body.title, body: body.body, state: 'open',
        html_url: `https://github.com/${slug}/pull/${number}`,
      };
      pulls.push(pr);
      return json(201, pr);
    }
    if (rest === '/pulls' && method === 'GET') {
      const head = parsed.searchParams.get('head');
      return json(200, pulls.filter((pr) => pr.state === 'open' && `${owner}:${pr.head}` === head));
    }
    return json(404, { message: `fake has no route for ${method} ${rest}` });
  }

  return {
    API,
    owner,
    name,
    slug,
    fetchImpl,
    tokens,
    permissions,
    comments,
    pulls,
    attempts,
    seedIssue(id, {
      title = 'Title', body = 'Body', login = 'alice', type = 'User', labels = [],
    } = {}) {
      issues.set(String(id), {
        number: Number(id),
        title,
        body,
        user: { login, id: 7, type },
        labels: labels.map((n) => ({ name: n })),
        updated_at: '2026-10-27T10:00:00Z',
        repository_url: `${API}/repos/${slug}`,
        html_url: `https://github.com/${slug}/issues/${id}`,
      });
    },
    issueLabels(id) {
      return issues.get(String(id)).labels.map((l) => l.name);
    },
    /** Replace develop with these files ({ path: { content, executable } }). */
    seedBase(files) {
      const flat = { ...filesAt('develop') };
      for (const [p, f] of Object.entries(files)) {
        flat[p] = { mode: f.executable ? '100755' : '100644', content: f.content };
      }
      refs.set('develop', commitTree(flat, 'seed', [refs.get('develop')]));
    },
    seedBranch(branch, files) {
      const flat = { ...filesAt('develop') };
      for (const [p, content] of Object.entries(files)) flat[p] = { mode: '100644', content };
      refs.set(branch, commitTree(flat, `seed ${branch}`, [refs.get('develop')]));
    },
    branchExists(branch) {
      return refs.has(branch);
    },
    filesAt,
    fail(op, status) {
      failures.set(op, status);
    },
    clearFailures() {
      failures.clear();
    },
  };
}

module.exports = { createFakeGitHub };

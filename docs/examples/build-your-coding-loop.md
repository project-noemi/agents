# Build Your Own Coding Loop

This is the organization path: take the public blueprint and run a coding
loop in **your** private `{company}-agents` repository.

The full checklist lives with the runtime:

**[`coding-loop/README.md`](../../coding-loop/README.md)**

In short:

1. Copy `project-noemi/agents` to `{org}/{org}-agents` (NewPush: `newpush/newpush-agents`).
2. Sync `coding-loop/` from upstream. Do not design the loop only in the private copy.
3. Fill `tenants/` with your orgs and spend caps — not the runner source.
4. Provision a conductor identity that can comment, not push code.
5. Dry-run `node coding-loop/run.js --repo org/name --issue N`.
6. Enable pickup on one repo after skip / budget / scan brakes exist.

Related:

- Architecture: [`../architecture/issue-coding-loop.md`](../architecture/issue-coding-loop.md)
- Upstream sync: [`../UPSTREAM_SYNC.md`](../UPSTREAM_SYNC.md)
- First local agent (not the loop): [`zero-to-first-agent.md`](zero-to-first-agent.md)

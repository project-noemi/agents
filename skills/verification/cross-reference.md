# Cross-Reference — Verification Skill

## Purpose
Verify that a claimed action actually occurred by checking it against an authoritative source of truth. This skill addresses the trust gap between what an agent _reports_ it did and what _actually happened_ in the target system. Used by dashboards, auditors, and any agent that consumes reports from other agents.

## Inputs
- **claims** — List of claimed actions to verify, each with:
  - `type` — The action type (e.g., "pr_merged", "pr_closed", "label_added", "file_created")
  - `identifier` — Resource identifier (e.g., repo + PR number, file path)
  - `expected_state` — What the source of truth should show if the claim is true
- **source_of_truth** — The system to verify against (e.g., GitHub API, filesystem, database)
- **batch_size** — Max claims to verify per cycle (to respect rate limits)

## Procedure
1. **Queue claims** — Accept claims and mark each as `pending`.
2. **Batch verify** — For each claim up to `batch_size`:
   a. Query the source of truth for the current state of the resource.
   b. Compare the actual state against `expected_state`.
   c. Mark the claim as `verified` (match), `mismatch` (contradiction), or `unverifiable` (no method available).
3. **Record evidence** — For each verification, store the query result and timestamp as audit evidence.
4. **Flag mismatches** — Any `mismatch` result triggers an anomaly alert with expected vs. actual values.
5. **Return results** — Provide per-claim verification status.

## Outputs
- **results** — List of verification outcomes per claim
- **summary** — Counts of verified, mismatch, unverifiable, and pending claims

```json
{
  "results": [
    { "type": "pr_merged", "identifier": "org/repo#42", "status": "verified", "evidence": "merged=true, sha=abc123" },
    { "type": "label_added", "identifier": "org/repo#43", "status": "mismatch", "expected": "needs-review", "actual": "no matching label" }
  ],
  "summary": { "verified": 1, "mismatch": 1, "unverifiable": 0, "pending": 0 }
}
```

## MCP Dependencies
- Depends on the MCP for the source of truth being queried (e.g., `github` MCP for PR verification)

## Boundaries
- **Always:** Respect rate limits on the source of truth API. Record evidence for every verification. Flag all mismatches immediately.
- **Ask First:** Increasing batch_size beyond the default. Marking a mismatch as "resolved" without investigation.
- **Never:** Modify the source of truth during verification. Silently ignore mismatches. Assume a claim is true without querying.

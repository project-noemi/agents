#!/usr/bin/env bash
# scripts/sync-upstream.sh
# Hardened upstream sync for AI agents and humans.
#
# Opens a REVIEWED pull request that brings upstream improvements into our
# private fork's `develop` branch.
#
#  - Conflicting upstream hunks are auto-resolved in favour of OUR customizations
#    (-X ours), but every file where that happened is surfaced in the PR body so
#    a human can see what upstream change was dropped.
#  - Structural conflicts (modify/delete, rename) that -X ours cannot take stop
#    the run for manual resolution. Resolve, commit, then resume with --continue.
#
# Usage:
#   ./scripts/sync-upstream.sh             # detect drift, merge, open PR
#   ./scripts/sync-upstream.sh --dry-run   # report drift only; change nothing
#   ./scripts/sync-upstream.sh --continue  # resume after resolving a conflict
#
set -euo pipefail

# --- Config ----------------------------------------------------------------
# Cross-organization parameterization (Decision [2026-06-19-0002]): org-specific
# values are read from the environment with defaults that preserve upstream
# behavior, so a clean fork runs unmodified and forks never have to patch source.
UPSTREAM_REMOTE="${NOEMI_UPSTREAM_REMOTE:-upstream}"
UPSTREAM_URL="${NOEMI_UPSTREAM_URL:-https://github.com/project-noemi/agents.git}"
TARGET_BRANCH="${NOEMI_LOCAL_BRANCH:-develop}"   # PR base — ALWAYS our private develop
UPSTREAM_BRANCHES=("main" "develop")             # merge order: stable baseline first

# --- TTY / pager guards (prevent agent hangs) ------------------------------
export GH_PROMPT_DISABLED=1
export GH_PAGER=cat
export GIT_TERMINAL_PROMPT=0
export GIT_PAGER=cat

# --- Pretty output ---------------------------------------------------------
info() { printf "\033[1;34m▸ %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m✔ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m⚠ %s\033[0m\n" "$*"; }
err()  { printf "\033[1;31m✘ %s\033[0m\n" "$*" >&2; }

# --- Parse mode ------------------------------------------------------------
MODE="run"
case "${1:-}" in
  --dry-run)  MODE="dry-run" ;;
  --continue) MODE="continue" ;;
  "")         MODE="run" ;;
  *) err "Unknown argument: $1"; echo "Usage: $0 [--dry-run|--continue]" >&2; exit 2 ;;
esac

# --- Dependency / repo checks ----------------------------------------------
command -v git >/dev/null || { err "git not found."; exit 1; }
command -v gh  >/dev/null || { err "GitHub CLI (gh) not found or not on PATH. Install and authenticate it first."; exit 1; }
git rev-parse --git-dir >/dev/null 2>&1 || { err "Not inside a git repository."; exit 1; }

GIT_DIR="$(git rev-parse --absolute-git-dir)"
OVR_FILE="$GIT_DIR/.sync-upstream-overridden"   # scratch list; lives in .git, never committed

echo "🚀 Upstream sync (${MODE})..."

# --- Sanitizer: printable ASCII only, strip backticks, cap 50 lines --------
# (Backtick strip also prevents a log line from closing the ```text fences.)
sanitize() { tr -cd '\011\012\040-\176' | tr -d '\`' | head -n 50; }

# --- Ensure upstream remote, fetch -----------------------------------------
if ! git remote get-url "$UPSTREAM_REMOTE" &>/dev/null; then
    info "Adding upstream remote: $UPSTREAM_URL"
    git remote add "$UPSTREAM_REMOTE" "$UPSTREAM_URL"
fi
info "Fetching origin and upstream..."
git fetch origin --prune --quiet
git fetch "$UPSTREAM_REMOTE" --prune --quiet

# ===========================================================================
# CONTINUE MODE — resume an in-progress sync after manual conflict resolution
# ===========================================================================
if [[ "$MODE" == "continue" ]]; then
    CUR="$(git branch --show-current)"
    [[ "$CUR" == sync/upstream-* ]] || { err "--continue must run on a sync/upstream-* branch (currently on '$CUR')."; exit 1; }
    [[ -e "$GIT_DIR/MERGE_HEAD" ]] && { err "A merge is still in progress. Finish it: 'git add -A && git commit', then re-run --continue."; exit 1; }
    [[ -n "$(git status --porcelain --untracked-files=no)" ]] && { err "Tracked changes are uncommitted. Commit them, then re-run --continue."; exit 1; }
    SYNC_BRANCH="$CUR"
    info "Resuming on $SYNC_BRANCH"
    [[ -f "$OVR_FILE" ]] || : > "$OVR_FILE"   # keep prior findings if present
else
    # =======================================================================
    # PREFLIGHT (run / dry-run)
    # =======================================================================
    if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
        err "Working tree is dirty (tracked files). Commit or stash first."
        exit 1
    fi

    # --- Duplicate guard (paginated; surfaces auth/network errors) ---
    EXISTING_PR="$(gh pr list --state open --limit 1000 --json headRefName,url \
        --jq '.[] | select(.headRefName | startswith("sync/upstream-")) | .url')"
    if [[ -n "$EXISTING_PR" ]]; then
        echo "🛑 An open sync PR already exists:"
        echo "$EXISTING_PR"
        echo "Review/merge or close it before opening another."
        exit 1
    fi

    # --- Drift report ---
    LOG_MAIN="$(git log --oneline "HEAD..${UPSTREAM_REMOTE}/main"    2>/dev/null | sanitize || true)"
    LOG_DEV="$( git log --oneline "HEAD..${UPSTREAM_REMOTE}/develop" 2>/dev/null | sanitize || true)"
    if [[ -z "$LOG_MAIN" && -z "$LOG_DEV" ]]; then
        ok "No upstream drift detected. Already up to date."
        exit 0
    fi
    info "Drift detected:"
    [[ -n "$LOG_MAIN" ]] && { echo "  upstream/main:";    echo "$LOG_MAIN" | sed 's/^/    /'; }
    [[ -n "$LOG_DEV"  ]] && { echo "  upstream/develop:"; echo "$LOG_DEV"  | sed 's/^/    /'; }

    if [[ "$MODE" == "dry-run" ]]; then
        warn "Dry run only. Re-run without --dry-run to sync."
        exit 0
    fi

    # --- Collision-safe branch name (local AND remote) ---
    DATE_STR="$(date +%Y-%m-%d)"
    BASE_SYNC_NAME="sync/upstream-${DATE_STR}"
    SYNC_BRANCH="$BASE_SYNC_NAME"
    COUNTER=2
    while git show-ref --verify --quiet "refs/heads/$SYNC_BRANCH" \
       || git ls-remote --exit-code --heads origin "$SYNC_BRANCH" &>/dev/null; do
        SYNC_BRANCH="${BASE_SYNC_NAME}-${COUNTER}"
        COUNTER=$((COUNTER + 1))          # safe under `set -e` (never evaluates to 0)
    done
    info "Creating sync branch: $SYNC_BRANCH (from origin/${TARGET_BRANCH})"
    git checkout -b "$SYNC_BRANCH" "origin/${TARGET_BRANCH}"
    : > "$OVR_FILE"                        # fresh run: reset overridden-files list
fi

# ===========================================================================
# MERGE LOOP — shared by run + continue; idempotent (skips already-merged)
# ===========================================================================
for branch in "${UPSTREAM_BRANCHES[@]}"; do
    ref="${UPSTREAM_REMOTE}/${branch}"
    if ! git rev-parse --verify --quiet "$ref" >/dev/null; then
        warn "$ref does not exist upstream; skipping."
        continue
    fi
    if [[ -z "$(git log --oneline "HEAD..$ref" 2>/dev/null)" ]]; then
        ok "$ref already merged; skipping."
        continue
    fi

    # 1) Detect what a normal merge would conflict on (no tree left behind).
    info "Checking $ref for conflicts (trial merge)..."
    git merge --no-commit --no-ff "$ref" >/dev/null 2>&1 || true
    CONFLICTED="$(git diff --name-only --diff-filter=U 2>/dev/null || true)"
    git merge --abort 2>/dev/null || true

    # 2) Real merge, auto-resolving conflicting hunks in our favour.
    info "Merging $ref (-X ours)..."
    if git merge "$ref" -X ours -m "Merge $ref into $SYNC_BRANCH"; then
        # Clean after auto-resolution: record any files we silently overrode.
        [[ -n "$CONFLICTED" ]] && printf '%s\n' "$CONFLICTED" >> "$OVR_FILE"
        ok "$ref merged."
    else
        err "Structural conflict on $ref that -X ours cannot take (e.g. modify/delete or rename)."
        echo "" >&2
        echo "Resolve, then resume:" >&2
        echo "  # edit conflicts (keep our logic; for modify/delete decide if the file stays)" >&2
        echo "  git add -A && git commit" >&2
        echo "  ./scripts/sync-upstream.sh --continue   # NOT a bare re-run — that starts a new branch" >&2
        exit 1
    fi
done

# --- Did anything actually change? -----------------------------------------
if [[ -z "$(git log --oneline "origin/${TARGET_BRANCH}..HEAD" 2>/dev/null)" ]]; then
    warn "Sync branch has no changes over origin/${TARGET_BRANCH}. Nothing to open a PR for."
    exit 0
fi

# --- Push ------------------------------------------------------------------
info "Pushing $SYNC_BRANCH to origin..."
git push -u origin "$SYNC_BRANCH" --quiet

# ===========================================================================
# PR BODY
# ===========================================================================
DATE_STR="${DATE_STR:-$(date +%Y-%m-%d)}"
LOG_MAIN="$(git log --oneline "origin/${TARGET_BRANCH}..${UPSTREAM_REMOTE}/main"    2>/dev/null | sanitize || true)"
LOG_DEV="$( git log --oneline "origin/${TARGET_BRANCH}..${UPSTREAM_REMOTE}/develop" 2>/dev/null | sanitize || true)"
FILE_SUMMARY="$(git diff --stat "origin/${TARGET_BRANCH}...$SYNC_BRANCH" 2>/dev/null | sanitize || true)"
OVERRIDDEN="$(sort -u "$OVR_FILE" 2>/dev/null | grep -v '^[[:space:]]*$' | sanitize || true)"

PR_BODY_FILE="$(mktemp)"
trap 'rm -f "$PR_BODY_FILE"' EXIT

cat > "$PR_BODY_FILE" <<EOF
## 🔄 Upstream sync ($DATE_STR)

Brings improvements from upstream \`project-noemi/agents\` into \`$TARGET_BRANCH\`.

### Merge strategy
- Order: \`upstream/main\` then \`upstream/develop\` (stable baseline first).
- Conflicting upstream hunks were auto-resolved in favour of our customizations (\`-X ours\`).
- Any structural conflicts were resolved manually before this PR was opened.
EOF

if [[ -n "$OVERRIDDEN" ]]; then
cat >> "$PR_BODY_FILE" <<EOF

### ⚠️ Upstream changes overridden — REVIEW THESE
These files had upstream edits on lines we also customized. Our version was kept
and the upstream change was **dropped**. Confirm none of these is an upstream fix
we actually want:
\`\`\`text
$OVERRIDDEN
\`\`\`
EOF
else
cat >> "$PR_BODY_FILE" <<EOF

### ✅ No upstream changes overridden
No upstream edits collided with our customizations.
EOF
fi

cat >> "$PR_BODY_FILE" <<EOF

### Files changed in this PR
\`\`\`text
${FILE_SUMMARY:-No file changes detected.}
\`\`\`

### Upstream commits included
<details><summary>From upstream/main</summary>

\`\`\`text
${LOG_MAIN:-No new commits.}
\`\`\`
</details>
<details><summary>From upstream/develop</summary>

\`\`\`text
${LOG_DEV:-No new commits.}
\`\`\`
</details>

### Reviewer checklist
- [ ] No local customization was lost (see the "overridden" section above).
- [ ] Upstream fixes we want are actually present.
- [ ] Build / tests pass on this branch.
EOF

info "Opening pull request (base: $TARGET_BRANCH)..."
PR_URL="$(gh pr create \
    --base "$TARGET_BRANCH" \
    --head "$SYNC_BRANCH" \
    --title "Upstream sync: project-noemi/agents → ${TARGET_BRANCH} (${DATE_STR})" \
    --body-file "$PR_BODY_FILE")"

rm -f "$OVR_FILE"
ok "PR created: $PR_URL"
[[ -n "$OVERRIDDEN" ]] && warn "This PR overrode upstream changes in some files — see the PR's 'overridden' section."
echo "$PR_URL"

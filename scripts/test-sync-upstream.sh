#!/usr/bin/env bash
# test-sync-upstream.sh — offline test harness for scripts/sync-upstream.sh
#
# Builds a synthetic upstream (project-noemi/agents) and a private fork, stubs
# the GitHub CLI, and verifies:
#   1. content conflicts are auto-resolved in our favour AND surfaced in the PR body
#   2. structural conflicts stop the run, and --continue completes it (no orphan branch)
#   3. dry-run + duplicate-guard regressions still pass
#
# Usage:  ./test-sync-upstream.sh [path/to/sync-upstream.sh]
#         (defaults to ./scripts/sync-upstream.sh)
#
# No network or real gh/auth required.
set -uo pipefail

SCRIPT="$(cd "$(dirname "${1:-./scripts/sync-upstream.sh}")" && pwd)/$(basename "${1:-./scripts/sync-upstream.sh}")"
[[ -f "$SCRIPT" ]] || { echo "Script not found: $SCRIPT"; exit 2; }

ROOT="$(mktemp -d)"; trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT/bin"; export PATH="$ROOT/bin:$PATH"
FAILED=0

# --- gh stub ---------------------------------------------------------------
cat > "$ROOT/bin/gh" <<STUB
#!/usr/bin/env bash
sub="\$1 \$2"
if [[ "\$sub" == "pr list" ]]; then
  [[ "\${FAKE_EXISTING_PR:-}" == "1" ]] && echo "https://example/pull/99"
  exit 0
fi
if [[ "\$sub" == "pr create" ]]; then
  bf=""; while [[ \$# -gt 0 ]]; do [[ "\$1" == "--body-file" ]] && bf="\$2"; shift; done
  [[ -n "\$bf" && -f "\$bf" ]] && cp "\$bf" "$ROOT/last_pr_body.txt"
  echo "https://example/pull/123"; exit 0
fi
exit 0
STUB
chmod +x "$ROOT/bin/gh"

setup () {  # $1 = content | structural
  local mode="$1"
  rm -rf "$ROOT/up" "$ROOT/upstream.git" "$ROOT/originfork.git" "$ROOT/work" "$ROOT/build"
  mkdir -p "$ROOT/up"; cd "$ROOT/up"
  git init -q -b main; git config user.email a@b.c; git config user.name up
  printf 'a\nb\nc\n' > file.txt; printf 'shared-base\n' > shared.txt
  git add -A; git commit -qm "C0"; local BASE; BASE=$(git rev-parse HEAD)
  if [[ "$mode" == content ]]; then
    printf 'a\nb-UPSTREAM\nc\n' > file.txt; printf 'x\n' > mainnew.txt
    git add -A; git commit -qm "main: change line2 + add mainnew"
  else
    printf 'shared-UPSTREAM\n' > shared.txt; printf 'x\n' > mainnew.txt
    git add -A; git commit -qm "main: modify shared + add mainnew"
  fi
  git checkout -q "$BASE"; git checkout -q -b develop
  printf 'y\n' > devnew.txt; git add -A; git commit -qm "develop: add devnew"
  git checkout -q main; cd "$ROOT"; git clone -q --bare "$ROOT/up" "$ROOT/upstream.git"
  git clone -q "$ROOT/up" "$ROOT/build"; cd "$ROOT/build"
  git config user.email me@org.c; git config user.name me; git checkout -q -B develop "$BASE"
  if [[ "$mode" == content ]]; then
    printf 'a\nb-OURS\nc\n' > file.txt; printf 'z\n' > ourcustom.txt
    git add -A; git commit -qm "ours: line2=ours + ourcustom"
  else
    git rm -q shared.txt; printf 'z\n' > ourcustom.txt
    git add -A; git commit -qm "ours: delete shared + ourcustom"
  fi
  cd "$ROOT"; git clone -q --bare "$ROOT/build" "$ROOT/originfork.git"; rm -rf "$ROOT/build"
  git clone -q "$ROOT/originfork.git" "$ROOT/work"; cd "$ROOT/work"
  git config user.email me@org.c; git config user.name me
  git remote add upstream "$ROOT/upstream.git"; git checkout -q develop; cd "$ROOT"
}

check () { if eval "$2"; then echo "  PASS: $1"; else echo "  FAIL: $1"; FAILED=1; fi; }

echo "Testing: $SCRIPT"

echo "[1] content overlap -> override is surfaced"
setup content
( cd "$ROOT/work"; bash "$SCRIPT" >/dev/null 2>&1 )
check "exit 0"                        '[[ $? -eq 0 ]]'
check "our line2 kept"                'grep -qx "b-OURS" "$ROOT/work/file.txt" 2>/dev/null && sed -n "2p" "$ROOT/work/file.txt" | grep -qx "b-OURS"'
check "clean upstream adds landed"    '[[ -f "$ROOT/work/mainnew.txt" && -f "$ROOT/work/devnew.txt" ]]'
check "override section in PR body"   'grep -q "Upstream changes overridden" "$ROOT/last_pr_body.txt"'
check "file.txt flagged"              'grep -q "file.txt" "$ROOT/last_pr_body.txt"'
check "mainnew NOT flagged as override" '! grep -A4 "overridden" "$ROOT/last_pr_body.txt" | grep -q "mainnew.txt"'

echo "[2] structural conflict -> --continue completes, no orphan branch"
setup structural
( cd "$ROOT/work"; bash "$SCRIPT" >/dev/null 2>&1 ); rc=$?
check "first run fails (exit 1)"      '[[ $rc -eq 1 ]]'
( cd "$ROOT/work"; git rm -q shared.txt 2>/dev/null; git commit -qm resolve >/dev/null 2>&1 )
( cd "$ROOT/work"; bash "$SCRIPT" --continue >/dev/null 2>&1 ); rc=$?
check "resume exits 0"                '[[ $rc -eq 0 ]]'
check "exactly one sync branch (no orphan)" '[[ $(git -C "$ROOT/work" branch --list "sync/*" | wc -l) -eq 1 ]]'
check "develop merged on resume"      '[[ -f "$ROOT/work/devnew.txt" ]]'
check "our deletion preserved"        '[[ ! -f "$ROOT/work/shared.txt" ]]'

echo "[3] regressions"
setup content
( cd "$ROOT/work"; bash "$SCRIPT" --dry-run >/dev/null 2>&1 ); check "dry-run exits 0" '[[ $? -eq 0 ]]'
( cd "$ROOT/work"; FAKE_EXISTING_PR=1 bash "$SCRIPT" >/dev/null 2>&1 ); check "duplicate guard exits 1" '[[ $? -eq 1 ]]'

echo ""
[[ $FAILED -eq 0 ]] && echo "ALL PASS" || { echo "SOME FAILED"; exit 1; }

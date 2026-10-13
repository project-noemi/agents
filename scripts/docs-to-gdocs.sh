#!/usr/bin/env bash
# Convert markdown docs to .docx for upload to Google Drive as native Google Docs.
# Mermaid blocks are rendered to PNG when mermaid-cli (mmdc) is available;
# otherwise they stay as code blocks. The GitHub markdown remains the source of truth.
# Usage: scripts/docs-to-gdocs.sh OUT_DIR file1.md [file2.md ...]
set -euo pipefail
out="${1:?usage: $0 OUT_DIR file.md...}"; shift
command -v pandoc >/dev/null || { echo "pandoc not found (install to ~/.local/bin)" >&2; exit 1; }
mkdir -p "$out"
for md in "$@"; do
  name="$(basename "$md" .md)"
  src="$md"
  if command -v mmdc >/dev/null && grep -q '^```mermaid' "$md"; then
    tmp="$(mktemp -d)"
    cp "$md" "$tmp/in.md"
    # mmdc replaces mermaid blocks with image links and writes the PNGs next to the output.
    if mmdc -q -i "$tmp/in.md" -o "$tmp/$name.md" -e png -b white ${MMDC_PUPPETEER_CONFIG:+-p "$MMDC_PUPPETEER_CONFIG"}; then
      src="$tmp/$name.md"
    else
      echo "mermaid render failed for $md; keeping code blocks" >&2
    fi
  fi
  pandoc "$src" --resource-path="$(dirname "$src"):$(dirname "$md")" -f gfm -o "$out/$name.docx"
  echo "wrote $out/$name.docx"
done

#!/bin/sh
# Fails when a tracked file is longer than the limit in standards/code.md.
# Copy to scripts/ in your repository and run it from the check command.
#
# Paths listed in .file-length-ignore (one per line, # comments allowed) are
# skipped: generated files, and long files grandfathered until they're split.
#
# Usage: scripts/check-file-length.sh [max-lines]
set -eu

max=${1:-500}
ignore=.file-length-ignore
failed=0

for file in $(git ls-files -- \
  '*.ts' '*.tsx' '*.js' '*.mjs' '*.svelte' '*.css' '*.py' '*.go' '*.sh' \
  ':!:*.d.ts' ':!:*.gen.*' ':!:*_pb.go' ':!:*.pb.go' ':!:**/generated/**'); do
  if [ -f "$ignore" ] && grep -qxF "$file" "$ignore"; then continue; fi
  lines=$(wc -l <"$file")
  if [ "$lines" -gt "$max" ]; then
    echo "error: $file has $lines lines (max $max). Split it by responsibility; see standards/code.md." >&2
    failed=1
  fi
done

[ "$failed" = 0 ] && echo "file length ok"
exit "$failed"

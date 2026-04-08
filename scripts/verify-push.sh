#!/bin/sh
set -eu

repo_root="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

echo "Running push verification checks..."

echo "1/2 build"
if ! pnpm build; then
  echo "Push verification failed: workspace build failed." >&2
  exit 1
fi

echo "2/2 test"
if ! pnpm test; then
  echo "Push verification failed: workspace tests failed." >&2
  exit 1
fi

echo "Push verification passed."

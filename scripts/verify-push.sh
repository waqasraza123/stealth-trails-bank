#!/bin/sh
set -eu

repo_root="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

echo "Running push verification checks..."

echo "1/1 repo test gate"
if ! pnpm test:ci; then
  echo "Push verification failed: repo test gate failed." >&2
  exit 1
fi

echo "Push verification passed."

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="${ROOT_DIR}/website/community-hub"
TARGET_DIR="${ROOT_DIR}/frontend_chain/community-hub"

if [[ ! -f "${SOURCE_DIR}/index.html" ]]; then
  echo "missing Community Hub build: ${SOURCE_DIR}" >&2
  echo "run: cd ${ROOT_DIR}/apps/community-hub && pnpm build" >&2
  exit 1
fi

mkdir -p "${TARGET_DIR}"
rsync -a --delete "${SOURCE_DIR}/" "${TARGET_DIR}/"

echo "Community Hub package synced"
echo "source=${SOURCE_DIR}"
echo "target=${TARGET_DIR}"

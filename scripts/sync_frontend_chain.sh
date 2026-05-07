#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${ROOT_DIR}/website"
SITE_DIR="${ROOT_DIR}/frontend_chain"

if [[ ! -d "${SRC_DIR}" ]]; then
  echo "missing source frontend directory: ${SRC_DIR}" >&2
  exit 1
fi

mkdir -p "${SITE_DIR}"

required_files=(
  "index.html"
  "beginner.html"
  "game.html"
  "intel_pipeline.html"
  "sbt_icons.json"
  "image.png"
  "game-page-copy-handoff.md"
  "game-page-copy-handoff.txt"
)

if [[ ! -d "${SRC_DIR}/assets" ]]; then
  echo "missing source assets directory: ${SRC_DIR}/assets" >&2
  exit 1
fi

for rel in "${required_files[@]}"; do
  if [[ ! -f "${SRC_DIR}/${rel}" ]]; then
    echo "missing source frontend file: ${SRC_DIR}/${rel}" >&2
    exit 1
  fi
done

echo "syncing frontend source -> chain package"
echo "source=${SRC_DIR}"
echo "target=${SITE_DIR}"

rsync -a --delete "${SRC_DIR}/assets/" "${SITE_DIR}/assets/"

for rel in "${required_files[@]}"; do
  install -m 0644 "${SRC_DIR}/${rel}" "${SITE_DIR}/${rel}"
done

# Keep deployment metadata and explicit data cache, but remove accidental
# top-level leftovers such as copied backend folders or old nested website/.
allowed_top=(
  "assets"
  "data"
  "ws-resources.json"
  "index.html"
  "beginner.html"
  "game.html"
  "intel_pipeline.html"
  "sbt_icons.json"
  "image.png"
  "game-page-copy-handoff.md"
  "game-page-copy-handoff.txt"
)

is_allowed_top() {
  local name="$1"
  local allowed
  for allowed in "${allowed_top[@]}"; do
    [[ "${name}" == "${allowed}" ]] && return 0
  done
  return 1
}

while IFS= read -r -d '' entry; do
  name="$(basename "${entry}")"
  if is_allowed_top "${name}"; then
    continue
  fi
  echo "removing stale frontend_chain entry: ${name}"
  rm -rf "${entry}"
done < <(find "${SITE_DIR}" -mindepth 1 -maxdepth 1 -print0)

echo "frontend_chain sync complete"

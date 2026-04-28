#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE_DIR="${ROOT_DIR}/frontend_chain"
WS_RESOURCES="${SITE_DIR}/ws-resources.json"

if [[ ! -f "${WS_RESOURCES}" ]]; then
  echo "missing ${WS_RESOURCES}" >&2
  exit 1
fi

OBJECT_ID="${1:-$(python3 - <<'PY' "${WS_RESOURCES}"
import json, sys
path = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
    print(str(json.load(f).get("object_id") or "").strip())
PY
)}"

if [[ -z "${OBJECT_ID}" ]]; then
  echo "object_id is empty (ws-resources.json)" >&2
  exit 1
fi

EPOCHS="${EPOCHS:-1}"
GAS_BUDGET="${GAS_BUDGET:-200000000}"
CONTEXT="${CONTEXT:-mainnet}"
DRY_RUN="${DRY_RUN:-0}"

echo "updating existing walrus site"
echo "context=${CONTEXT}"
echo "site_dir=${SITE_DIR}"
echo "object_id=${OBJECT_ID}"
echo "epochs=${EPOCHS}"
echo "gas_budget=${GAS_BUDGET}"
echo "dry_run=${DRY_RUN}"

if [[ "${DRY_RUN}" == "1" ]]; then
  site-builder --context "${CONTEXT}" --gas-budget "${GAS_BUDGET}" \
    update --epochs "${EPOCHS}" "${SITE_DIR}" "${OBJECT_ID}" --dry-run
else
  site-builder --context "${CONTEXT}" --gas-budget "${GAS_BUDGET}" \
    update --epochs "${EPOCHS}" "${SITE_DIR}" "${OBJECT_ID}"
fi

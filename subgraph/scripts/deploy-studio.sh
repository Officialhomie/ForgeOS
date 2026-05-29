#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${GRAPH_STUDIO_DEPLOY_KEY:-}" ]]; then
  echo "Set GRAPH_STUDIO_DEPLOY_KEY (from https://thegraph.com/studio/ → forgeos → Settings)"
  exit 1
fi

npm run codegen
npm run build

graph deploy forgeos \
  --studio \
  --deploy-key "$GRAPH_STUDIO_DEPLOY_KEY" \
  --version-label "sepolia-10945007" \
  -l "v0.0.2"

echo ""
echo "Deployed. Update NEXT_PUBLIC_SUBGRAPH_URL in app/.env.local from Studio → Query URL"

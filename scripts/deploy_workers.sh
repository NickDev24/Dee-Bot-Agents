#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKERS=("192.168.100.28" "192.168.100.39")

echo "🚀 Desplegando agentes ligeros (Gateway :8730 + Bench :8731) en workers LAN..."

for HOST in "${WORKERS[@]}"; do
  echo "🔎 Probando conexión con $HOST..."
  if ssh -o BatchMode=yes -o ConnectTimeout=3 "facu@$HOST" "mkdir -p ~/dee-node-agent" 2>/dev/null; then
    scp -q "$ROOT_DIR/node_agent/gateway.py" "$ROOT_DIR/node_agent/bench.py" "facu@$HOST:~/dee-node-agent/"
    ssh -o BatchMode=yes "facu@$HOST" "nohup python3 ~/dee-node-agent/gateway.py >/tmp/dee_gw.log 2>&1 & nohup python3 ~/dee-node-agent/bench.py >/tmp/dee_bench.log 2>&1 &"
    echo "✅ Agente desplegado y activo en $HOST"
  else
    echo "⚠️  Worker $HOST offline o no accesible por SSH en este momento (Dee sigue 100% autónomo en facu)."
  fi
done

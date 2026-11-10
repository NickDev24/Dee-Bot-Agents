#!/usr/bin/env bash
# ==============================================================================
# DEE SUPREME GATEWAY — VERIFICADOR DE SALUD MULTI-NODO (:8730 & :8731)
# Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog
# Uso: bin/gateway-check.sh [ip:puerto] (por defecto 127.0.0.1:8730)
# ==============================================================================
set -euo pipefail

TARGET="${1:-127.0.0.1:8730}"
HOST="${TARGET%:*}"
GW_PORT="${TARGET##*:}"
BENCH_PORT="8731"

echo "⚡ Verificando Dee File Gateway en http://$HOST:$GW_PORT/health ..."
curl -fsS -m 5 "http://$HOST:$GW_PORT/health"
echo ""

echo "⚡ Verificando Dee Process Workbench en http://$HOST:$BENCH_PORT/health ..."
curl -fsS -m 5 "http://$HOST:$BENCH_PORT/health"
echo ""

echo "📊 Telemetría instantánea del nodo ($HOST:$BENCH_PORT/telemetry):"
curl -fsS -m 5 "http://$HOST:$BENCH_PORT/telemetry"
echo ""
echo "✅ Gateway y Workbench operativos al 100%."

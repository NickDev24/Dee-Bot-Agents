#!/usr/bin/env bash
# ==============================================================================
# DEE-BOT-AGENTS — DEE (DISTRIBUTED EMERGENT ENGINE) — APLICACIÓN NATIVA DE ESCRITORIO ELECTRON
# Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog
# ==============================================================================
set -e
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

unset ELECTRON_RUN_AS_NODE
export DISPLAY="${DISPLAY:-:1}"

echo "⚡ [Dee-Bot-Agents] Verificando demonios nativos (:8091, :8730, :8731)..."
./scripts/start_dee.sh --no-window

echo "🚀 Iniciando aplicación nativa de escritorio Electron v44.7.0..."
exec node "$ROOT_DIR/desktop/launch.cjs" "$@"

#!/usr/bin/env bash
# ==============================================================================
# DEE-BOT-AGENTS v4.0 SUPREME — LANZADOR DE APLICACIÓN DE ESCRITORIO ELECTRON
# Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog
# ==============================================================================
set -e
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "⚡ [Dee-Bot-Agents] Verificando servicios reales (:8091, :8730, :8731)..."
./scripts/start_dee.sh

if [ -x "$ROOT_DIR/node_modules/.bin/electron" ]; then
  echo "🚀 Abriendo ventana nativa Electron local..."
  exec "$ROOT_DIR/node_modules/.bin/electron" "$ROOT_DIR/desktop/main.cjs" --no-sandbox "$@"
elif [ -x "/home/facu/investigar-agentes-autonomos/OpenGrokBot/node_modules/.bin/electron" ]; then
  echo "🚀 Abriendo ventana nativa Electron (motor compartido)..."
  exec "/home/facu/investigar-agentes-autonomos/OpenGrokBot/node_modules/.bin/electron" "$ROOT_DIR/desktop/main.cjs" --no-sandbox "$@"
elif command -v electron >/dev/null 2>&1; then
  echo "🚀 Abriendo ventana nativa Electron del sistema..."
  exec electron "$ROOT_DIR/desktop/main.cjs" --no-sandbox "$@"
else
  echo "🚀 Abriendo en modo App Nativa de Escritorio (Chromium App Mode)..."
  for bin in chromium google-chrome brave-browser; do
    if command -v "$bin" >/dev/null 2>&1; then
      exec "$bin" --app="http://127.0.0.1:8091" --window-size=1440,920 "$@"
    fi
  done
  xdg-open "http://127.0.0.1:8091"
fi

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "⚡ Instalando Dee-Bot-Agents v4.0 Supreme..."

# 1. Crear estructura de datos persistente
mkdir -p data/biometrics \
         data/media/conservar/intrusos \
         data/media/descartable \
         data/memory \
         data/skills \
         data/routines \
         data/tts_cache \
         data/logs

# 2. Copiar .env.example si no existe .env
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo "✅ Archivo .env creado desde .env.example"
fi

# 3. Compilar Frontend 3D si existe npm y no está compilado
if [ ! -f frontend/dist/index.html ] && command -v npm >/dev/null 2>&1; then
  echo "🎨 Compilando HUD 3D Espacial (Three.js + React)..."
  (cd frontend && npm install --no-audit --no-fund && npm run build)
fi

chmod +x cli/dee_cli.py scripts/*.sh

echo "✅ Instalación completada. Ejecutá: ./scripts/start_dee.sh"

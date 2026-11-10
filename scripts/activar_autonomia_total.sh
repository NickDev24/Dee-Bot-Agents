#!/usr/bin/env bash
# ==============================================================================
# DEE-BOT-AGENTS — DEE (DISTRIBUTED EMERGENT ENGINE) — ACTIVADOR DE AUTONOMÍA TOTAL 24/7
# Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "================================================================="
echo "⚡ CONFIGURANDO AUTONOMÍA PERPETUA 24/7 DE DEE-BOT-AGENTS v4.0"
echo "================================================================="

# 1. Configurar Servicio Systemd de Usuario (Auto-inicio y Auto-reinicio 24/7)
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
mkdir -p "$SYSTEMD_USER_DIR"

cat > "$SYSTEMD_USER_DIR/dee-bot-agents.service" <<EOF
[Unit]
Description=Dee-Bot-Agents — DEE (Distributed Emergent Engine) (Cerebro + Gateway :8730 + Workbench :8731 + Autonomia 24/7)
After=network.target sound.target

[Service]
Type=simple
WorkingDirectory=$ROOT_DIR
Environment="DISPLAY=${DISPLAY:-:1}"
Environment="PYTHONUNBUFFERED=1"
ExecStartPre=$ROOT_DIR/scripts/start_dee.sh
ExecStart=/usr/bin/python3 -m core.main
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

# 2. Crear Acceso Directo Nativo en el Menú de Aplicaciones de Linux y Autostart de Escritorio
APPS_DIR="$HOME/.local/share/applications"
AUTOSTART_DIR="$HOME/.config/autostart"
mkdir -p "$APPS_DIR" "$AUTOSTART_DIR"

DESKTOP_CONTENT="[Desktop Entry]
Type=Application
Name=Dee-Bot-Agents — DEE (Distributed Emergent Engine)
Comment=Sistema Operativo de Agentes Autónomos Multi-Nodo en 3D — por Facu Cercuetti (@NickDev24)
Exec=$ROOT_DIR/scripts/iniciar_escritorio_electron.sh
Path=$ROOT_DIR
Terminal=false
Categories=Development;System;Utility;
StartupNotify=true
"

printf "%s" "$DESKTOP_CONTENT" > "$APPS_DIR/dee-bot-agents.desktop"
printf "%s" "$DESKTOP_CONTENT" > "$AUTOSTART_DIR/dee-bot-agents.desktop"
chmod +x "$APPS_DIR/dee-bot-agents.desktop" "$AUTOSTART_DIR/dee-bot-agents.desktop"

# Recargar systemd user daemon si está disponible (con timeout seguro)
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
if command -v systemctl >/dev/null 2>&1; then
  timeout 2 systemctl --user daemon-reload >/dev/null 2>&1 || true
  timeout 2 systemctl --user enable dee-bot-agents.service >/dev/null 2>&1 || true
  echo "✅ Servicio systemd (--user) registrado y habilitado: dee-bot-agents.service"
fi

echo "✅ Acceso directo de escritorio y auto-arranque registrados en ~/.config/autostart/dee-bot-agents.desktop"

# 3. Asegurar que los 3 demonios estén corriendo con la última versión
./scripts/start_dee.sh

echo "✅ Autonomía 24/7 activa y verificada."

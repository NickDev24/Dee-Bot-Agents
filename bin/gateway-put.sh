#!/usr/bin/env bash
# ==============================================================================
# DEE SUPREME GATEWAY — SUBIDA ATÓMICA DE ARCHIVOS (:8730)
# Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog
# Uso: bin/gateway-put.sh <ip:8730> <archivo-local> <ruta-remota-relativa>
# ==============================================================================
set -euo pipefail

TARGET="${1:?Uso: bin/gateway-put.sh <ip:8730> <archivo-local> <ruta-remota-relativa>}"
LOCAL_FILE="${2:?Falta el archivo local a enviar}"
REMOTE_PATH="${3:?Falta la ruta relativa destino}"

if [ ! -f "$LOCAL_FILE" ]; then
  echo "❌ Error: el archivo local '$LOCAL_FILE' no existe." >&2
  exit 1
fi

SIZE=$(stat -c%s "$LOCAL_FILE")
ENC_PATH=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1].lstrip("/")))' "$REMOTE_PATH")

curl --fail-with-body -sS -m 120 \
  -X PUT \
  -H "Content-Length: $SIZE" \
  --data-binary "@$LOCAL_FILE" \
  "http://$TARGET/files/$ENC_PATH"
echo ""

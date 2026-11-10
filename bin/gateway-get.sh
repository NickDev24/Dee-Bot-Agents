#!/usr/bin/env bash
# ==============================================================================
# DEE SUPREME GATEWAY — DESCARGA ATÓMICA DE ARCHIVOS CON VERIFICACIÓN SHA-256 (:8730)
# Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog
# Uso: bin/gateway-get.sh <ip:8730> <ruta-remota-relativa> <archivo-destino-local>
# ==============================================================================
set -euo pipefail

TARGET="${1:?Uso: bin/gateway-get.sh <ip:8730> <ruta-remota> <archivo-local>}"
REMOTE_PATH="${2:?Falta la ruta remota}"
LOCAL_OUT="${3:?Falta la ruta de salida local}"

ENC_PATH=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1].lstrip("/")))' "$REMOTE_PATH")
curl --fail-with-body -sS -m 120 -o "$LOCAL_OUT" "http://$TARGET/files/$ENC_PATH"
SHA=$(sha256sum "$LOCAL_OUT" | awk '{print $1}')
echo "✅ Descargado '$REMOTE_PATH' -> '$LOCAL_OUT' (SHA256: $SHA)"

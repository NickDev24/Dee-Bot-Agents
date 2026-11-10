#!/usr/bin/env bash
# ==============================================================================
# DEE SUPREME GATEWAY — EJECUCIÓN REMOTA CON POLLING AUTOMÁTICO (:8731)
# Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog
# Uso: bin/gateway-exec.sh <ip:8731> '<comando>' [cwd=/tmp] [timeout=600]
# ==============================================================================
set -euo pipefail

TARGET="${1:-127.0.0.1:8731}"
CMD="${2:?Uso: bin/gateway-exec.sh <ip:8731> '<comando>' [cwd] [timeout]}"
CWD="${3:-/tmp}"
TIMEOUT="${4:-600}"

BASE="http://$TARGET"
payload=$(python3 -c 'import json,sys; print(json.dumps({"cmd": sys.argv[1], "cwd": sys.argv[2], "timeout": int(sys.argv[3]), "wait": 25}))' "$CMD" "$CWD" "$TIMEOUT")

resp=$(curl --fail-with-body -sS -m 60 -X POST -H 'Content-Type: application/json' -d "$payload" "$BASE/exec")

get_field() {
  python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("'"$1"'",""))' <<<"$resp"
}

id="$(get_field id)"
status="$(get_field status)"
while [ "$status" = "running" ]; do
  sleep 2
  resp=$(curl --fail-with-body -sS -m 30 "$BASE/exec/$id")
  status="$(get_field status)"
done

python3 -c '
import json, sys
d = json.load(sys.stdin)
sys.stdout.write(d.get("stdout") or "")
if d.get("stderr"):
    sys.stderr.write("--- stderr ---\n" + d["stderr"])
st = d.get("status")
ec = d.get("exit_code")
el = d.get("elapsed_s")
sys.stderr.write(f"[estado={st} codigo={ec} duracion={el}s]\n")
sys.exit(ec if isinstance(ec, int) else 1)
' <<<"$resp"

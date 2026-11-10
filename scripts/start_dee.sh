#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p data/logs

echo "⚡ Iniciando servicios locales de Dee-Bot-Agents v4.0 Supreme..."

python3 - <<'PY'
import socket
import subprocess

services = [
    ("File Gateway (:8730)", 8730, ["python3", "node_agent/gateway.py"], "data/logs/gateway.log"),
    ("Workbench (:8731)", 8731, ["python3", "node_agent/bench.py"], "data/logs/bench.log"),
    ("Dee Core + HUD 3D (:8091)", 8091, ["python3", "-m", "core.main"], "data/logs/dee_core.log"),
]

for name, port, cmd, logfile in services:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.2)
    in_use = s.connect_ex(("127.0.0.1", port)) == 0
    s.close()
    if not in_use:
        out = open(logfile, "a")
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.DEVNULL,
            stdout=out,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            close_fds=True,
        )
        print(f"✅ {name} iniciado (PID {proc.pid})")
    else:
        print(f"ℹ️  {name} ya está activo en :{port}")
PY

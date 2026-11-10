#!/usr/bin/env python3
"""DEE CLI (`dee`) — Control Total de Dee-Bot-Agents desde Terminal.

Comandos disponibles:
  dee serve                  -> Levanta el servidor maestro de Dee en :8091
  dee status                 -> Muestra estado de las 3 PCs, sensores, voz y ahorro de tokens
  dee ask "<orden>"          -> Envía una orden a Dee y habla/muestra la respuesta
  dee plan "<objetivo>"      -> Ejecuta el modo /plan multi-nodo
  dee grill "<arquitectura>" -> Ejecuta auditoría adversarial /grill con Sentinel
  dee goal "<meta>"          -> Ejecuta el bucle autónomo /goal con verificación real
  dee nodes                  -> Sondea en vivo facu, barto, manager1 y carecam
  dee enroll-voice           -> Graba 3.5s de tu micrófono en facu para registrar tu huella vocal
  dee enroll-face            -> Captura un frame de cámara para registrar tu firma facial
  dee kill                   -> Dispara el Kill-Switch de emergencia de Sentinel
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

DEE_URL = os.environ.get("DEE_API_URL", "http://127.0.0.1:8091")


def _api(path: str, payload: dict | None = None, timeout: float = 40.0) -> dict:
    url = DEE_URL.rstrip("/") + path
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        return {"ok": False, "error": f"No se pudo conectar a {url}: {exc}"}


def main() -> int:
    parser = argparse.ArgumentParser(prog="dee", description="Dee-Bot-Agents v4.0 CLI")
    sub = parser.add_subparsers(dest="cmd")

    sub.add_parser("serve", help="Iniciar el servidor maestro Dee Core (:8091)")
    sub.add_parser("status", help="Estado completo del sistema, sensores y cluster")
    sub.add_parser("nodes", help="Telemetría en vivo de facu, barto, manager1 y carecam")
    sub.add_parser("kill", help="Disparar Kill-Switch inmediato de Sentinel")
    sub.add_parser("enroll-voice", help="Registrar huella biométrica de voz de Facu")
    sub.add_parser("enroll-face", help="Registrar huella biométrica facial de Facu")

    for mode_cmd in ("ask", "plan", "grill", "goal"):
        p = sub.add_parser(mode_cmd, help=f"Ejecutar modo {mode_cmd}")
        p.add_argument("text", nargs="+", help="Instrucción para Dee")
        p.add_argument("--no-speak", action="store_true", help="No reproducir TTS")

    args = parser.parse_args()

    if args.cmd == "serve":
        from core.main import start_server
        start_server()
        return 0

    if args.cmd == "status":
        res = _api("/api/status")
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0 if res.get("ok") else 1

    if args.cmd == "nodes":
        res = _api("/api/status")
        print(json.dumps(res.get("cluster", res), indent=2, ensure_ascii=False))
        return 0

    if args.cmd == "kill":
        res = _api("/api/interrupt", {})
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0

    if args.cmd == "enroll-voice":
        print("🎙️ Hablá durante 3.5 segundos diciendo: 'Hola Dee, soy Facu autorizando el laboratorio'...")
        res = _api("/api/sensory/enroll", {"kind": "voice", "duration_s": 3.5})
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0

    if args.cmd == "enroll-face":
        print("📷 Mirá a la cámara (CareCam / Manager1) para capturar tu firma facial...")
        res = _api("/api/sensory/enroll", {"kind": "face"})
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0

    if args.cmd in ("ask", "plan", "grill", "goal"):
        raw_text = " ".join(args.text)
        prefix = "" if args.cmd == "ask" else f"/{args.cmd} "
        res = _api("/api/ask", {"text": prefix + raw_text, "speak": not args.no_speak})
        if res.get("ok"):
            print(f"\n⚡ [{res.get('agent_name', 'Dee Prime')}]: {res.get('reply', '')}\n")
            return 0
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 1

    parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

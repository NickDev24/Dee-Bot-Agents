#!/usr/bin/env python3
"""DEE CLI (`dee_cli.py`) — CONTROL TOTAL DE DEE-BOT-AGENTS v4.0 SUPREME DESDE TERMINAL.
Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog

Comandos reales disponibles (100% Español & Inglés técnico):
  dee serve                         -> Levanta el servidor maestro de Dee en :8091
  dee status                        -> Estado de las 3 PCs, sensores, voz, RAG y ahorro de tokens
  dee nodes                         -> Sondea en vivo facu, barto, manager1 y carecam
  dee ask "<orden o /skill>"        -> Envía una orden o /skill a Dee (Zero-Token Fast-Path + LLM Pool)
  dee plan "<objetivo>"             -> Ejecuta el modo /plan multi-nodo
  dee grill "<arquitectura>"        -> Ejecuta auditoría adversarial /grill con Sentinel
  dee goal "<meta>"                 -> Ejecuta el bucle autónomo /goal con verificación en consola
  dee exec "<comando>" [--node N]   -> Ejecuta comando real en facu, barto o manager1 vía Workbench :8731
  dee pc [status|click|move|type|screenshot|volume] -> Control Físico Total de la PC en C/X11 (libX11+libXtst)
  dee rag "<consulta>"              -> Búsqueda instantánea (<3ms, 0-RAM) en el índice SQLite FTS5 BM25
  dee cdp "<url>"                   -> Extrae mapa interactivo @ref DOM y cookies de cualquier web
  dee relay "<cmd>" [--target N]    -> Despacha trabajo transaccional con RouteEnvelope (hop<4)
  dee worktree [list|create|remove] -> Gestiona árboles de trabajo Git aislados en /tmp/dee-worktrees
  dee programas [list|launch]       -> Lista o lanza aplicaciones reales del escritorio Linux
  dee agenda                        -> Muestra la agenda operativa persistente de Facu
  dee enroll-voice / enroll-face    -> Registra biometría vocal 12-D MFCC o firma facial de Facu
  dee kill                          -> Dispara el Kill-Switch inmediato de Sentinel (os.killpg)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
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
    parser = argparse.ArgumentParser(
        prog="dee",
        description="Dee-Bot-Agents v4.0 Supreme CLI — por Facu Cercuetti (@NickDev24)",
    )
    sub = parser.add_subparsers(dest="cmd")

    sub.add_parser("serve", help="Iniciar el servidor maestro Dee Core (:8091)")
    sub.add_parser("status", help="Estado completo del sistema, sensores y clúster")
    sub.add_parser("nodes", help="Telemetría en vivo de facu, barto, manager1 y carecam")
    sub.add_parser("kill", help="Disparar Kill-Switch inmediato de Sentinel")
    sub.add_parser("enroll-voice", help="Registrar huella biométrica de voz de Facu")
    sub.add_parser("enroll-face", help="Registrar huella biométrica facial de Facu")
    sub.add_parser("agenda", help="Listar tareas y eventos de la Agenda Operativa")

    for mode_cmd in ("ask", "plan", "grill", "goal"):
        p = sub.add_parser(mode_cmd, help=f"Ejecutar modo cognitivo {mode_cmd}")
        p.add_argument("text", nargs="+", help="Instrucción o /skill para Dee")
        p.add_argument("--no-speak", action="store_true", help="No reproducir voz TTS")

    p_exec = sub.add_parser("exec", help="Ejecutar comando bash auditado en facu, barto o manager1")
    p_exec.add_argument("command", nargs="+", help="Comando Linux a ejecutar")
    p_exec.add_argument("--node", default="facu", choices=["facu", "barto", "manager1"], help="Nodo destino")

    p_pc = sub.add_parser("pc", help="Control físico nativo X11 de la PC (mouse, teclado, ventanas, captura)")
    p_pc.add_argument(
        "action",
        nargs="?",
        default="estado",
        choices=["status", "estado", "click", "clic", "move", "mover", "type", "escribir", "screenshot", "captura", "volume", "volumen"],
        help="Acción X11 a ejecutar",
    )
    p_pc.add_argument("--x", type=int, default=None, help="Coordenada X de pantalla")
    p_pc.add_argument("--y", type=int, default=None, help="Coordenada Y de pantalla")
    p_pc.add_argument("--button", type=int, default=1, help="Botón de mouse (1=Izq, 2=Medio, 3=Der)")
    p_pc.add_argument("--text", type=str, default="", help="Texto a tipear o nivel de volumen")

    p_rag = sub.add_parser("rag", help="Búsqueda instantánea 0-RAM en el motor SQLite FTS5 BM25")
    p_rag.add_argument("query", nargs="*", help="Términos a buscar (vacío muestra estadísticas)")

    p_cdp = sub.add_parser("cdp", help="Extraer mapa interactivo DOM (@ref) y cookies de una URL")
    p_cdp.add_argument("url", help="URL a inspeccionar")

    p_relay = sub.add_parser("relay", help="Despachar orden transaccional vía Relay Engine (RouteEnvelope hop<4)")
    p_relay.add_argument("payload", nargs="*", help="Comando a enviar (vacío muestra bitácora Relay)")
    p_relay.add_argument("--target", default="facu", help="Destino (facu, barto, manager1)")
    p_relay.add_argument("--policy", default="steer", choices=["steer", "queue", "reject"])

    p_wt = sub.add_parser("worktree", help="Gestionar Git Worktrees aislados (/tmp/dee-worktrees)")
    p_wt.add_argument("action", nargs="?", default="listar", choices=["list", "listar", "create", "crear", "remove", "eliminar"])
    p_wt.add_argument("--name", default="experimento", help="Nombre o ruta del worktree")

    p_prog = sub.add_parser("programas", help="Listar o lanzar programas reales instalados en Linux")
    p_prog.add_argument("action", nargs="?", default="listar", choices=["list", "listar", "launch", "lanzar"])
    p_prog.add_argument("--cmd", default="", help="Comando de la aplicación a lanzar en DISPLAY=:0")

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

    if args.cmd == "agenda":
        res = _api("/api/agenda")
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0

    if args.cmd == "exec":
        cmd_str = " ".join(args.command)
        res = _api("/api/exec", {"cmd": cmd_str, "target": args.node})
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0 if res.get("ok") else 1

    if args.cmd == "pc":
        if args.action in ("status", "estado"):
            res = _api("/api/pc")
        elif args.action in ("move", "mover"):
            res = _api("/api/pc", {"accion": "mouse_move", "x": args.x or 500, "y": args.y or 400})
        elif args.action in ("click", "clic"):
            res = _api("/api/pc", {"accion": "mouse_click", "boton": args.button, "x": args.x, "y": args.y})
        elif args.action in ("type", "escribir"):
            res = _api("/api/pc", {"accion": "keyboard_type", "texto": args.text})
        elif args.action in ("screenshot", "captura"):
            res = _api("/api/pc", {"accion": "screenshot"})
        elif args.action in ("volume", "volumen"):
            lvl = int(args.text) if args.text.isdigit() else None
            res = _api("/api/pc", {"accion": "volume", **({"nivel": lvl} if lvl is not None else {})})
        else:
            res = _api("/api/pc")
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0

    if args.cmd == "rag":
        q = " ".join(args.query).strip()
        if q.lower() in ("stats", "estado"):
            q = ""
        res = _api(f"/api/rag?q={urllib.parse.quote(q)}" if q else "/api/rag")
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0

    if args.cmd == "cdp":
        res = _api("/api/cdp", {"accion": "map", "url": args.url})
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0

    if args.cmd == "relay":
        pl = " ".join(args.payload).strip()
        if not pl or pl.lower() in ("estado", "status"):
            res = _api("/api/relay")
        else:
            res = _api("/api/relay", {"destino": args.target, "comando": pl, "busy_policy": args.policy})
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0

    if args.cmd == "worktree":
        if args.action in ("list", "listar"):
            res = _api("/api/worktrees")
        elif args.action in ("create", "crear"):
            res = _api("/api/worktrees", {"accion": "create", "nombre": args.name})
        else:
            res = _api("/api/worktrees", {"accion": "remove", "ruta": args.name})
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0

    if args.cmd == "programas":
        if args.action in ("launch", "lanzar") and args.cmd:
            res = _api("/api/programas", {"accion": "launch", "comando": args.cmd})
        else:
            res = _api("/api/programas")
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

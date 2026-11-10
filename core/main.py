#!/usr/bin/env python3
"""DEE-BOT-AGENTS UNIFIED MASTER SERVER (:8091).

Un único proceso ultra-liviano en Python 3.11+ stdlib que sirve:
- GET  /health                  -> Estado general, versión y métricas de ahorro de tokens
- GET  /api/status              -> Snapshot completo (Personaje 3D, Sensores, Cluster 3 PCs, Squad, Sentinel, LLM Pool)
- GET  /events                  -> Stream SSE en tiempo real (con replay de historial corto)
- GET  /api/events/poll         -> Delta Cursor Polling (`?after=dee_cur_X`) estilo grok-bot-cli
- GET  /audio/<hash>.wav        -> Bloques de voz TTS cacheados para reproducción y Lip-Sync 3D
- GET  /api/camera/latest.jpg   -> Último frame JPEG en RAM de CareCam / Manager1 / Barto
- POST /api/ask                 -> Orden cognitiva completa (`{text, speak, agent_id}`)
- POST /api/speak               -> Solo síntesis TTS expresiva + Lip-Sync (`{text, emotion, action}`)
- POST /api/state               -> Cambiar pose/emoción 3D (`{action, emotion, fps_target}`)
- POST /api/interrupt           -> Kill-Switch / Barge-In inmediato
- POST /api/sensory/ears        -> Encender/apagar micrófonos (`{active, duration_s}`)
- POST /api/sensory/eyes        -> Encender/apagar cámaras (`{active, duration_s, watchdog, capture_now}`)
- POST /api/sensory/enroll      -> Registrar biometría de voz o rostro de Facu
- POST /api/exec                -> Ejecutar comando auditado por Sentinel en `facu`, `barto` o `manager1`
- POST /api/approvals/resolve   -> Aprobar o rechazar solicitud de Sentinel (`{id, allowed}`)
- GET/POST /api/memories        -> Leer/escribir memorias Markdown (0-RAM) y Skills cristalizadas
- GET/POST /api/routines        -> Gestionar rutinas programadas y grabación por observación
- POST /api/hooks/<id>          -> Disparador de rutinas por Webhook externo
- POST /v1/chat/completions     -> Endpoint OpenAI-compatible para usar a Dee desde cualquier cliente/IDE
- GET  /*                       -> Sirve el Frontend 3D compilado (`frontend/dist/`)
"""
from __future__ import annotations

import json
import os
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from queue import Empty

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from core.events import BUS, CHARACTER, TURN_CTRL  # noqa: E402
from core.orchestrator.dee_engine import DEE_ENGINE  # noqa: E402
from core.orchestrator.llm_pool import LLM_POOL  # noqa: E402
from core.orchestrator.memory_md import MEMORY_STORE  # noqa: E402
from core.security.sentinel import SENTINEL  # noqa: E402
from core.sensory import EARS, EYES, boot_sensory_system, emit_speech, sensory_snapshot  # noqa: E402
from core.sensory.butler import TTS_CACHE_DIR  # noqa: E402
from core.sensory.eyes import FACE_GUARD  # noqa: E402
from core.sensory.speaker_id import SPEAKER_ID  # noqa: E402
from core.workers.cluster_client import CLUSTER  # noqa: E402

HOST = os.environ.get("DEE_HOST", "0.0.0.0")
PORT = int(os.environ.get("DEE_PORT", "8091"))
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"
START_TS = time.time()

MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".glb": "model/gltf-binary",
    ".wav": "audio/wav",
}


def build_full_status() -> dict:
    return {
        "ok": True,
        "project": "Dee-Bot-Agents",
        "version": "4.0.0",
        "uptime_s": round(time.time() - START_TS, 1),
        "character": CHARACTER.snapshot(),
        "sensory": sensory_snapshot(),
        "cluster": CLUSTER.get_telemetry(),
        "squad": DEE_ENGINE.get_squad(),
        "llm_pool": LLM_POOL.status(),
        "sentinel": SENTINEL.status(),
        "memories": MEMORY_STORE.list_memories(),
        "skills": list(MEMORY_STORE.list_skills().values()),
        "routines": DEE_ENGINE.routines.list_routines(),
        "messages": DEE_ENGINE.conversation_history[-25:],
    }


def resolve_static_file(url_path: str) -> tuple[Path, str] | None:
    if not FRONTEND_DIST.exists():
        return None
    clean = (url_path or "/").lstrip("/") or "index.html"
    if ".." in clean:
        return None
    target = (FRONTEND_DIST / clean).resolve()
    if not str(target).startswith(str(FRONTEND_DIST.resolve())):
        return None
    if target.is_dir():
        target = target / "index.html"
    if not target.is_file():
        index_fallback = FRONTEND_DIST / "index.html"
        if index_fallback.is_file() and not clean.startswith(("api/", "audio/", "v1/")):
            return index_fallback, MIME_TYPES[".html"]
        return None
    return target, MIME_TYPES.get(target.suffix.lower(), "application/octet-stream")


class DeeMasterHTTPHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def _send_json(self, status_code: int, payload: dict) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self._cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _send_bytes(self, status_code: int, data: bytes, content_type: str) -> None:
        self.send_response(status_code)
        self._cors_headers()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_json(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0:
                return {}
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return {}

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_HEAD(self) -> None:
        self.send_response(200)
        self._cors_headers()
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urllib.parse.urlsplit(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/health":
            return self._send_json(
                200,
                {
                    "ok": True,
                    "service": "Dee-Bot-Agents",
                    "version": "4.0.0",
                    "uptime_s": round(time.time() - START_TS, 1),
                    "tokens_saved": LLM_POOL.total_tokens_saved,
                },
            )

        if path in ("/api/status", "/estado", "/laboratorio"):
            return self._send_json(200, build_full_status())

        if path == "/api/events/poll":
            after = (query.get("after") or [None])[0]
            limit = int((query.get("limit") or ["50"])[0])
            return self._send_json(200, BUS.poll_after(after_cursor=after, limit=limit))

        if path in ("/events", "/evento"):
            self.send_response(200)
            self._cors_headers()
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            q = BUS.subscribe(replay_history=True)
            try:
                while True:
                    try:
                        evt = q.get(timeout=12.0)
                        line = f"data: {json.dumps(evt, ensure_ascii=False)}\n\n".encode("utf-8")
                    except Empty:
                        line = b": heartbeat\n\n"
                    self.wfile.write(line)
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass
            finally:
                BUS.unsubscribe(q)
            return

        if path.startswith("/audio/"):
            fname = Path(path[len("/audio/") :]).name
            wav_file = TTS_CACHE_DIR / fname
            if wav_file.is_file():
                return self._send_bytes(200, wav_file.read_bytes(), "audio/wav")
            return self._send_json(404, {"error": "Audio file not found"})

        if path == "/api/camera/latest.jpg":
            frame = EYES.latest_frame()
            if frame and frame.get("bytes"):
                return self._send_bytes(200, frame["bytes"], "image/jpeg")
            return self._send_json(404, {"error": "No camera frame in memory"})

        if path == "/api/memories":
            return self._send_json(
                200,
                {
                    "ok": True,
                    "memories": MEMORY_STORE.list_memories(),
                    "skills": list(MEMORY_STORE.list_skills().values()),
                },
            )

        if path == "/api/routines":
            return self._send_json(200, {"ok": True, "routines": DEE_ENGINE.routines.list_routines()})

        # Static Frontend Fallback
        static = resolve_static_file(path)
        if static:
            fpath, mime = static
            return self._send_bytes(200, fpath.read_bytes(), mime)

        self._send_json(404, {"error": f"Route not found: {path}"})

    def do_POST(self) -> None:
        parsed = urllib.parse.urlsplit(self.path)
        path = parsed.path
        body = self._read_json()

        if path in ("/api/ask", "/decime"):
            text = str(body.get("prompt") or body.get("text") or body.get("texto") or "").strip()
            if not text:
                return self._send_json(400, {"ok": False, "error": "Falta el campo 'prompt' o 'text'"})
            speak = bool(body.get("speak", True))
            forced_agent = body.get("agent_id")
            res = DEE_ENGINE.process_order(text, speak_reply=speak, forced_agent_id=forced_agent)
            return self._send_json(200, res)

        if path in ("/api/speak", "/api/tts", "/decir"):
            text = str(body.get("text") or body.get("texto") or "").strip()
            emotion = str(body.get("emotion") or body.get("estado") or "curioso")
            action = body.get("action")
            res = emit_speech(text, emotion=emotion, action=action)
            chunks = res.get("chunks") or []
            first = chunks[0] if chunks else {}
            return self._send_json(
                200,
                {
                    **res,
                    "audio_url": first.get("audio_url"),
                    "engine": first.get("backend", "edge"),
                    "duration_s": res.get("total_duration_s", 0.0),
                    "lip_sync": first.get("lipsync", []),
                },
            )

        if path in ("/api/state", "/estado"):
            snap = CHARACTER.transition(
                action=body.get("action"),
                emotion=body.get("emotion"),
                note=str(body.get("note") or ""),
                fps_target=body.get("fps_target"),
            )
            return self._send_json(200, {"ok": True, "character": snap})

        if path in ("/api/interrupt", "/interrumpir"):
            res = SENTINEL.trigger_kill_switch(source="api_interrupt")
            return self._send_json(200, res)

        if path == "/api/sensory/ears":
            if body.get("record_once"):
                dur = float(body.get("duration_s") or 3.5)
                rec = EARS.record_once(duration_s=dur)
                if rec.get("ok") and rec.get("text") and body.get("auto_ask", True):
                    ask_res = DEE_ENGINE.process_order(
                        rec["text"],
                        meta={"speaker_verified": rec.get("speaker_verified", True)},
                        speak_reply=True,
                    )
                    return self._send_json(200, {** {k: v for k, v in rec.items() if k != "raw_pcm"}, "ask_result": ask_res})
                return self._send_json(200, {k: v for k, v in rec.items() if k != "raw_pcm"})

            is_active = body.get("enabled") if "enabled" in body else body.get("active", True)
            if is_active:
                return self._send_json(200, EARS.authorize(body.get("duration_s")))
            return self._send_json(200, EARS.revoke())

        if path == "/api/sensory/eyes":
            if body.get("capture_now") or body.get("scan_once"):
                if not EYES.is_allowed():
                    EYES.authorize(duration_s=1800, continuous=False)
                return self._send_json(200, EYES.capture(source=body.get("source"), force=True))
            is_active = body.get("enabled") if "enabled" in body else body.get("active", True)
            if is_active:
                FACE_GUARD.watchdog_mode = bool(body.get("watchdog") or body.get("vigil_mode"))
                return self._send_json(
                    200,
                    EYES.authorize(
                        duration_s=float(body.get("duration_s") or 3600),
                        continuous=True,
                    ),
                )
            return self._send_json(200, EYES.revoke())

        if path == "/api/sensory/enroll":
            kind = body.get("kind", "voice")
            if kind == "voice":
                rec = EARS.record_once(duration_s=float(body.get("duration_s") or 3.5))
                if not rec.get("ok"):
                    return self._send_json(400, rec)
                enr = SPEAKER_ID.enroll_sample(rec["raw_pcm"])
                return self._send_json(200, enr)
            if kind == "face":
                if not EYES.is_allowed():
                    EYES.authorize(duration_s=600)
                cap = EYES.capture(source=body.get("source"), force=True)
                frame = EYES.latest_frame()
                if not frame or not frame.get("bytes"):
                    return self._send_json(400, {"ok": False, "error": "No se pudo capturar imagen de cámara", "capture": cap})
                return self._send_json(200, FACE_GUARD.enroll_frame(frame["bytes"]))

        if path == "/api/exec":
            cmd = str(body.get("cmd") or "").strip()
            target = str(body.get("target") or "facu")
            verdict = SENTINEL.inspect_command("manual_ui", "shell_exec", {"cmd": cmd, "target": target})
            if verdict["verdict"] == "deny":
                return self._send_json(403, {"ok": False, "error": verdict["reason"]})
            if verdict["verdict"] == "ask" and not body.get("force_approved"):
                ap = SENTINEL.request_approval("manual_ui", "shell_exec", {"cmd": cmd, "target": target}, verdict["reason"])
                return self._send_json(202, {"ok": False, "approval_required": True, "approval": ap})
            res = CLUSTER.execute_shell(cmd=cmd, target_node=target, timeout_s=30.0, wait_s=15.0)
            return self._send_json(200, res)

        if path == "/api/approvals/resolve":
            req_id = body.get("id")
            allowed = bool(body.get("allowed", False))
            res = SENTINEL.resolve_approval(req_id, allowed=allowed, resolved_by="ui_facu")
            if res.get("ok") and allowed:
                ap = res["approval"]
                exec_res = CLUSTER.execute_shell(
                    cmd=str(ap["args"].get("cmd", "echo ok")),
                    target_node=str(ap["args"].get("target", "facu")),
                )
                res["exec_result"] = exec_res
            return self._send_json(200, res)

        if path == "/api/memories":
            if body.get("kind") == "skill":
                sk = MEMORY_STORE.save_skill(
                    skill_id=str(body.get("id") or body.get("name") or "skill"),
                    name=str(body.get("name") or "Nueva Skill"),
                    description=str(body.get("description") or ""),
                    body=str(body.get("body") or ""),
                )
                return self._send_json(200, {"ok": True, "skill": sk})
            agent_id = str(body.get("agent_id") or "dee_core")
            content = str(body.get("content") or "")
            return self._send_json(200, MEMORY_STORE.write_memory(agent_id, content))

        if path == "/api/routines":
            action = body.get("action", "upsert")
            if action == "trigger":
                return self._send_json(200, DEE_ENGINE.routines.trigger(str(body.get("id") or "")))
            if action == "observe_start":
                return self._send_json(200, DEE_ENGINE.routines.start_observation(str(body.get("name") or "Rutina Observada")))
            if action == "observe_stop":
                return self._send_json(200, DEE_ENGINE.routines.stop_observation_and_save())
            return self._send_json(200, {"ok": True, "routine": DEE_ENGINE.routines.upsert(body)})

        if path.startswith("/api/hooks/"):
            hook_id = path[len("/api/hooks/") :].strip("/")
            extra = str(body.get("text") or body.get("payload") or "")
            return self._send_json(200, DEE_ENGINE.routines.trigger(hook_id, extra_context=extra))

        if path == "/v1/chat/completions":
            msgs = body.get("messages") or []
            last_user = next((m.get("content", "") for m in reversed(msgs) if m.get("role") == "user"), "")
            res = DEE_ENGINE.process_order(str(last_user), speak_reply=bool(body.get("speak", False)))
            return self._send_json(
                200,
                {
                    "id": f"chatcmpl-dee-{int(time.time())}",
                    "object": "chat.completion",
                    "created": int(time.time()),
                    "model": "dee-bot-agents-4.0",
                    "choices": [
                        {
                            "index": 0,
                            "message": {"role": "assistant", "content": res.get("reply", "")},
                            "finish_reason": "stop",
                        }
                    ],
                },
            )

        self._send_json(404, {"error": f"Unknown POST route: {path}"})

    def log_message(self, fmt: str, *args) -> None:
        pass


def start_server(host: str = HOST, port: int = PORT) -> None:
    def _on_voice_order(text: str, meta: dict) -> None:
        threading.Thread(
            target=DEE_ENGINE.process_order,
            kwargs={"user_text": text, "meta": meta, "speak_reply": True},
            daemon=True,
        ).start()

    boot_sensory_system(on_voice_command=_on_voice_order)
    CLUSTER.start_health_monitor()
    DEE_ENGINE.routines.start()

    print(
        f"⚡ Dee-Bot-Agents v4.0 Supreme listening on http://{host}:{port} "
        f"(Frontend={'READY' if FRONTEND_DIST.exists() else 'API-ONLY'})",
        flush=True,
    )
    ThreadingHTTPServer((host, port), DeeMasterHTTPHandler).serve_forever()


if __name__ == "__main__":
    start_server()

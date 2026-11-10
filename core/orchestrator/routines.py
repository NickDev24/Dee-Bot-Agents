"""ROUTINES & OBSERVATION RECORDER ENGINE DE DEE.

Fusiona:
1. `OpenGrokBot/server/routines.ts`: Tareas programadas y disparadores por webhook (`POST /api/hooks/<id>`).
2. `xAI Grok Bot Routines`: Grabación de rutinas por observación ("Dee, aprendé esta rutina") que
   convierte pasos observados en una rutina automatizada reproducible en 1 clic o por voz.
"""
from __future__ import annotations

import json
import threading
import time
import uuid
from pathlib import Path

from ..events import BUS

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ROUTINES_FILE = ROOT_DIR / "data" / "routines.json"


DEFAULT_ROUTINES = [
    {
        "id": "rutina_salud_cluster",
        "name": "Chequeo de Salud y Disco del Cluster",
        "agent_id": "hermes_local",
        "interval_minutes": 30,
        "enabled": True,
        "instruction": "Verificar espacio libre en disco, RAM disponible y conectividad de facu, barto y manager1.",
        "last_run_at": None,
        "runs": [],
    },
    {
        "id": "rutina_centinela_nocturno",
        "name": "Auditoría Nocturna de Puertos y Seguridad",
        "agent_id": "sentinel_sec",
        "interval_minutes": 120,
        "enabled": False,
        "instruction": "Auditar puertos en escucha y revisar la carpeta de capturas de intrusos.",
        "last_run_at": None,
        "runs": [],
    },
]


class RoutinesEngine:
    def __init__(self, runner_fn=None):
        self.runner_fn = runner_fn
        self._lock = threading.Lock()
        self._running_ids: set[str] = set()
        self._recording_session: dict | None = None
        self.routines = self._load()
        self._thread: threading.Thread | None = None

    def _load(self) -> list[dict]:
        ROUTINES_FILE.parent.mkdir(parents=True, exist_ok=True)
        if ROUTINES_FILE.exists():
            try:
                return json.loads(ROUTINES_FILE.read_text(encoding="utf-8"))
            except Exception:
                pass
        self._save_list(DEFAULT_ROUTINES)
        return list(DEFAULT_ROUTINES)

    def _save_list(self, items: list[dict]) -> None:
        tmp = ROUTINES_FILE.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(ROUTINES_FILE)

    def start(self) -> None:
        if not self._thread or not self._thread.is_alive():
            self._thread = threading.Thread(target=self._tick_loop, daemon=True, name="dee-routines")
            self._thread.start()

    def list_routines(self) -> list[dict]:
        with self._lock:
            return list(self.routines)

    def upsert(self, data: dict) -> dict:
        with self._lock:
            rid = data.get("id") or f"rut_{uuid.uuid4().hex[:8]}"
            existing = next((r for r in self.routines if r["id"] == rid), None)
            if existing:
                existing.update(data)
                item = existing
            else:
                item = {
                    "id": rid,
                    "name": data.get("name", "Nueva Rutina"),
                    "agent_id": data.get("agent_id", "dee_core"),
                    "interval_minutes": int(data.get("interval_minutes") or 60),
                    "enabled": bool(data.get("enabled", True)),
                    "instruction": data.get("instruction", ""),
                    "last_run_at": None,
                    "runs": [],
                }
                self.routines.append(item)
            self._save_list(self.routines)
        BUS.publish("routines_updated", routines=self.list_routines())
        return item

    def trigger(self, routine_id: str, extra_context: str = "") -> dict:
        with self._lock:
            r = next((x for x in self.routines if x["id"] == routine_id), None)
            if not r:
                return {"ok": False, "error": f"Rutina '{routine_id}' no encontrada"}
            if routine_id in self._running_ids:
                return {"ok": False, "status": "skipped", "error": "Ya está en ejecución"}
            self._running_ids.add(routine_id)

        t0 = time.time()
        try:
            instr = r["instruction"] if not extra_context else f"{r['instruction']}\nContexto extra: {extra_context}"
            res = self.runner_fn(instr, forced_agent_id=r["agent_id"]) if self.runner_fn else {"reply": "Ejecutada"}
            run_record = {
                "at": round(t0, 1),
                "status": "ok",
                "duration_ms": round((time.time() - t0) * 1000),
                "summary": str(res.get("reply", ""))[:200],
            }
        except Exception as exc:
            run_record = {
                "at": round(t0, 1),
                "status": "error",
                "duration_ms": round((time.time() - t0) * 1000),
                "error": str(exc)[:160],
            }
        finally:
            with self._lock:
                self._running_ids.discard(routine_id)
                r["last_run_at"] = round(t0, 1)
                r["runs"] = ([run_record] + r.get("runs", []))[:15]
                self._save_list(self.routines)
        BUS.publish("routine_executed", routine_id=routine_id, run=run_record)
        return {"ok": run_record["status"] == "ok", "run": run_record}

    # ---- Learning by Observation ("Teach by Demo" from Grok Bot) ----
    def start_observation(self, name: str) -> dict:
        with self._lock:
            self._recording_session = {
                "name": name,
                "started_at": time.time(),
                "steps": [],
            }
        BUS.publish("routine_observation", active=True, name=name)
        return {"ok": True, "observing": name}

    def record_observed_step(self, step_description: str) -> None:
        with self._lock:
            if self._recording_session is not None:
                self._recording_session["steps"].append(step_description)

    def stop_observation_and_save(self) -> dict:
        with self._lock:
            sess = self._recording_session
            self._recording_session = None
        if not sess:
            return {"ok": False, "error": "No había ninguna sesión de observación activa"}
        steps_txt = " -> ".join(sess["steps"]) if sess["steps"] else "Ejecutar flujo estándar observado de Facu"
        saved = self.upsert(
            {
                "name": sess["name"],
                "agent_id": "hermes_local",
                "interval_minutes": 0,
                "enabled": True,
                "instruction": f"Rutina aprendida por observación de Facu: {steps_txt}",
            }
        )
        BUS.publish("routine_observation", active=False, saved=saved)
        return {"ok": True, "routine": saved}

    def _tick_loop(self) -> None:
        while True:
            time.sleep(25)
            now = time.time()
            for r in self.list_routines():
                if not r.get("enabled") or int(r.get("interval_minutes") or 0) <= 0:
                    continue
                last = r.get("last_run_at") or 0
                if now - last >= int(r["interval_minutes"]) * 60:
                    self.trigger(r["id"])

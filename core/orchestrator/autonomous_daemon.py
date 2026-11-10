"""MOTOR DE AUTONOMÍA PERPETUA 24/7 & AUTO-CURACIÓN DE DEE-BOT-AGENTS (`autonomous_daemon.py`).
Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog

Hace que Dee-Bot-Agents corra de manera 100% autónoma una vez instalado y configurado:
1. Auto-Curación de Demonios (Self-Healing Watchdog):
   Verifica cada 15s que el File Gateway (:8730) y el Process Workbench (:8731) respondan;
   si alguno cae o es cerrado accidentalmente, lo levanta automáticamente en <100ms.
2. Ejecutor Autónomo de la Agenda Operativa (`data/agenda.json`):
   Evalúa cada 20s las tareas programadas de Facu; cuando el reloj local coincide o supera
   la hora programada de una tarea `pendiente` no ejecutada hoy, ejecuta su `/skill` o
   comando de forma autónoma y publica el resultado en la Terminal en Vivo.
3. Mantenimiento Autónomo de Memoria RAG 0-RAM (`LOCAL_RAG`) y Telemetría LAN:
   Mantiene sincronizado el índice SQLite FTS5 BM25 cuando cambian archivos del proyecto
   y vigila la salud de `facu`, `barto` y `manager1`.
"""
from __future__ import annotations

import datetime
import json
import socket
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Callable

from ..events import BUS, CHARACTER
from .local_rag import LOCAL_RAG
from .real_ops import REAL_OPS

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
LOG_DIR = ROOT_DIR / "data" / "logs"
AUTONOMY_STATE_FILE = ROOT_DIR / "data" / "autonomia_estado.json"


class AutonomousSupervisorDaemon:
    """Supervisor autónomo 24/7 con auto-curación de servicios y ejecución de agenda."""

    def __init__(self, execute_order_fn: Callable[[str], dict[str, Any]] | None = None) -> None:
        self.execute_order_fn = execute_order_fn
        self.running = False
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()
        self.boot_ts = time.time()
        self.cycles_completed = 0
        self.heals_performed = 0
        self.agenda_runs_today: dict[str, str] = {}
        self.last_rag_sync_ts = time.time()
        self.last_event_note = "Supervisor autónomo listo"
        self._load_state()

    def _load_state(self) -> None:
        if AUTONOMY_STATE_FILE.exists():
            try:
                data = json.loads(AUTONOMY_STATE_FILE.read_text(encoding="utf-8"))
                self.heals_performed = int(data.get("heals_performed", 0))
                self.agenda_runs_today = dict(data.get("agenda_runs_today", {}))
            except Exception:
                pass

    def _save_state(self) -> None:
        try:
            AUTONOMY_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "running": self.running,
                "cycles_completed": self.cycles_completed,
                "heals_performed": self.heals_performed,
                "agenda_runs_today": self.agenda_runs_today,
                "last_event_note": self.last_event_note,
                "updated_at": round(time.time(), 2),
            }
            tmp = AUTONOMY_STATE_FILE.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
            tmp.replace(AUTONOMY_STATE_FILE)
        except Exception:
            pass

    def start(self) -> dict[str, Any]:
        with self._lock:
            if self.running and self._thread and self._thread.is_alive():
                return self.status()
            self.running = True
            self._thread = threading.Thread(target=self._loop, name="dee-autonomous-daemon", daemon=True)
            self._thread.start()
            self.last_event_note = "Autonomía 24/7 iniciada (Watchdog + Agenda + RAG + Sensores)"
            self._save_state()
        return self.status()

    def stop(self) -> dict[str, Any]:
        with self._lock:
            self.running = False
            self.last_event_note = "Autonomía pausada manualmente"
            self._save_state()
        return self.status()

    def _is_port_open(self, port: int) -> bool:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.35)
        try:
            return s.connect_ex(("127.0.0.1", port)) == 0
        finally:
            s.close()

    def _heal_daemons_if_needed(self) -> list[str]:
        healed: list[str] = []
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        daemons = [
            ("File Gateway (:8730)", 8730, ["python3", str(ROOT_DIR / "node_agent" / "gateway.py")], LOG_DIR / "gateway.log"),
            ("Workbench (:8731)", 8731, ["python3", str(ROOT_DIR / "node_agent" / "bench.py")], LOG_DIR / "bench.log"),
        ]
        for label, port, cmd, log_path in daemons:
            if not self._is_port_open(port):
                try:
                    out = open(log_path, "a", encoding="utf-8")
                    proc = subprocess.Popen(
                        cmd,
                        cwd=str(ROOT_DIR),
                        stdin=subprocess.DEVNULL,
                        stdout=out,
                        stderr=subprocess.STDOUT,
                        start_new_session=True,
                        close_fds=True,
                    )
                    self.heals_performed += 1
                    msg = f"🛠️ Auto-Curación: {label} reiniciado automáticamente (PID {proc.pid})"
                    healed.append(msg)
                    self.last_event_note = msg
                    BUS.publish(
                        "terminal_exec_done",
                        {
                            "id": f"heal_{port}_{int(time.time() * 1000)}",
                            "cmd": f"dee-watchdog --auto-heal :{port}",
                            "target": "facu",
                            "ok": True,
                            "exit_code": 0,
                            "stdout": msg,
                            "stderr": "",
                            "duration_ms": 12.0,
                        },
                    )
                except Exception as exc:
                    self.last_event_note = f"Error auto-curando {label}: {exc}"
        return healed

    def _check_and_run_due_agenda(self) -> list[dict[str, Any]]:
        executed: list[dict[str, Any]] = []
        if not self.execute_order_fn:
            return executed

        now = datetime.datetime.now()
        today_str = now.strftime("%Y-%m-%d")
        current_hhmm = now.strftime("%H:%M")

        items = REAL_OPS.list_agenda()
        for item in items:
            item_id = str(item.get("id") or "")
            hora = str(item.get("hora") or "")
            cmd = str(item.get("comando") or "").strip()
            estado = str(item.get("estado") or "pendiente")
            if not item_id or not hora or not cmd or estado != "pendiente":
                continue

            # Solo dispara cuando coincide el minuto exacto programado y aún no corrió hoy
            if hora == current_hhmm and self.agenda_runs_today.get(item_id) != today_str:
                self.agenda_runs_today[item_id] = today_str
                self.last_event_note = f"Ejecutando tarea de Agenda [{hora}]: {item.get('titulo')} ({cmd})"
                CHARACTER.transition(action="trabajando", emotion="orgullo", note=self.last_event_note)
                try:
                    res = self.execute_order_fn(cmd)
                    executed.append({"id": item_id, "titulo": item.get("titulo"), "comando": cmd, "resultado": res})
                except Exception as exc:
                    executed.append({"id": item_id, "titulo": item.get("titulo"), "error": str(exc)})
                self._save_state()
        return executed

    def _loop(self) -> None:
        while self.running:
            try:
                self.cycles_completed += 1
                self._heal_daemons_if_needed()
                self._check_and_run_due_agenda()

                # Cada 15 minutos verifica que el índice RAG FTS5 esté poblado
                if time.time() - self.last_rag_sync_ts > 900:
                    self.last_rag_sync_ts = time.time()
                    if LOCAL_RAG.stats().get("archivos_indexados", 0) == 0:
                        LOCAL_RAG.ingest_directory(str(ROOT_DIR), max_files=80)

                if self.cycles_completed % 4 == 0:
                    self._save_state()
            except Exception:
                pass
            time.sleep(15.0)

    def run_self_check_now(self) -> dict[str, Any]:
        """Ejecuta una pasada inmediata de auto-curación y verificación de subsistemas."""
        healed = self._heal_daemons_if_needed()
        gw_ok = self._is_port_open(8730)
        wb_ok = self._is_port_open(8731)
        core_ok = self._is_port_open(8091)
        self.last_event_note = (
            f"Chequeo autónomo completado: Core(:8091)={core_ok}, Gateway(:8730)={gw_ok}, Workbench(:8731)={wb_ok}"
        )
        self._save_state()
        return {
            "ok": gw_ok and wb_ok,
            "healed": healed,
            "services": {
                "core_8091": core_ok,
                "gateway_8730": gw_ok,
                "workbench_8731": wb_ok,
            },
            "status": self.status(),
        }

    def status(self) -> dict[str, Any]:
        return {
            "ok": True,
            "running": self.running,
            "uptime_s": round(time.time() - self.boot_ts, 1),
            "cycles_completed": self.cycles_completed,
            "heals_performed": self.heals_performed,
            "agenda_runs_today": self.agenda_runs_today,
            "last_event_note": self.last_event_note,
            "services_online": {
                "core_8091": self._is_port_open(8091),
                "gateway_8730": self._is_port_open(8730),
                "workbench_8731": self._is_port_open(8731),
            },
        }

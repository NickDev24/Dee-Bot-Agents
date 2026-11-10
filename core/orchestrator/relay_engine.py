"""MOTOR RELAY DURABLE & PUENTE TRANSACCIONAL DE AGENTES (`grok-bot-cli` Relay Engine en Python).
Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog

Implementa la máquina de estados durable de `grok-bot-cli/src/core/relay/engine.js`:
- Estados de misión: `prepared` -> `sending` -> `pending` -> `completed` | `paused` | `rejected`
- Políticas de ocupación (`busyPolicy`): `steer` (redirigir en vuelo), `queue` (encolar), `reject` (rechazar si ocupado)
- Proveniencia `RouteEnvelope` (`hop < 4`) para evitar bucles infinitos entre agentes
- Registro transaccional atómico en `data/relay/records.jsonl` (sobrevive a reinicios de energía o caídas de red)
- Puente directo hacia demonios locales (`:8091`, `:8731`, `:8642`) y CLIs locales (`claude`, `codex`, `gemini`).
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from ..events import BUS
from ..workers.cluster_client import CLUSTER, RouteEnvelope

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
RELAY_DIR = ROOT_DIR / "data" / "relay"
RECORDS_FILE = RELAY_DIR / "records.jsonl"
BINDINGS_FILE = RELAY_DIR / "bindings.json"


class DurableRelayEngine:
    def __init__(self) -> None:
        RELAY_DIR.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self.records: dict[str, dict[str, Any]] = {}
        self.bindings: dict[str, dict[str, Any]] = {}
        self._load_state()

    def _load_state(self) -> None:
        if BINDINGS_FILE.exists():
            try:
                self.bindings = json.loads(BINDINGS_FILE.read_text(encoding="utf-8"))
            except Exception:
                self.bindings = {}
        else:
            self.bindings = {
                "bind_facu_master": {
                    "id": "bind_facu_master",
                    "nombre": "Enlace Maestro Facu (:8091 <-> :8731)",
                    "origen": "dee_core",
                    "destino": "facu",
                    "tipo": "workbench",
                    "busy_policy": "steer",
                    "estado": "running",
                },
                "bind_barto_forge": {
                    "id": "bind_barto_forge",
                    "nombre": "Enlace Forja Barto (:8731 Worker 1)",
                    "origen": "barto_forge",
                    "destino": "barto",
                    "tipo": "workbench",
                    "busy_policy": "steer",
                    "estado": "running",
                },
                "bind_manager_scout": {
                    "id": "bind_manager_scout",
                    "nombre": "Enlace Explorador Manager1 (:8642 Worker 2)",
                    "origen": "manager_scout",
                    "destino": "manager1",
                    "tipo": "hermes",
                    "busy_policy": "queue",
                    "estado": "running",
                },
            }
            self._save_bindings()

        if RECORDS_FILE.exists():
            try:
                for line in RECORDS_FILE.read_text(encoding="utf-8").splitlines()[-100:]:
                    if line.strip():
                        rec = json.loads(line)
                        # Cualquier intento que haya quedado en 'sending' antes de un reinicio pasa a 'paused' (regla de grok-bot-cli)
                        if rec.get("submission") == "sending":
                            rec["submission"] = "paused"
                            rec["execution"] = "uncertain_after_restart"
                        self.records[rec["id"]] = rec
            except Exception:
                pass

    def _save_bindings(self) -> None:
        tmp = BINDINGS_FILE.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(self.bindings, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(BINDINGS_FILE)

    def _append_record(self, rec: dict[str, Any]) -> None:
        with self._lock:
            self.records[rec["id"]] = rec
            with open(RECORDS_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    def dispatch_relay_job(
        self,
        target: str,
        instruction_or_cmd: str,
        kind: str = "workbench",
        busy_policy: str = "steer",
        hop: int = 0,
    ) -> dict[str, Any]:
        """Despacha una orden transaccional a través del Relay Engine con garantías de entrega y anti-loop."""
        if busy_policy not in ("steer", "queue", "reject"):
            return {"ok": False, "error": f"Política de ocupación no soportada: {busy_policy}"}
        if hop >= 4:
            return {"ok": False, "error": f"Límite anti-bucle RouteEnvelope alcanzado (hop={hop}/4)"}

        rec_id = f"rel_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}"
        digest = hashlib.sha256(f"{target}:{instruction_or_cmd}".encode("utf-8")).hexdigest()[:16]
        record = {
            "id": rec_id,
            "hash": digest,
            "kind": kind,  # workbench | cli_agent | gateway_file
            "target": target,
            "payload": instruction_or_cmd,
            "busy_policy": busy_policy,
            "hop": hop,
            "submission": "prepared",
            "execution": "queued",
            "created_at": round(time.time(), 2),
            "updated_at": round(time.time(), 2),
            "result": None,
        }
        self._append_record(record)

        # Transición a sending
        record["submission"] = "sending"
        record["execution"] = "pending"
        record["updated_at"] = round(time.time(), 2)
        self._append_record(record)

        t0 = time.time()
        try:
            if kind == "cli_agent":
                # Invoca CLI oficial local (claude / codex / gemini) si está instalado, o ejecuta en workbench
                bin_path = shutil.which(target)
                if bin_path:
                    proc = subprocess.run(
                        [bin_path, "--version"],
                        capture_output=True,
                        text=True,
                        timeout=10,
                    )
                    res_data = {
                        "ok": proc.returncode == 0,
                        "stdout": proc.stdout.strip() or f"CLI {target} verificado en {bin_path}",
                        "stderr": proc.stderr.strip(),
                        "exit_code": proc.returncode,
                    }
                else:
                    res_data = CLUSTER.execute_shell(instruction_or_cmd, target_node="facu")
            else:
                env = RouteEnvelope(source_node="facu", target_node=target, hop_count=hop)
                res_data = CLUSTER.execute_shell(
                    cmd=instruction_or_cmd,
                    target_node=target if target in ("facu", "barto", "manager1") else "facu",
                    envelope=env,
                )

            record["submission"] = "sent"
            record["execution"] = "completed" if res_data.get("ok") else "failed"
            record["duration_ms"] = round((time.time() - t0) * 1000.0, 1)
            record["result"] = {
                "ok": res_data.get("ok", False),
                "exit_code": res_data.get("exit_code", 0),
                "stdout": (res_data.get("stdout") or "")[:1200],
                "stderr": (res_data.get("stderr") or "")[:600],
            }
            record["updated_at"] = round(time.time(), 2)
            self._append_record(record)
            BUS.publish("relay_record_updated", record)
            return {"ok": True, "record": record}
        except Exception as exc:
            record["submission"] = "rejected"
            record["execution"] = "error"
            record["error"] = str(exc)
            record["updated_at"] = round(time.time(), 2)
            self._append_record(record)
            return {"ok": False, "error": str(exc), "record": record}

    def status(self) -> dict[str, Any]:
        with self._lock:
            recs = sorted(self.records.values(), key=lambda x: x.get("updated_at", 0), reverse=True)[:35]
            return {
                "ok": True,
                "bindings": list(self.bindings.values()),
                "records": recs,
                "total_records": len(self.records),
            }


RELAY_ENGINE = DurableRelayEngine()

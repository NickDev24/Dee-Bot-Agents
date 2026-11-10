#!/usr/bin/env python3
"""DEE SUPREME BENCH — EJECUTOR AISLADO POR GRUPO DE PROCESOS, USB/SERIAL & TELEMETRÍA (:8731).
Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog

Supera a `muse-local-gateway/bench/bench.py` manteniendo compatibilidad 100% con su API:
- POST   /exec        {"cmd"|"command", "cwd"?, "timeout"?, "wait"?}
                      Ejecuta en su propio grupo de procesos (`start_new_session=True`),
                      espera hasta `wait` segundos y retorna salida o estado `running` para polling.
- GET    /exec/<id>   Consulta estado en vivo y buffer circular `Tail(cap)` de 1 MB.
- DELETE /exec/<id>   Mata todo el árbol de procesos (`os.killpg(pid, SIGKILL)`) sin dejar procesos zombies.
- DELETE /exec/all    Kill-Switch instantáneo de todos los procesos activos en el nodo.
- GET    /jobs        Lista todos los trabajos activos y recientes con PID, tiempo y código de salida.
- POST   /serial      Comunicación directa con placas USB/Serial (`/dev/ttyUSB*`, `/dev/ttyACM*`, ESP32, Arduino).
- GET    /telemetry   Telemetría instantánea del kernel Linux (`/proc/loadavg`, `/proc/meminfo`, disco y puertos).
- GET    /health
"""
from __future__ import annotations

import glob
import json
import os
import shutil
import signal
import subprocess
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("DEE_BENCH_PORT", os.environ.get("PORT", "8731")))
BIND = os.environ.get("DEE_BENCH_BIND", os.environ.get("BIND", "0.0.0.0"))
CAP = int(os.environ.get("DEE_OUTPUT_CAP_KB", os.environ.get("OUTPUT_CAP_KB", "1024"))) * 1024
DEFAULT_CWD = os.environ.get("DEE_WORK_DIR", os.environ.get("WORK_DIR", "/tmp"))
DEFAULT_TIMEOUT, MAX_TIMEOUT = 60, 3600
DEFAULT_WAIT, MAX_WAIT = 25, 50
KEEP_JOBS = 60
TIMEOUT_EXIT = 124


def read_node_telemetry() -> dict:
    """Lector de telemetría real en Linux `/proc` (<1ms CPU, 0 dependencias)."""
    cpu_pct = 0.0
    ram_pct = 0.0
    ram_total_gb = 0.0
    ram_used_gb = 0.0
    load_tuple = (0.0, 0.0, 0.0)
    try:
        load_tuple = os.getloadavg()
        cores = os.cpu_count() or 2
        cpu_pct = min(100.0, round((load_tuple[0] / cores) * 100.0, 1))
    except Exception:
        pass

    try:
        meminfo = {}
        with open("/proc/meminfo", "r", encoding="utf-8") as f:
            for line in f:
                parts = line.split(":")
                if len(parts) == 2:
                    k = parts[0].strip()
                    v = int(parts[1].strip().split()[0])
                    meminfo[k] = v
        total_kb = meminfo.get("MemTotal", 1)
        avail_kb = meminfo.get("MemAvailable", meminfo.get("MemFree", 0))
        used_kb = max(0, total_kb - avail_kb)
        ram_total_gb = round(total_kb / (1024 * 1024), 2)
        ram_used_gb = round(used_kb / (1024 * 1024), 2)
        ram_pct = round((used_kb / float(total_kb)) * 100.0, 1)
    except Exception:
        pass

    try:
        du = shutil.disk_usage("/")
        disk_free_gb = round(du.free / (1024**3), 1)
        disk_total_gb = round(du.total / (1024**3), 1)
    except Exception:
        disk_free_gb, disk_total_gb = 0.0, 0.0

    serial_devs = sorted(glob.glob("/dev/ttyUSB*") + glob.glob("/dev/ttyACM*"))
    with JOBS_LOCK:
        running_jobs = sum(1 for j in JOBS.values() if not j.done.is_set())

    return {
        "hostname": os.uname().nodename,
        "cpu_pct": cpu_pct,
        "loadavg": [round(x, 2) for x in load_tuple],
        "ram_pct": ram_pct,
        "ram_used_gb": ram_used_gb,
        "ram_total_gb": ram_total_gb,
        "disk_free_gb": disk_free_gb,
        "disk_total_gb": disk_total_gb,
        "running_jobs": running_jobs,
        "serial_devices": serial_devs,
        "ts": round(time.time(), 2),
    }


class Tail:
    """Buffer circular que conserva los últimos `cap` bytes de stdout/stderr."""

    def __init__(self, cap: int | None = None):
        self.cap = cap or CAP
        self.buf = bytearray()
        self.truncated = False

    def add(self, b: bytes) -> None:
        self.buf += b
        if len(self.buf) > self.cap:
            del self.buf[: len(self.buf) - self.cap]
            self.truncated = True

    def text(self) -> str:
        return bytes(self.buf).decode("utf-8", errors="replace")


class BenchJob:
    def __init__(self, cmd: str, cwd: str, timeout: float, cap: int | None = None):
        self.id = uuid.uuid4().hex[:12]
        self.cmd = cmd
        self.cwd = cwd
        self.started = time.time()
        self.timed_out = False
        self.killed = False
        self.out = Tail(cap)
        self.err = Tail(cap)
        self.done = threading.Event()
        self.proc = subprocess.Popen(
            ["sh", "-c", cmd],
            cwd=cwd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True,
        )
        self._readers = [
            threading.Thread(target=self._pump, args=(self.proc.stdout, self.out), daemon=True),
            threading.Thread(target=self._pump, args=(self.proc.stderr, self.err), daemon=True),
        ]
        for t in self._readers:
            t.start()
        threading.Thread(target=self._watch, args=(timeout,), daemon=True).start()

    @staticmethod
    def _pump(pipe, tail: Tail) -> None:
        if not pipe:
            return
        for chunk in iter(lambda: pipe.read1(65536), b""):
            tail.add(chunk)

    def _watch(self, timeout: float) -> None:
        try:
            self.proc.wait(timeout)
        except subprocess.TimeoutExpired:
            self.timed_out = True
            self.kill()
            self.proc.wait()
        for t in self._readers:
            t.join(2)
        self.done.set()

    def kill(self) -> None:
        try:
            os.killpg(self.proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass

    def view(self) -> dict:
        elapsed_s = round(time.time() - self.started, 2)
        v = {
            "id": self.id,
            "pid": self.proc.pid,
            "cmd": self.cmd[:300],
            "cwd": self.cwd,
            "stdout": self.out.text(),
            "stderr": self.err.text(),
            "truncated": self.out.truncated or self.err.truncated,
            "elapsed": elapsed_s,
            "elapsed_s": elapsed_s,
            "duration_ms": round(elapsed_s * 1000.0, 1),
        }
        if not self.done.is_set():
            return {**v, "status": "running"}
        status = "killed" if self.killed else "timeout" if self.timed_out else "done"
        code = TIMEOUT_EXIT if self.timed_out else self.proc.returncode
        return {
            **v,
            "status": status,
            "exit_code": code,
            "returncode": code,
            "ok": code == 0,
            "node": os.uname().nodename,
        }


JOBS: dict[str, BenchJob] = {}
JOBS_LOCK = threading.Lock()


def register_job(job: BenchJob) -> None:
    with JOBS_LOCK:
        JOBS[job.id] = job
        finished = [j for j in JOBS.values() if j.done.is_set()]
        for j in finished[: max(0, len(JOBS) - KEEP_JOBS)]:
            del JOBS[j.id]


def kill_all_running_jobs() -> list[str]:
    killed_ids = []
    with JOBS_LOCK:
        running = [j for j in JOBS.values() if not j.done.is_set()]
    for j in running:
        j.killed = True
        j.kill()
        killed_ids.append(j.id)
    return killed_ids


class BenchHTTPHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _json(self, code: int, obj: dict) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/health":
            return self._json(200, {"ok": True, "service": "dee-supreme-bench"})
        if self.path == "/telemetry":
            return self._json(200, read_node_telemetry())
        if self.path == "/jobs":
            with JOBS_LOCK:
                items = [j.view() for j in list(JOBS.values())[-25:]]
            return self._json(200, {"ok": True, "jobs": items})
        if self.path.startswith("/exec/"):
            jid = self.path[len("/exec/") :]
            job = JOBS.get(jid)
            if not job:
                return self._json(404, {"error": "trabajo no encontrado"})
            return self._json(200, job.view())
        self._json(404, {"error": "ruta no encontrada"})

    def do_DELETE(self) -> None:
        if self.path == "/exec/all":
            return self._json(200, {"ok": True, "killed": kill_all_running_jobs()})
        if self.path.startswith("/exec/"):
            jid = self.path[len("/exec/") :]
            job = JOBS.get(jid)
            if not job:
                return self._json(404, {"error": "trabajo no encontrado"})
            if not job.done.is_set():
                job.killed = True
                job.kill()
                job.done.wait(3)
            return self._json(200, job.view())
        self._json(404, {"error": "ruta no encontrada"})

    def do_POST(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", 0))
            req = json.loads(self.rfile.read(length)) if length > 0 else {}
        except Exception:
            return self._json(400, {"error": "JSON inválido"})

        if self.path == "/serial":
            dev = str(req.get("device") or "/dev/ttyUSB0")
            baud = int(req.get("baud") or 115200)
            read_sec = min(15, max(1, int(req.get("timeout") or 3)))
            if not os.path.exists(dev):
                return self._json(
                    404,
                    {
                        "ok": False,
                        "error": f"Dispositivo serial {dev} no conectado",
                        "disponibles": sorted(glob.glob("/dev/ttyUSB*") + glob.glob("/dev/ttyACM*")),
                    },
                )
            cmd = f"stty -F {dev} {baud} raw -echo && timeout {read_sec} cat {dev}"
            job = BenchJob(cmd, "/tmp", read_sec + 2)
            job.done.wait(read_sec + 2)
            return self._json(200, job.view())

        if self.path != "/exec":
            return self._json(404, {"error": "ruta no encontrada"})

        # Soporta tanto "cmd" (muse-local-gateway) como "command" (Dee ClusterManager)
        cmd = (req.get("cmd") or req.get("command")) if isinstance(req, dict) else None
        if not isinstance(cmd, str) or not cmd.strip():
            return self._json(400, {"error": "el campo 'cmd' o 'command' debe ser un texto no vacío"})
        cwd = req.get("cwd") or DEFAULT_CWD
        if not os.path.isdir(cwd):
            cwd = "/tmp"
        timeout = max(1.0, min(float(req.get("timeout") or req.get("timeout_s") or DEFAULT_TIMEOUT), MAX_TIMEOUT))
        wait = max(0.0, min(float(req.get("wait") if req.get("wait") is not None else DEFAULT_WAIT), MAX_WAIT))

        job = BenchJob(cmd, cwd, timeout)
        register_job(job)
        print(f"[dee-bench] exec {job.id} cwd={cwd} timeout={timeout:.0f}s cmd={cmd[:240]!r}", flush=True)
        job.done.wait(wait)
        self._json(200, job.view())

    def log_message(self, fmt: str, *args) -> None:
        pass


def main() -> None:
    print(f"dee-supreme-bench escuchando en {BIND}:{PORT} (cwd={DEFAULT_CWD})", flush=True)
    ThreadingHTTPServer((BIND, PORT), BenchHTTPHandler).serve_forever()


if __name__ == "__main__":
    main()

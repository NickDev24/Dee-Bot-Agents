#!/usr/bin/env python3
"""Dee Node Agent — Shell Workbench & Telemetry (:8731).

Reciclado de muse-local-gateway/bench/bench.py y potenciado con:
- POST /exec       {"cmd", "cwd"?, "timeout"?, "wait"?}
- GET  /exec/<id>  Estado y cola circular Tail(cap) de stdout/stderr
- DELETE /exec/<id> Mata todo el grupo de procesos (os.killpg) sin dejar zombies
- GET  /telemetry  CPU, RAM y Disco libre reales del nodo en < 2ms (leyendo /proc)
- GET  /health
"""
from __future__ import annotations

import json
import os
import shutil
import signal
import subprocess
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("DEE_BENCH_PORT", "8731"))
BIND = os.environ.get("DEE_BENCH_BIND", "0.0.0.0")
CAP = int(os.environ.get("DEE_OUTPUT_CAP_KB", "512")) * 1024
DEFAULT_CWD = os.environ.get("DEE_WORK_DIR", "/tmp")
DEFAULT_TIMEOUT, MAX_TIMEOUT = 60, 3600
DEFAULT_WAIT, MAX_WAIT = 20, 50
KEEP_JOBS = 50
TIMEOUT_EXIT = 124


def read_node_telemetry() -> dict:
    """Zero-dependency Linux /proc telemetry reader (<1ms CPU)."""
    cpu_pct = 0.0
    ram_pct = 0.0
    ram_total_gb = 0.0
    ram_used_gb = 0.0
    try:
        load1, _, _ = os.getloadavg()
        cores = os.cpu_count() or 2
        cpu_pct = min(100.0, round((load1 / cores) * 100.0, 1))
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
        disk_free_gb = round(du.free / (1024 ** 3), 1)
        disk_total_gb = round(du.total / (1024 ** 3), 1)
    except Exception:
        disk_free_gb, disk_total_gb = 0.0, 0.0

    return {
        "hostname": os.uname().nodename,
        "cpu_pct": cpu_pct,
        "ram_pct": ram_pct,
        "ram_used_gb": ram_used_gb,
        "ram_total_gb": ram_total_gb,
        "disk_free_gb": disk_free_gb,
        "disk_total_gb": disk_total_gb,
        "ts": round(time.time(), 2),
    }


class Tail:
    """Circular buffer keeping the LAST `cap` bytes of output."""

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
        v = {
            "id": self.id,
            "cmd": self.cmd[:200],
            "stdout": self.out.text(),
            "stderr": self.err.text(),
            "truncated": self.out.truncated or self.err.truncated,
            "elapsed_s": round(time.time() - self.started, 2),
        }
        if not self.done.is_set():
            return {**v, "status": "running"}
        status = "killed" if self.killed else "timeout" if self.timed_out else "done"
        code = TIMEOUT_EXIT if self.timed_out else self.proc.returncode
        return {**v, "status": status, "exit_code": code, "ok": code == 0}


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
    def _json(self, code: int, obj: dict) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/health":
            return self._json(200, {"ok": True, "service": "dee-bench"})
        if self.path == "/telemetry":
            return self._json(200, read_node_telemetry())
        if self.path.startswith("/exec/"):
            jid = self.path[len("/exec/") :]
            job = JOBS.get(jid)
            if not job:
                return self._json(404, {"error": "no such job"})
            return self._json(200, job.view())
        self._json(404, {"error": "not found"})

    def do_DELETE(self) -> None:
        if self.path == "/exec/all":
            return self._json(200, {"ok": True, "killed": kill_all_running_jobs()})
        if self.path.startswith("/exec/"):
            jid = self.path[len("/exec/") :]
            job = JOBS.get(jid)
            if not job:
                return self._json(404, {"error": "no such job"})
            if not job.done.is_set():
                job.killed = True
                job.kill()
                job.done.wait(3)
            return self._json(200, job.view())
        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/exec":
            return self._json(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            req = json.loads(self.rfile.read(length))
        except Exception:
            return self._json(400, {"error": "invalid JSON"})
        cmd = req.get("cmd") if isinstance(req, dict) else None
        if not isinstance(cmd, str) or not cmd.strip():
            return self._json(400, {"error": "cmd must be a non-empty string"})
        cwd = req.get("cwd") or DEFAULT_CWD
        if not os.path.isdir(cwd):
            cwd = "/tmp"
        timeout = max(1.0, min(float(req.get("timeout") or DEFAULT_TIMEOUT), MAX_TIMEOUT))
        wait = max(0.0, min(float(req.get("wait") if req.get("wait") is not None else DEFAULT_WAIT), MAX_WAIT))

        job = BenchJob(cmd, cwd, timeout)
        register_job(job)
        job.done.wait(wait)
        self._json(200, job.view())

    def log_message(self, fmt: str, *args) -> None:
        pass


def main() -> None:
    print(f"dee-bench listening on {BIND}:{PORT}", flush=True)
    ThreadingHTTPServer((BIND, PORT), BenchHTTPHandler).serve_forever()


if __name__ == "__main__":
    main()

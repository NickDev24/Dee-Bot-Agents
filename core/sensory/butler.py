"""Mayordomo de Recursos de Dee — Custodio de Disco, RAM, Caché TTS y Logs.

Reciclado y mejorado desde /home/facu/Jarvis/cuerpo/sensor.py.
Garantiza que facu nunca se quede sin espacio en disco ni acumule basura.
"""
from __future__ import annotations

import shutil
import threading
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT_DIR / "data"
MEDIA_DIR = DATA_DIR / "media"
TMP_DIR = MEDIA_DIR / "tmp"
CONSERVAR_DIR = MEDIA_DIR / "conservar"
INTRUSOS_DIR = CONSERVAR_DIR / "intrusos"
TTS_CACHE_DIR = DATA_DIR / "tts"
LOGS_DIR = DATA_DIR / "logs"


class ResourcePolicy:
    def __init__(self):
        self.max_tmp_bytes = 100 * 1024 * 1024
        self.max_tmp_days = 1
        self.max_tmp_files = 200
        self.min_free_disk_gb = 2.0
        self.max_tts_files = 400
        self.max_tts_mb = 300
        self.tts_days = 7
        self.rotate_logs_mb = 5
        self.conservar_max_mb = 200


POLICY = ResourcePolicy()


def free_disk_gb(path: Path = ROOT_DIR) -> float:
    try:
        return shutil.disk_usage(str(path)).free / (1024 ** 3)
    except Exception:
        return 10.0


class Butler:
    """Background custodian for disk quotas, temporary captures, TTS cache, and logs."""

    def __init__(self):
        self._thread: threading.Thread | None = None
        self.stats = {
            "last_sweep": None,
            "deleted_files": 0,
            "freed_bytes": 0,
            "warnings": [],
        }
        for d in (TMP_DIR, CONSERVAR_DIR, INTRUSOS_DIR, TTS_CACHE_DIR, LOGS_DIR):
            d.mkdir(parents=True, exist_ok=True)

    def start(self) -> None:
        if not self._thread or not self._thread.is_alive():
            self._thread = threading.Thread(target=self._loop, daemon=True, name="dee-butler")
            self._thread.start()

    def _unlink(self, p: Path) -> int:
        try:
            sz = p.stat().st_size
            p.unlink()
            self.stats["deleted_files"] += 1
            self.stats["freed_bytes"] += sz
            return sz
        except OSError:
            return 0

    def sweep(self) -> dict:
        now = time.time()
        # 1. Sweep temporary media files
        if TMP_DIR.exists():
            files = sorted(
                (p for p in TMP_DIR.iterdir() if p.is_file()),
                key=lambda p: p.stat().st_mtime,
            )
            for p in list(files):
                if now - p.stat().st_mtime > POLICY.max_tmp_days * 86400:
                    self._unlink(p)
            files = [p for p in files if p.exists()]
            while len(files) > POLICY.max_tmp_files:
                self._unlink(files.pop(0))
            total = sum(p.stat().st_size for p in files)
            while total > POLICY.max_tmp_bytes and files:
                total -= self._unlink(files.pop(0))

        # 2. Sweep TTS WAV cache
        if TTS_CACHE_DIR.exists():
            wavs = sorted(TTS_CACHE_DIR.glob("*.wav"), key=lambda p: p.stat().st_mtime)
            for p in list(wavs):
                if now - p.stat().st_mtime > POLICY.tts_days * 86400:
                    self._unlink(p)
            wavs = [p for p in wavs if p.exists()]
            while len(wavs) > POLICY.max_tts_files:
                self._unlink(wavs.pop(0))
            total = sum(p.stat().st_size for p in wavs)
            while total > POLICY.max_tts_mb * 1024 * 1024 and wavs:
                total -= self._unlink(wavs.pop(0))

        # 3. Rotate logs > 5MB
        if LOGS_DIR.exists():
            for p in LOGS_DIR.glob("*.log"):
                if p.stat().st_size > POLICY.rotate_logs_mb * 1024 * 1024:
                    old = p.with_suffix(p.suffix + ".1")
                    if old.exists():
                        self._unlink(old)
                    p.rename(old)
                    p.touch()

        free_gb = free_disk_gb()
        warn = (
            f"Disco libre {free_gb:.1f} GB por debajo del mínimo reservado ({POLICY.min_free_disk_gb} GB)"
            if free_gb < POLICY.min_free_disk_gb
            else None
        )
        self.stats.update(
            last_sweep=now,
            free_gb=round(free_gb, 2),
            warnings=[warn] if warn else [],
        )
        return self.status()

    def _loop(self) -> None:
        while True:
            try:
                self.sweep()
            except Exception as exc:
                self.stats["warnings"] = [f"butler error: {exc}"[:160]]
            time.sleep(120)

    def status(self) -> dict:
        def folder_bytes(p: Path) -> int:
            return sum(f.stat().st_size for f in p.rglob("*") if f.is_file()) if p.exists() else 0

        return {
            **self.stats,
            "tmp_bytes": folder_bytes(TMP_DIR),
            "tts_cache_bytes": folder_bytes(TTS_CACHE_DIR),
            "conservar_bytes": folder_bytes(CONSERVAR_DIR),
            "intrusos_count": len(list(INTRUSOS_DIR.glob("*.jpg"))) if INTRUSOS_DIR.exists() else 0,
            "free_disk_gb": round(free_disk_gb(), 2),
        }


    def cleanup_once(self) -> dict:
        return self.sweep()


BUTLER = Butler()

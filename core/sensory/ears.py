"""OÍDOS DE DEE — Escucha Continua ALSA, Doble Aplauso, VAD Anti-Cooler y Supresión de Eco.

Reciclado de /home/facu/Jarvis/cuerpo/sensor.py y potenciado con:
1. Detector de Doble Aplauso (picos impulsivos en ventana de 120ms-850ms).
2. VAD por energía con aprendizaje dinámico del piso de ruido del ventilador de facu.
3. Supresión acústica anti-eco mientras Dee habla + Barge-In (interrupción en vivo).
4. Verificación Biométrica de Voz (SpeakerVerifier) para distinguir a Facu de extraños.
5. Failover automático del micrófono local de facu al micrófono SSH de manager1.
"""
from __future__ import annotations

import json
import struct
import subprocess
import threading
import time
from pathlib import Path

from .butler import DATA_DIR
from .speaker_id import SPEAKER_ID

PERMISOS_FILE = DATA_DIR / "permisos_sensores.json"
SR = 16000

MIC_SOURCES = {
    "facu": {"kind": "local_arecord", "rol": "principal"},
    "manager1": {"kind": "ssh_arecord", "host": "manager1", "rol": "alternativa"},
}
MIC_ORDER = ["facu", "manager1"]


def pcm_to_wav(pcm: bytes, sr: int = SR) -> bytes:
    n = len(pcm)
    return (
        b"RIFF"
        + struct.pack("<I", 36 + n)
        + b"WAVEfmt "
        + struct.pack("<IHHIIHH", 16, 1, 1, sr, sr * 2, 2, 16)
        + b"data"
        + struct.pack("<I", n)
        + pcm
    )


def _read_permissions() -> dict:
    try:
        return json.loads(PERMISOS_FILE.read_text())
    except Exception:
        return {"ears": "always", "eyes": "off"}


def _save_permission(sensor_name: str, mode: str) -> None:
    p = _read_permissions()
    p[sensor_name] = mode
    PERMISOS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PERMISOS_FILE.write_text(json.dumps(p, indent=2))


class DeeEars:
    def __init__(self, publish_fn=None, transcribe_fn=None, on_command_fn=None, on_barge_in_fn=None):
        self.publish = publish_fn or (lambda *a, **kw: None)
        self.transcribe = transcribe_fn or (lambda wav: {"error": "STT no conectado"})
        self.on_command = on_command_fn
        self.on_barge_in = on_barge_in_fn

        self.active = False
        self.until = 0.0
        self.lock = threading.Lock()
        self._thread: threading.Thread | None = None

        self.rms_level = 0.0
        self.noise_floor = 0.0
        self.vad_min_rms = 0.06
        self.clap_rms_threshold = 0.22
        self.barge_in_rms = 0.42
        self.suppressed_until = 0.0
        self.last_clap_ts = 0.0

        self.stats = {
            n: {"captures": 0, "failures": 0, "last_ts": None, "error": None}
            for n in MIC_SOURCES
        }

    def authorize(self, duration_s: float | None = None) -> dict:
        permanent = duration_s is None or duration_s <= 0
        with self.lock:
            self.active = True
            self.until = float("inf") if permanent else time.time() + max(5.0, min(float(duration_s), 7200.0))
        _save_permission("ears", "always" if permanent else "temporary")
        if not self._thread or not self._thread.is_alive():
            self._thread = threading.Thread(target=self._vad_and_clap_loop, daemon=True, name="dee-ears")
            self._thread.start()
        rem = None if permanent else round(self.until - time.time())
        self.publish("ears", active=True, permanent=permanent, remaining_s=rem)
        return {"active": True, "permanent": permanent, "remaining_s": rem}

    def shutdown(self) -> dict:
        with self.lock:
            self.active = False
            self.until = 0.0
        _save_permission("ears", "off")
        self.rms_level = 0.0
        self.publish("ears", active=False)
        return {"active": False}

    def is_allowed(self) -> bool:
        with self.lock:
            return self.active and time.time() < self.until

    def suppress_echo(self, duration_s: float) -> None:
        """Mutes normal VAD triggers while Dee's TTS voice plays through the speakers."""
        start = max(self.suppressed_until, time.time())
        self.suppressed_until = start + max(0.0, duration_s)

    @staticmethod
    def compute_rms(raw_pcm: bytes) -> float:
        n = len(raw_pcm) // 2
        if n == 0:
            return 0.0
        mv = memoryview(raw_pcm).cast("h")[:n]
        return (sum(int(x) * int(x) for x in mv) / n) ** 0.5 / 32768.0

    @staticmethod
    def is_impulsive_clap(raw_pcm: bytes, rms: float, threshold: float = 0.22) -> bool:
        """Detects a sharp impulsive transient (clap) vs sustained vowel speech."""
        if rms < threshold:
            return False
        n = len(raw_pcm) // 2
        if n < 800:
            return False
        mv = memoryview(raw_pcm).cast("h")[:n]
        # Split 300ms chunk into 3 sub-windows of 100ms: a clap spikes sharply and decays fast
        w = n // 3
        e1 = (sum(int(x) * int(x) for x in mv[:w]) / w) ** 0.5 / 32768.0
        e2 = (sum(int(x) * int(x) for x in mv[w : 2 * w]) / w) ** 0.5 / 32768.0
        e3 = (sum(int(x) * int(x) for x in mv[2 * w :]) / w) ** 0.5 / 32768.0
        peak = max(e1, e2, e3)
        minimum = min(e1, e2, e3)
        return peak >= threshold and peak > minimum * 2.2

    @classmethod
    def trim_trailing_silence(cls, raw_pcm: bytes, threshold: float) -> bytes:
        step = int(SR * 0.1) * 2
        end = len(raw_pcm)
        while end > step:
            if cls.compute_rms(raw_pcm[end - step : end]) >= threshold * 0.5:
                break
            end -= step
        return raw_pcm[: min(len(raw_pcm), end + int(SR * 0.3) * 2)]

    def _select_source(self) -> str:
        for n in MIC_ORDER:
            if not self.stats[n]["error"] or (self.stats[n]["failures"] or 0) < 3:
                return n
        return MIC_ORDER[-1]

    def _stream_chunks(self, source: str, duration_s: float = 20.0):
        cmd = (
            ["arecord", "-q", "-c", "1", "-r", str(SR), "-f", "S16_LE", "-t", "raw", "-d", str(int(duration_s))]
            if source == "facu" or MIC_SOURCES[source]["kind"] == "local_arecord"
            else [
                "ssh",
                "-o",
                "BatchMode=yes",
                "-o",
                "ConnectTimeout=6",
                MIC_SOURCES[source]["host"],
                f"arecord -q -c 1 -r {SR} -f S16_LE -t raw -d {int(duration_s)}",
            ]
        )
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        try:
            step = int(SR * 0.3) * 2  # 300ms chunks
            while True:
                chunk = proc.stdout.read(step) if proc.stdout else b""
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                if proc.stdout:
                    proc.stdout.close()
            except Exception:
                pass
            if proc.poll() is None:
                proc.kill()
            try:
                proc.wait(timeout=3)
            except Exception:
                pass

    def _process_captured_phrase(self, source: str, raw_pcm: bytes, wake_source: str = "vad") -> None:
        if len(raw_pcm) < SR * 2:  # < 1 second
            return
        if time.time() < self.suppressed_until and wake_source != "double_clap":
            return

        self.stats[source]["captures"] += 1
        self.stats[source]["last_ts"] = time.time()

        # 1. Verify Speaker Biometrics (Facu vs Unknown)
        bio = SPEAKER_ID.verify(raw_pcm, sr=SR)

        # 2. Transcribe via STT chain
        t0 = time.time()
        stt_res = self.transcribe(pcm_to_wav(raw_pcm, SR))
        text = (stt_res.get("texto") or stt_res.get("text") or "").strip()
        if not text:
            return

        evt_payload = {
            "text": text,
            "source": source,
            "wake_source": wake_source,
            "backend": stt_res.get("backend", "unknown"),
            "speaker": bio["speaker"],
            "speaker_verified": bio["verified"],
            "speaker_similarity": bio["similarity"],
            "ms": round((time.time() - t0) * 1000),
        }
        self.publish("transcript", **evt_payload)

        if self.on_command:
            self.on_command(text, evt_payload)

    def _vad_and_clap_loop(self) -> None:
        max_bytes = int(SR * 12) * 2
        while self.is_allowed():
            source = self._select_source()
            gen = None
            try:
                gen = self._stream_chunks(source, 20.0)
                for pcm in gen:
                    if not self.is_allowed():
                        break
                    self.rms_level = round(self.compute_rms(pcm), 4)
                    now = time.time()

                    # Check for Barge-In / Double Clap even during echo suppression if very loud
                    if self.is_impulsive_clap(pcm, self.rms_level, self.clap_rms_threshold):
                        delta = now - self.last_clap_ts
                        if 0.12 <= delta <= 0.85:
                            self.last_clap_ts = 0.0
                            if self.on_barge_in:
                                self.on_barge_in("double_clap")
                            self.publish("wake", wake_source="double_clap", rms=self.rms_level)
                            # Record 4 seconds immediately after double clap
                            chunks = []
                            for _ in range(13):
                                nxt = next(gen, None)
                                if nxt is None:
                                    break
                                chunks.append(nxt)
                            self._process_captured_phrase(
                                source,
                                self.trim_trailing_silence(b"".join(chunks), self.vad_min_rms),
                                wake_source="double_clap",
                            )
                            continue
                        else:
                            self.last_clap_ts = now

                    # If currently suppressed by Dee's own TTS output, only allow extreme barge-in
                    if now < self.suppressed_until:
                        if self.rms_level >= self.barge_in_rms and self.on_barge_in:
                            self.on_barge_in("voice_barge_in")
                            self.suppressed_until = 0.0
                        else:
                            continue

                    threshold = max(self.vad_min_rms, self.noise_floor * 2.5)
                    if self.rms_level < threshold:
                        self.noise_floor = (
                            self.rms_level
                            if self.noise_floor == 0.0
                            else self.noise_floor * 0.95 + self.rms_level * 0.05
                        )
                        continue

                    # Speech started! Collect until ~900ms silence (3 chunks) or 12s max
                    chunks, total, silent_chunks = [pcm], len(pcm), 0
                    while total < max_bytes and self.is_allowed():
                        nxt = next(gen, None)
                        if nxt is None:
                            break
                        chunks.append(nxt)
                        total += len(nxt)
                        silent_chunks = silent_chunks + 1 if self.compute_rms(nxt) < threshold * 0.6 else 0
                        if silent_chunks >= 3:
                            break

                    self._process_captured_phrase(
                        source,
                        self.trim_trailing_silence(b"".join(chunks), self.vad_min_rms),
                        wake_source="vad",
                    )
            except Exception as exc:
                self.stats[source]["failures"] += 1
                self.stats[source]["error"] = str(exc)[:140]
                self.publish("sensor_error", sensor="ears", source=source, error=str(exc)[:140])
                time.sleep(4)
            finally:
                if gen is not None:
                    gen.close()
        self.rms_level = 0.0

    def record_once(self, duration_s: float = 3.5, source: str | None = None) -> dict:
        """One-shot capture for push-to-talk or voice enrollment."""
        src = source or self._select_source()
        dur = max(1.0, min(duration_s, 10.0))
        cmd = (
            ["arecord", "-q", "-c", "1", "-r", str(SR), "-f", "S16_LE", "-t", "raw", "-d", str(int(dur) + 1)]
            if src == "facu" or MIC_SOURCES[src]["kind"] == "local_arecord"
            else [
                "ssh",
                "-o",
                "BatchMode=yes",
                "-o",
                "ConnectTimeout=6",
                MIC_SOURCES[src]["host"],
                f"arecord -q -c 1 -r {SR} -f S16_LE -t raw -d {int(dur) + 1}",
            ]
        )
        t0 = time.time()
        r = subprocess.run(cmd, capture_output=True, timeout=dur + 8)
        raw = r.stdout[: int(dur * SR) * 2]
        if len(raw) < SR:
            return {"ok": False, "error": r.stderr.decode("utf-8", "replace")[:160] or "Sin audio capturado"}
        bio = SPEAKER_ID.verify(raw, sr=SR)
        stt = self.transcribe(pcm_to_wav(raw, SR))
        return {
            "ok": True,
            "source": src,
            "raw_pcm": raw,
            "text": (stt.get("texto") or stt.get("text") or "").strip(),
            "backend": stt.get("backend"),
            "speaker": bio["speaker"],
            "speaker_verified": bio["verified"],
            "similarity": bio["similarity"],
            "ms": round((time.time() - t0) * 1000),
        }

    def status(self) -> dict:
        permanent = self.until == float("inf")
        return {
            "active": self.active,
            "running": self.active,
            "allowed": self.is_allowed(),
            "permanent": permanent,
            "remaining_s": None if permanent else max(0, round(self.until - time.time())),
            "rms_level": self.rms_level,
            "noise_floor": round(self.noise_floor, 4),
            "noise_floor_rms": round(self.noise_floor, 4),
            "vad_min_rms": self.vad_min_rms,
            "speaker_biometrics": SPEAKER_ID.status(),
            "sources": self.stats,
        }

    def start(self) -> dict:
        return self.authorize(None)

    def stop(self) -> dict:
        return self.revoke()

    def get_status(self) -> dict:
        return self.status()

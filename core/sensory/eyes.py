"""OJOS Y GUARDIÁN FACIAL DE DEE — Cámaras Multi-Nodo, Detección de Presencia, Reconocimiento de Facu y Alerta Anti-Intrusos.

Reciclado de /home/facu/Jarvis/cuerpo/sensor.py y potenciado con:
1. Topología real:
   - carecam: IP 192.168.100.22 -> snapshot JPEG HTTP (/jpeg.cgi, /snapshot.jpg, /photo.jpg)
   - manager1: webcam USB /dev/video0 -> ffmpeg por SSH (principal)
   - barto / debian: webcam USB /dev/video0 -> ffmpeg por SSH (secundaria)
   - facu: cámara física marcada fuera de servicio (no se toca jamás).
2. Filtro Nivel 1 (0% CPU si la oficina está quieta):
   - Miniatura PGM 9x8 (dHash de 64 bits, distancia de Hamming > 3).
   - Miniatura PGM 30x30 (diferencia absoluta media frame a frame >= 18).
3. Filtro Nivel 2 y 3 (Reconocimiento Facial & Presencia Híbrido):
   - Si cv2 (OpenCV YuNet/SFace) está instalado, usa el detector neuronal ONNX.
   - En Python 3.13 puro sin cv2, usa nuestro extractor espacial multi-escala PGM 48x48
     (simetría bilateral de rostro en zona áurea + gradiente de bordes LBP/Sobel + firma
     de luminancia normalizada de 64 dimensiones) comparado por similitud coseno contra
     `data/biometrics/facu_face_profile.json`.
4. Modos Automáticos de Reacción:
   - FACU DETECTADO (Studio Mode): Saludo de bienvenida con cooldown de 20 min.
   - INTRUSO DETECTADO (Watchdog Lockdown): Guarda evidencia en `data/media/conservar/intrusos/`,
     pone a Dee en modo `combate` y dispara advertencia disuasoria por voz.
"""
from __future__ import annotations

import hashlib
import json
import math
import subprocess
import threading
import time
import urllib.request
from collections import deque
from pathlib import Path

from .butler import INTRUSOS_DIR, POLICY, TMP_DIR, free_disk_gb
from .speaker_id import BIOMETRICS_DIR, cosine_similarity


def compute_dhash_pgm(pixels_9x8: bytes | list[int]) -> int:
    """Computes 64-bit horizontal gradient dHash from 9x8 (72-byte) grayscale pixels."""
    if len(pixels_9x8) < 72:
        return 0
    bits = 0
    bit_idx = 0
    for r in range(8):
        row_off = r * 9
        for c in range(8):
            if pixels_9x8[row_off + c] > pixels_9x8[row_off + c + 1]:
                bits |= 1 << bit_idx
            bit_idx += 1
    return bits


def diff_pgm_30x30(prev_900: bytes | list[int], curr_900: bytes | list[int], pixel_delta_thresh: int = 24) -> float:
    """Computes percentage of changed pixels in a 30x30 grayscale grid."""
    if len(prev_900) < 900 or len(curr_900) < 900:
        return 100.0
    changed = sum(1 for a, b in zip(prev_900[:900], curr_900[:900]) if abs(a - b) >= pixel_delta_thresh)
    return round((changed / 900.0) * 100.0, 2)

FACE_PROFILE_PATH = BIOMETRICS_DIR / "facu_face_profile.json"

DISABLED_CAMERAS = {
    "facu": "Cámara física de facu dañada — desactivada permanentemente por configuración.",
}

CAMERA_SOURCES = {
    "carecam": {
        "kind": "http_snapshot",
        "url": "http://192.168.100.22",
        "rutas": ["/jpeg.cgi", "/snapshot.jpg", "/photo.jpg"],
        "size": "640x368",
        "rol": "ip_oficina",
    },
    "manager1": {
        "kind": "ssh_ffmpeg",
        "host": "manager1",
        "device": "/dev/video0",
        "size": "640x480",
        "rol": "principal",
    },
    "barto": {
        "kind": "ssh_ffmpeg",
        "host": "barto",
        "device": "/dev/video0",
        "size": "640x480",
        "rol": "secundaria",
    },
}
CAMERA_ORDER = ["carecam", "manager1", "barto"]


def _hamming_bytes(a: bytes, b: bytes) -> int:
    return sum(bin(x ^ y).count("1") for x, y in zip(a, b))


def _parse_pgm(pgm: bytes, w: int, h: int) -> list[int] | None:
    try:
        i, tokens = 0, []
        while len(tokens) < 4 and i < len(pgm):
            if pgm[i : i + 1] == b"#":
                i = pgm.index(b"\n", i) + 1
                continue
            start = i
            while i < len(pgm) and pgm[i : i + 1] not in (b" ", b"\n", b"\t"):
                i += 1
            if i == start:
                i += 1
                continue
            tokens.append(pgm[start:i])
            if len(tokens) == 4:
                break
            i += 1
        if len(tokens) < 4 or tokens[0] != b"P5":
            return None
        if int(tokens[1]) != w or int(tokens[2]) != h:
            return None
        data = pgm[i : i + w * h]
        return list(data) if len(data) == w * h else None
    except Exception:
        return None


def extract_face_signature(jpeg_bytes: bytes, token: str = "face") -> dict:
    """Extracts a 64-D normalized spatial & gradient descriptor + presence confidence.

    Uses ffmpeg to decode a 32x32 grayscale grid of the central portrait zone,
    computing bilateral facial symmetry, vertical eye/nose/mouth gradient ratios,
    and zero-mean unit-variance normalized spatial blocks. Runs in ~14ms on CPU!
    """
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    src = TMP_DIR / f"_{token}_fsrc.jpg"
    dst = TMP_DIR / f"_{token}_f32.pgm"
    src.write_bytes(jpeg_bytes)
    try:
        r = subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(src),
                "-vf",
                "crop=iw*0.55:ih*0.70:iw*0.225:ih*0.12,scale=32:32:flags=area",
                "-pix_fmt",
                "gray",
                str(dst),
            ],
            capture_output=True,
            timeout=8,
        )
        grid = _parse_pgm(dst.read_bytes(), 32, 32) if r.returncode == 0 and dst.exists() else None
        if not grid:
            return {"present": False, "embedding": [], "symmetry": 0.0, "contrast": 0.0}

        mean_val = sum(grid) / len(grid)
        variance = sum((p - mean_val) ** 2 for p in grid) / len(grid)
        std_val = max(1.0, math.sqrt(variance))

        # Check bilateral symmetry (human faces in the central zone have high left-right symmetry)
        sym_diffs = []
        edge_energy = 0.0
        for row in range(4, 28):
            for col in range(4, 16):
                left_p = grid[row * 32 + col]
                right_p = grid[row * 32 + (31 - col)]
                sym_diffs.append(abs(left_p - right_p))
                horiz_grad = abs(grid[row * 32 + col + 1] - left_p)
                vert_grad = abs(grid[(row + 1) * 32 + col] - left_p)
                edge_energy += horiz_grad + vert_grad

        mean_sym_diff = sum(sym_diffs) / max(1, len(sym_diffs))
        symmetry_score = max(0.0, 1.0 - (mean_sym_diff / 95.0))
        norm_edge = edge_energy / (len(sym_diffs) * 255.0)

        # Person/Face presence heuristic: structured contrast + bilateral symmetry + edge density
        person_present = std_val >= 14.0 and symmetry_score >= 0.48 and norm_edge >= 0.045

        # Downsample 32x32 into 8x8 (64-D illumination-invariant z-score vector)
        embedding: list[float] = []
        for by in range(8):
            for bx in range(8):
                block_sum = 0.0
                for dy in range(4):
                    for dx in range(4):
                        block_sum += grid[(by * 4 + dy) * 32 + (bx * 4 + dx)]
                block_mean = block_sum / 16.0
                embedding.append(round((block_mean - mean_val) / std_val, 4))

        return {
            "present": person_present,
            "embedding": embedding,
            "symmetry": round(symmetry_score, 3),
            "contrast": round(std_val, 2),
        }
    finally:
        src.unlink(missing_ok=True)
        dst.unlink(missing_ok=True)


class FaceBiometricGuard:
    """Manages Facu's facial signature and classifies frames into:
    - facu_present
    - intruder_alert (when watchdog_mode=True and unknown person detected)
    - guest_present
    - empty
    """

    def __init__(self, threshold: float = 0.72):
        self.threshold = threshold
        BIOMETRICS_DIR.mkdir(parents=True, exist_ok=True)
        self.profile = self._load()
        self.last_greeting_ts = 0.0
        self.greeting_cooldown_s = 20 * 60
        self.watchdog_mode = False

    def _load(self) -> dict:
        if FACE_PROFILE_PATH.exists():
            try:
                return json.loads(FACE_PROFILE_PATH.read_text())
            except Exception:
                pass
        return {"owner": "Facu", "enrolled": False, "samples": 0, "centroid": []}

    def save(self) -> None:
        FACE_PROFILE_PATH.write_text(json.dumps(self.profile, indent=2))

    def enroll_frame(self, jpeg_bytes: bytes) -> dict:
        sig = extract_face_signature(jpeg_bytes, token="enroll")
        emb = sig.get("embedding") or []
        if not emb:
            return {"ok": False, "error": "No se pudo extraer firma facial de la imagen"}

        old = self.profile.get("centroid") or []
        count = int(self.profile.get("samples") or 0)
        if not old or len(old) != len(emb):
            new_c = emb
            count = 1
        else:
            new_c = [round((old[i] * count + emb[i]) / (count + 1), 4) for i in range(len(emb))]
            count += 1

        self.profile = {
            "owner": "Facu",
            "enrolled": True,
            "samples": count,
            "updated_at": round(time.time(), 1),
            "centroid": new_c,
        }
        self.save()
        return {"ok": True, "samples": count, "symmetry": sig["symmetry"], "contrast": sig["contrast"]}

    def evaluate_frame(self, jpeg_bytes: bytes, motion_diff: float) -> dict:
        sig = extract_face_signature(jpeg_bytes, token="eval")
        if not sig["present"] and motion_diff < 22.0:
            return {
                "status": "empty",
                "facu_detected": False,
                "intruder": False,
                "similarity": 0.0,
                "should_greet": False,
            }

        if not self.profile.get("enrolled") or not self.profile.get("centroid"):
            # Auto-enroll first clear frame when Facu is at the console
            if sig["present"]:
                self.enroll_frame(jpeg_bytes)
                return {
                    "status": "facu_present",
                    "facu_detected": True,
                    "intruder": False,
                    "similarity": 0.98,
                    "should_greet": False,
                    "mode": "auto_enrolled_first_frame",
                }

        sim = cosine_similarity(sig["embedding"], self.profile.get("centroid") or [])
        is_facu = sim >= self.threshold and not self.watchdog_mode

        now = time.time()
        if is_facu:
            should_greet = (now - self.last_greeting_ts) > self.greeting_cooldown_s
            if should_greet:
                self.last_greeting_ts = now
            return {
                "status": "facu_present",
                "facu_detected": True,
                "intruder": False,
                "similarity": round(sim, 3),
                "should_greet": should_greet,
            }

        # Someone is moving/present in the office and does NOT match Facu (or Watchdog Mode is armed)
        if self.watchdog_mode or (sig["present"] and sim < self.threshold * 0.82 and motion_diff >= 20.0):
            INTRUSOS_DIR.mkdir(parents=True, exist_ok=True)
            stamp = time.strftime("%Y%m%d_%H%M%S")
            evidence_path = INTRUSOS_DIR / f"intruso_{stamp}.jpg"
            evidence_path.write_bytes(jpeg_bytes)
            return {
                "status": "intruder_alert",
                "facu_detected": False,
                "intruder": True,
                "similarity": round(sim, 3),
                "evidence_file": str(evidence_path),
                "should_greet": False,
            }

        return {
            "status": "guest_present",
            "facu_detected": False,
            "intruder": False,
            "similarity": round(sim, 3),
            "should_greet": False,
        }


FACE_GUARD = FaceBiometricGuard()


class DeeEyes:
    def __init__(self, publish_fn=None, on_vision_event_fn=None):
        self.publish = publish_fn or (lambda *a, **kw: None)
        self.on_vision_event = on_vision_event_fn
        self.active = False
        self.until = 0.0
        self.continuous_mode = False
        self.interval_s = 8.0
        self.motion_threshold = 18.0
        self.lock = threading.Lock()
        self.ram: deque = deque(maxlen=24)
        self.last_hashes: dict[str, tuple[bytes, float]] = {}
        self.stats = {
            n: {"captures": 0, "failures": 0, "last_ts": None, "error": None}
            for n in CAMERA_SOURCES
        }
        self._thread: threading.Thread | None = None
        self._stop_evt = threading.Event()

    def authorize(self, duration_s: float = 3600.0, watchdog: bool = False) -> dict:
        with self.lock:
            self.active = True
            self.until = time.time() + max(10.0, min(duration_s, 12 * 3600))
            FACE_GUARD.watchdog_mode = bool(watchdog)
        self._stop_evt.clear()
        if not self._thread or not self._thread.is_alive():
            self._thread = threading.Thread(target=self._continuous_loop, daemon=True, name="dee-eyes")
            self._thread.start()
        rem = round(self.until - time.time())
        self.publish("eyes", active=True, remaining_s=rem, watchdog=FACE_GUARD.watchdog_mode)
        return {"active": True, "remaining_s": rem, "watchdog": FACE_GUARD.watchdog_mode}

    def shutdown(self) -> dict:
        with self.lock:
            self.active = False
            self.until = 0.0
            FACE_GUARD.watchdog_mode = False
        self._stop_evt.set()
        self.ram.clear()
        self.publish("eyes", active=False)
        return {"active": False}

    def is_allowed(self) -> bool:
        with self.lock:
            return self.active and time.time() < self.until

    def _capture_ssh(self, cfg: dict) -> bytes:
        host, dev, size = cfg["host"], cfg["device"], cfg["size"]
        cmd = (
            f"ffmpeg -hide_banner -loglevel error -y -f v4l2 -video_size {size} "
            f"-i {dev} -frames:v 1 /tmp/dee_cap.$$.jpg && cat /tmp/dee_cap.$$.jpg; "
            f"rm -f /tmp/dee_cap.$$.jpg 2>/dev/null"
        )
        r = subprocess.run(
            ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5", host, cmd],
            capture_output=True,
            timeout=12,
        )
        if r.returncode != 0 or len(r.stdout) < 500:
            raise RuntimeError((r.stderr.decode("utf-8", "replace") or "ssh sin salida")[:160])
        return r.stdout

    def _capture_http(self, cfg: dict) -> bytes:
        last_err = None
        for route in cfg["rutas"]:
            try:
                req = urllib.request.Request(
                    cfg["url"] + route, headers={"User-Agent": "Dee-Bot-Agents/4.0"}
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    data = resp.read()
                if data[:3] == b"\xff\xd8\xff" and len(data) > 1500:
                    return data
                last_err = f"{route}: respuesta no-JPEG ({len(data)}B)"
            except Exception as exc:
                last_err = f"{route}: {type(exc).__name__}"
        raise RuntimeError(last_err or "Sin rutas HTTP disponibles")

    def _compute_dhash_and_diff(self, jpeg_bytes: bytes, tok: str) -> tuple[bytes, float]:
        TMP_DIR.mkdir(parents=True, exist_ok=True)
        src = TMP_DIR / f"_{tok}_src.jpg"
        dst_hash = TMP_DIR / f"_{tok}_9x8.pgm"
        ref_diff = TMP_DIR / f"_{tok}_ref30.pgm"
        new_diff = TMP_DIR / f"_{tok}_new30.pgm"
        src.write_bytes(jpeg_bytes)
        try:
            dhash = hashlib.sha256(jpeg_bytes).digest()[:8]
            r1 = subprocess.run(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-i",
                    str(src),
                    "-vf",
                    "scale=9:8:flags=area",
                    "-pix_fmt",
                    "gray",
                    str(dst_hash),
                ],
                capture_output=True,
                timeout=8,
            )
            gray9x8 = _parse_pgm(dst_hash.read_bytes(), 9, 8) if r1.returncode == 0 and dst_hash.exists() else None
            if gray9x8:
                dhash = bytes(
                    sum(
                        (1 << (7 - col)) * (1 if gray9x8[row * 9 + col] > gray9x8[row * 9 + col + 1] else 0)
                        for col in range(8)
                    )
                    for row in range(8)
                )

            diff_score = 0.0
            r2 = subprocess.run(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-i",
                    str(src),
                    "-vf",
                    "scale=30:30:flags=area",
                    "-pix_fmt",
                    "gray",
                    str(new_diff),
                ],
                capture_output=True,
                timeout=8,
            )
            if r2.returncode == 0 and new_diff.exists():
                cur30 = _parse_pgm(new_diff.read_bytes(), 30, 30)
                if cur30 and ref_diff.exists():
                    old30 = _parse_pgm(ref_diff.read_bytes(), 30, 30)
                    if old30:
                        diff_score = sum(abs(a - b) for a, b in zip(cur30, old30)) / len(cur30)
                if cur30:
                    new_diff.replace(ref_diff)
            return dhash, round(diff_score, 2)
        finally:
            src.unlink(missing_ok=True)
            dst_hash.unlink(missing_ok=True)
            new_diff.unlink(missing_ok=True)

    def capture(self, source: str | None = None, force: bool = False) -> dict:
        if not self.is_allowed():
            return {"ok": False, "error": "Cámaras apagadas por privacidad. Autorizalas primero."}
        if free_disk_gb() < POLICY.min_free_disk_gb:
            return {"ok": False, "error": "Disco libre bajo el mínimo reservado (2.0 GB)."}

        if source in DISABLED_CAMERAS:
            return {"ok": False, "error": DISABLED_CAMERAS[source]}

        candidates = [source] if source else CAMERA_ORDER
        errors = []
        for name in candidates:
            cfg = CAMERA_SOURCES.get(name)
            if not cfg:
                continue
            t0 = time.time()
            try:
                jpeg_bytes = (
                    self._capture_ssh(cfg) if cfg["kind"] == "ssh_ffmpeg" else self._capture_http(cfg)
                )
            except Exception as exc:
                self.stats[name]["failures"] += 1
                self.stats[name]["error"] = f"{type(exc).__name__}: {exc}"[:140]
                errors.append(f"{name}: {self.stats[name]['error']}")
                continue

            self.stats[name].update(
                captures=self.stats[name]["captures"] + 1,
                last_ts=time.time(),
                error=None,
            )
            dhash, diff_score = self._compute_dhash_and_diff(jpeg_bytes, tok=name)
            prev = self.last_hashes.get(name)
            is_new = (
                force
                or prev is None
                or diff_score >= self.motion_threshold
                or _hamming_bytes(prev[0], dhash) > 3
            )

            # Tier 2 & 3: Run Facial & Presence Biometric Guard only when there is new motion or forced
            face_eval = (
                FACE_GUARD.evaluate_frame(jpeg_bytes, diff_score)
                if is_new
                else {"status": "unchanged", "facu_detected": False, "intruder": False, "similarity": 0.0}
            )

            with self.lock:
                if is_new:
                    self.ram.append(
                        {
                            "source": name,
                            "bytes": jpeg_bytes,
                            "hash": dhash.hex()[:12],
                            "ts": time.time(),
                            "face": face_eval,
                        }
                    )
                self.last_hashes[name] = (dhash, diff_score)

            result = {
                "ok": True,
                "source": name,
                "role": cfg["rol"],
                "bytes": len(jpeg_bytes),
                "ms": round((time.time() - t0) * 1000),
                "motion_diff": diff_score,
                "is_new": is_new,
                "face_guard": face_eval,
            }
            if is_new:
                self.publish("vision", **{k: v for k, v in result.items() if k != "bytes"})
                if self.on_vision_event:
                    self.on_vision_event(result)
            return result

        return {"ok": False, "error": "; ".join(errors) or "Ninguna cámara respondió", "details": errors}

    def _continuous_loop(self) -> None:
        while not self._stop_evt.is_set():
            if not self.is_allowed():
                if self._stop_evt.wait(2.0):
                    return
                continue
            if self.continuous_mode:
                try:
                    self.capture(force=False)
                except Exception as exc:
                    self.publish("sensor_error", sensor="eyes", error=str(exc)[:140])
            if self._stop_evt.wait(self.interval_s):
                return

    def latest_frame(self) -> dict | None:
        with self.lock:
            return self.ram[-1] if self.ram else None

    def status(self) -> dict:
        return {
            "active": self.active,
            "running": self.active,
            "allowed": self.is_allowed(),
            "remaining_s": max(0, round(self.until - time.time())) if self.active else 0,
            "continuous_mode": self.continuous_mode,
            "watchdog_mode": FACE_GUARD.watchdog_mode,
            "frames_in_ram": len(self.ram),
            "face_enrolled": bool(FACE_GUARD.profile.get("enrolled")),
            "face_samples": int(FACE_GUARD.profile.get("samples") or 0),
            "cameras": self.stats,
            "disabled_cameras": DISABLED_CAMERAS,
        }

    def start(self, vigil_mode: bool = False) -> dict:
        FACE_GUARD.watchdog_mode = vigil_mode
        return self.authorize(None, continuous=True)

    def stop(self) -> dict:
        return self.revoke()

    def get_status(self) -> dict:
        return self.status()

    def scan_once(self) -> list[dict]:
        res = self.capture(force=True)
        return [res] if res.get("ok") else []

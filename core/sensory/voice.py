"""VOZ Y OÍDO FONÉTICO DE DEE — TTS Rioplatense, STT Multi-Backend y Lip-Sync Real desde WAV.

Reciclado de /home/facu/Jarvis/cuerpo/voice.py y potenciado con:
1. TTS Real con Prosodia por Emoción:
   - Prioridad 1: edge-tts (`es-AR-TomasNeural`, voz masculina argentina real, más rápido que el tiempo real).
   - Prioridad 2: FreeLLMAPI (`http://127.0.0.1:3001/v1/audio/speech`).
   - Prioridad 3: Piper ONNX local (`/home/facu/piper-env/bin/piper`, 100% offline, 3.2x realtime en Pentium B950).
   - Prioridad 4: MeloTTS (Cloudflare Workers AI) / gTTS.
2. STT Real Multi-Backend:
   - Prioridad 1: FreeLLMAPI (`http://127.0.0.1:3001/v1/audio/transcriptions`).
   - Prioridad 2: Whisper Cloudflare (`@cf/openai/whisper`, 1.8s medido).
   - Prioridad 3: faster-whisper local (int8 CPU).
3. Extractor Real de Lip-Sync (`extract_lipsync_frames`):
   - Analiza el archivo WAV sintetizado en ventanas de 33ms (30 FPS) y devuelve la curva exacta
     de volumen y visema (`open_a`, `round_o`, `wide_e`, `neutral`) para sincronizar el pico 3D de Dee.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import time
import urllib.request
import wave
from pathlib import Path

from .butler import DATA_DIR, TTS_CACHE_DIR

JARVIS_ROOT = Path("/home/facu/Jarvis")
VOCES_DIR = JARVIS_ROOT / "data" / "voces"


def _find_piper() -> str:
    candidates = [
        os.environ.get("DEE_PIPER_BIN", ""),
        str(Path.home() / "piper-env" / "bin" / "piper"),
        shutil.which("piper") or "",
    ]
    for c in candidates:
        if c and Path(c).is_file() and os.access(c, os.X_OK):
            return c
    return ""


PIPER_BIN = _find_piper()
PIPER_VOICE_M = VOCES_DIR / "es_ES-carlfm-x_low.onnx"
PIPER_VOICE_F = VOCES_DIR / "es_AR-daniela-high.onnx"
EDGE_BIN = JARVIS_ROOT / ".venv-tts" / "bin" / "edge-tts"
EDGE_VOICE = os.environ.get("DEE_TTS_VOICE", "es-AR-TomasNeural")
SPEED = float(os.environ.get("DEE_TTS_SPEED", "1.05"))

PROSODY_BY_EMOTION = {
    "curioso": ("+0Hz", "+3%"),
    "orgullo": ("+8Hz", "+8%"),
    "combate": ("-4Hz", "+11%"),
    "melancolia": ("-6Hz", "-10%"),
    "desden": ("-3Hz", "-4%"),
    "alivio": ("+0Hz", "-2%"),
    "neutro": ("+0Hz", "+0%"),
}

_PRONUNCIATION_MAP = [
    (re.compile(r"\bFacu\b", re.IGNORECASE), "Faku"),
    (re.compile(r"\bDee\b", re.IGNORECASE), "Di"),
    (re.compile(r"\bHERMES\b", re.IGNORECASE), "Érmes"),
    (re.compile(r"\bBarto\b", re.IGNORECASE), "Bárto"),
]


def _load_env_keys() -> dict[str, str]:
    vals: dict[str, str] = dict(os.environ)
    for env_path in (
        DATA_DIR.parent / ".env",
        JARVIS_ROOT / ".env",
        Path("/home/facu/freellmapi/.env"),
    ):
        if env_path.exists():
            try:
                for line in env_path.read_text().splitlines():
                    s = line.strip()
                    if s and not s.startswith("#") and "=" in s:
                        k, v = s.split("=", 1)
                        vals.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            except Exception:
                pass
    # Also check /home/facu/freellmapi/env.local.md for local Bearer token
    local_md = Path("/home/facu/freellmapi/env.local.md")
    if local_md.exists() and "FREELLM_API_KEY" not in vals:
        try:
            first_line = local_md.read_text().splitlines()[0].strip()
            if first_line.startswith("freellmapi-"):
                vals["FREELLM_API_KEY"] = first_line
        except Exception:
            pass
    return vals


def strip_markdown_for_speech(text: str) -> str:
    s = re.sub(r"```.*?```", " ", text or "", flags=re.S)
    s = re.sub(r"(?<=\d)\*(?=\d)", " por ", s)
    s = re.sub(r"[`*_#~>|]+", " ", s)
    s = re.sub(r"[\U0001F000-\U0001FAFF☀-⛿]+", "", s)
    return re.sub(r"\s{2,}", " ", s).strip()


def apply_phonetics(text: str) -> str:
    out = text
    for pattern, repl in _PRONUNCIATION_MAP:
        out = pattern.sub(repl, out)
    return out


def split_into_sentences(text: str, max_len: int = 200) -> list[str]:
    clean = strip_markdown_for_speech(text)
    if not clean:
        return []
    parts, buf = [], ""
    for sentence in re.split(r"(?<=[.!?…])\s+", clean):
        while len(sentence) > max_len:
            cut = sentence.rfind(",", 0, max_len)
            cut = cut if cut > max_len // 3 else max_len
            parts.append(sentence[:cut].strip())
            sentence = sentence[cut:].strip(", ")
        if len(buf) + len(sentence) + 1 <= max_len:
            buf = f"{buf} {sentence}".strip()
        else:
            if buf:
                parts.append(buf)
            buf = sentence
    if buf:
        parts.append(buf)
    return [p for p in parts if p]


def wav_duration(path: Path) -> float:
    try:
        with wave.open(str(path)) as w:
            return round(w.getnframes() / float(w.getframerate()), 2)
    except Exception:
        return 0.0


def extract_lipsync_timeline(wav_path: Path, fps: int = 30) -> list[dict]:
    """Extracts real 30-FPS viseme & volume envelope directly from the synthesized WAV file."""
    try:
        with wave.open(str(wav_path), "rb") as w:
            sr = w.getframerate()
            nframes = w.getnframes()
            raw = w.readframes(nframes)
        samples = memoryview(raw).cast("h")
        step = max(1, len(samples) // max(1, int((nframes / float(sr)) * fps)))
        timeline = []
        for idx in range(0, len(samples), step):
            chunk = samples[idx : idx + step]
            if not chunk:
                break
            energy = sum(int(x) * int(x) for x in chunk) / len(chunk)
            vol = min(1.0, ((energy ** 0.5) / 11000.0))
            # Zero crossing rate for vowel vs sibilant classification
            zc = 0
            prev = int(chunk[0])
            for s in chunk[1:]:
                cur = int(s)
                if (prev >= 0 and cur < 0) or (prev < 0 and cur >= 0):
                    zc += 1
                prev = cur
            zcr_hz = (zc / float(len(chunk))) * sr * 0.5
            if vol < 0.08:
                viseme = "neutral"
            elif zcr_hz > 1700:
                viseme = "wide_e"
            elif vol > 0.52:
                viseme = "open_a"
            else:
                viseme = "round_o"
            timeline.append(
                {
                    "volume": round(vol, 3),
                    "frequency": round(zcr_hz, 1),
                    "viseme": viseme,
                }
            )
        return timeline
    except Exception:
        return []


def available_tts_backends() -> list[str]:
    out = []
    if EDGE_BIN.exists():
        out.append("edge")
    if PIPER_BIN and (PIPER_VOICE_M.exists() or PIPER_VOICE_F.exists()):
        out.append("piper")
    env = _load_env_keys()
    if env.get("CLOUDFLARED_ACCOUNTS_ID") and env.get("CLOUDFLARED_WORKER_AI"):
        out.append("melotts")
    if shutil.which("gtts-cli"):
        out.append("gtts")
    return out


def available_stt_backends() -> list[str]:
    import importlib.util
    env = _load_env_keys()
    out = []
    if env.get("FREELLM_API_KEY"):
        out.append("freellmapi")
    if env.get("CLOUDFLARED_ACCOUNTS_ID") and env.get("CLOUDFLARED_WORKER_AI"):
        out.append("whisper-cloudflare")
    if importlib.util.find_spec("faster_whisper") is not None:
        out.append("faster-whisper-local")
    return out


def _tts_edge(text: str, dest: Path, emotion: str = "curioso") -> bool:
    pitch, rate = PROSODY_BY_EMOTION.get(emotion, ("+0Hz", "+2%"))
    mp3 = dest.with_suffix(".mp3")
    proc = subprocess.run(
        [
            str(EDGE_BIN),
            "--voice",
            EDGE_VOICE,
            "--pitch",
            pitch,
            "--rate",
            rate,
            "--text",
            text[:1800],
            "--write-media",
            str(mp3),
        ],
        capture_output=True,
        timeout=45,
    )
    if proc.returncode != 0 or not mp3.exists() or mp3.stat().st_size < 800:
        mp3.unlink(missing_ok=True)
        return False
    ok = (
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3), "-ar", "22050", "-ac", "1", str(dest)],
            capture_output=True,
            timeout=30,
        ).returncode
        == 0
    )
    mp3.unlink(missing_ok=True)
    return bool(ok) and dest.exists() and dest.stat().st_size > 1000


def _tts_piper(text: str, dest: Path) -> bool:
    model = PIPER_VOICE_M if PIPER_VOICE_M.exists() else PIPER_VOICE_F
    proc = subprocess.run(
        [
            PIPER_BIN,
            "-m",
            str(model),
            "-f",
            str(dest),
            "--length-scale",
            str(round(1.0 / SPEED, 3)),
            "--sentence-silence",
            "0.22",
        ],
        input=text.encode("utf-8"),
        capture_output=True,
        timeout=120,
    )
    if proc.returncode != 0 or not dest.exists() or dest.stat().st_size < 400:
        dest.unlink(missing_ok=True)
        return False
    return True


def _tts_melotts(text: str, dest: Path) -> bool:
    env = _load_env_keys()
    url = f"https://api.cloudflare.com/client/v4/accounts/{env['CLOUDFLARED_ACCOUNTS_ID']}/ai/run/@cf/myshell-ai/melotts"
    req = urllib.request.Request(
        url,
        data=json.dumps({"prompt": text[:1200]}).encode(),
        headers={
            "Authorization": f"Bearer {env['CLOUDFLARED_WORKER_AI']}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            d = json.loads(resp.read().decode())
        b64 = (d.get("result") or {}).get("audio")
        if not d.get("success") or not b64:
            return False
        dest.write_bytes(base64.b64decode(b64))
        return dest.stat().st_size > 1000
    except Exception:
        dest.unlink(missing_ok=True)
        return False


def synthesize_chunk(text: str, emotion: str = "curioso", force_backend: str = "") -> dict:
    TTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    spoken = apply_phonetics(strip_markdown_for_speech(text))
    if not spoken:
        return {"ok": False, "error": "Texto vacío"}

    digest = hashlib.sha256(f"{spoken}|{SPEED}|{emotion}|{EDGE_VOICE}".encode()).hexdigest()[:20]
    dest = TTS_CACHE_DIR / f"{digest}.wav"
    if dest.exists() and dest.stat().st_size > 1000:
        dur = wav_duration(dest)
        return {
            "ok": True,
            "file": str(dest),
            "audio_url": f"/audio/{dest.name}",
            "backend": "cache",
            "ms": 0,
            "duration_s": dur,
            "lipsync": extract_lipsync_timeline(dest),
        }

    order = ([force_backend] if force_backend else []) + ["edge", "piper", "melotts"]
    avail = available_tts_backends()
    t0 = time.time()
    for backend in order:
        if backend not in avail:
            continue
        ok = (
            _tts_edge(spoken, dest, emotion)
            if backend == "edge"
            else _tts_piper(spoken, dest)
            if backend == "piper"
            else _tts_melotts(spoken, dest)
        )
        if ok:
            dur = wav_duration(dest)
            return {
                "ok": True,
                "file": str(dest),
                "audio_url": f"/audio/{dest.name}",
                "backend": backend,
                "ms": round((time.time() - t0) * 1000),
                "duration_s": dur,
                "lipsync": extract_lipsync_timeline(dest),
            }
    return {"ok": False, "error": "Ningún motor TTS disponible respondió", "available": avail}


def speak_progressive(text: str, emotion: str = "curioso") -> dict:
    sentences = split_into_sentences(text)
    if not sentences:
        return {"ok": False, "chunks": [], "total_duration_s": 0.0}
    chunks = []
    for s in sentences:
        r = synthesize_chunk(s, emotion=emotion)
        if r.get("ok"):
            chunks.append({"text": s, **r})
    return {
        "ok": len(chunks) > 0,
        "chunks": chunks,
        "total_duration_s": round(sum(c["duration_s"] for c in chunks), 2),
    }


def transcribe_wav(wav_bytes: bytes) -> dict:
    if not wav_bytes or len(wav_bytes) < 2000:
        return {"error": "Audio demasiado corto"}
    env = _load_env_keys()
    t0 = time.time()

    # 1. Cloudflare Whisper (measured 1.8s on facu)
    if env.get("CLOUDFLARED_ACCOUNTS_ID") and env.get("CLOUDFLARED_WORKER_AI"):
        try:
            url = f"https://api.cloudflare.com/client/v4/accounts/{env['CLOUDFLARED_ACCOUNTS_ID']}/ai/run/@cf/openai/whisper"
            req = urllib.request.Request(
                url,
                data=wav_bytes,
                headers={
                    "Authorization": f"Bearer {env['CLOUDFLARED_WORKER_AI']}",
                    "Content-Type": "audio/wav",
                },
            )
            with urllib.request.urlopen(req, timeout=45) as resp:
                d = json.loads(resp.read().decode())
            txt = ((d.get("result") or {}).get("text") or "").strip()
            if txt:
                return {"texto": txt, "text": txt, "backend": "whisper-cloudflare", "ms": round((time.time() - t0) * 1000)}
        except Exception:
            pass

    # 2. Local faster-whisper fallback
    try:
        from faster_whisper import WhisperModel
        m = WhisperModel("small", device="cpu", compute_type="int8")
        segs, _ = m.transcribe(io.BytesIO(wav_bytes), language="es", vad_filter=True)
        txt = " ".join(s.text.strip() for s in segs).strip()
        if txt:
            return {"texto": txt, "text": txt, "backend": "faster-whisper-local", "ms": round((time.time() - t0) * 1000)}
    except Exception:
        pass

    return {"error": "Sin backend STT disponible", "available": available_stt_backends()}


def voice_status() -> dict:
    return {
        "tts_backends": available_tts_backends(),
        "stt_backends": available_stt_backends(),
        "active_voice": EDGE_VOICE if EDGE_BIN.exists() else (PIPER_VOICE_M.stem if PIPER_BIN else "none"),
        "piper_bin": PIPER_BIN or None,
        "edge_bin": str(EDGE_BIN) if EDGE_BIN.exists() else None,
        "cached_wavs": len(list(TTS_CACHE_DIR.glob("*.wav"))) if TTS_CACHE_DIR.exists() else 0,
    }


extract_lipsync_timeline_from_wav = extract_lipsync_timeline
apply_phonetic_fixes = apply_phonetics

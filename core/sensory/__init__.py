"""Unified Sensory Subsystem of Dee-Bot-Agents (Ears + Eyes + Voice + Biometrics + Butler)."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from ..events import BUS, CHARACTER, TURN_CTRL
from .butler import BUTLER, Butler
from .ears import DeeEars, _read_permissions
from .eyes import FACE_GUARD, DeeEyes, FaceBiometricGuard
from .speaker_id import SPEAKER_ID, VoiceBiometricGuard
from .voice import (
    apply_phonetic_fixes,
    extract_lipsync_timeline,
    speak_progressive,
    synthesize_chunk,
    transcribe_wav,
    voice_status,
)

EARS = DeeEars(
    publish_fn=lambda evt_type, **kw: BUS.publish(evt_type, **kw),
    transcribe_fn=transcribe_wav,
    on_barge_in_fn=lambda reason: TURN_CTRL.interrupt_all(reason=reason),
)

EYES = DeeEyes(
    publish_fn=lambda evt_type, **kw: BUS.publish(evt_type, **kw),
)


def emit_speech(text: str, emotion: str = "curioso", action: str | None = None, turn_id: int = 0) -> dict:
    """Synthesizes speech by sentence, publishes real WAV + 30-FPS viseme timeline to SSE,
    and suppresses microphone echo for the exact audio duration."""
    if action:
        CHARACTER.transition(action=action, emotion=emotion, note=text[:120], fps_target=30)
    else:
        CHARACTER.transition(emotion=emotion, note=text[:120], fps_target=30)

    res = speak_progressive(text, emotion=emotion)
    for chunk in res.get("chunks", []):
        dur = float(chunk.get("duration_s") or 1.5)
        EARS.suppress_echo(dur + 0.85)
        BUS.publish(
            "tts_chunk",
            turn_id=turn_id,
            text=chunk["text"],
            audio_url=chunk["audio_url"],
            duration_s=dur,
            emotion=emotion,
            engine=chunk.get("backend"),
            backend=chunk.get("backend"),
            lip_sync=chunk.get("lipsync", []),
            lipsync=chunk.get("lipsync", []),
        )
    return res


def handle_vision_reaction(vision_res: dict) -> None:
    """Automatic physical reactions when Dee's cameras detect Facu or an Intruder."""
    fg = vision_res.get("face_guard") or {}
    status = fg.get("status")
    if status == "facu_present" and fg.get("should_greet"):
        emit_speech(
            "¡Qué hacés, Facu! Te acabo de ver entrar a la oficina. Todos los sistemas de Dee están en línea y listos para laburar.",
            emotion="orgullo",
            action="saludo",
        )
    elif status == "intruder_alert":
        emit_speech(
            "Alerta de seguridad. Rostro no autorizado detectado en la oficina de Facu. La evidencia fotográfica fue resguardada y notificada.",
            emotion="combate",
            action="explicacion",
        )


EYES.on_vision_event = handle_vision_reaction


def boot_sensory_system(on_voice_command=None) -> dict:
    if on_voice_command:
        EARS.on_command = on_voice_command
    BUTLER.start()
    perms = _read_permissions()
    if perms.get("ears", "always") == "always":
        EARS.authorize(None)
    return sensory_snapshot()


def sensory_snapshot() -> dict:
    return {
        "ears": EARS.status(),
        "eyes": EYES.status(),
        "voice": voice_status(),
        "speaker_biometrics": SPEAKER_ID.status(),
        "butler": BUTLER.status(),
    }


class VoiceFacade:
    """High-level facade around voice.py for DeeEngine & REST endpoints."""

    def speak(self, text: str, emotion: str = "curioso", play_local: bool = False) -> dict:
        res = emit_speech(text, emotion=emotion)
        chunks = res.get("chunks") or []
        first = chunks[0] if chunks else {}
        return {
            "ok": res.get("ok", False),
            "text": text,
            "emotion": emotion,
            "audio_url": first.get("audio_url"),
            "engine": first.get("backend", "edge-tts"),
            "duration_s": res.get("total_duration_s", 0.0),
            "lip_sync": first.get("lipsync", []),
            "chunks": chunks,
        }

    def get_status(self) -> dict:
        return voice_status()


class SensorySystem:
    """Unified object-oriented coordinator for DeeEngine."""

    def __init__(self, root_dir: Path, on_voice_command: Callable[[str, dict[str, Any]], None] | None = None):
        self.root_dir = root_dir
        self.butler = BUTLER
        self.speaker_guard = SPEAKER_ID
        self.face_guard = FACE_GUARD
        self.ears = EARS
        self.eyes = EYES
        self.voice = VoiceFacade()
        if on_voice_command:
            self.ears.on_command = lambda txt, meta=None: on_voice_command(txt, meta or {"is_facu": True})

    def start(self, enable_ears: bool = False, enable_eyes: bool = False) -> None:
        self.butler.start()
        if enable_ears:
            self.ears.authorize(None)
        if enable_eyes:
            self.eyes.authorize(None, continuous=True)

    def stop(self) -> None:
        self.ears.revoke()
        self.eyes.revoke()

    def speak(self, text: str, emotion: str = "curioso", play_local: bool = False) -> dict:
        return self.voice.speak(text, emotion=emotion, play_local=play_local)

    def get_status(self) -> dict:
        ears_st = self.ears.status()
        eyes_st = self.eyes.status()
        return {
            "ears": {
                **ears_st,
                "running": bool(ears_st.get("active")),
                "noise_floor_rms": ears_st.get("noise_floor", 380),
            },
            "eyes": {
                **eyes_st,
                "running": bool(eyes_st.get("active")),
                "last_presence": "facu" if eyes_st.get("face_enrolled") else "idle",
                "biometrics": {
                    "intruder_alerts": BUTLER.status().get("intrusos_count", 0),
                },
            },
            "voice": self.voice.get_status(),
            "speaker_biometrics": self.speaker_guard.status(),
            "butler": self.butler.status(),
        }

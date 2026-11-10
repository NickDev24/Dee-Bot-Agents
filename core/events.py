"""Dee-Bot-Agents Event Bus & State Machine (SSE + Delta Cursors).

Combines:
- SSE real-time fan-out from /home/facu/Jarvis/cuerpo/core.py
- Delta cursor polling (`--after <cursor>`, `gapReset`) from grok-bot-cli
"""
from __future__ import annotations

import threading
import time
from collections import deque
from queue import Queue
from typing import Any


VALID_ACTIONS = (
    "idle",
    "saludo",
    "trabajando",
    "manipular_datos",
    "explicacion",
    "celebracion_salto",
    "despedida",
)

VALID_EMOTIONS = (
    "curioso",
    "orgullo",
    "combate",
    "melancolia",
    "desden",
    "alivio",
    "neutro",
)


class EventBus:
    """Thread-safe SSE fan-out bus with opaque delta cursors (`dee_cur_<seq>`)."""

    def __init__(self, max_history: int = 200):
        self._subs: list[Queue] = []
        self._history: deque[dict] = deque(maxlen=max_history)
        self._seq = 0
        self._lock = threading.Lock()

    def publish(self, event_type: str, payload: dict[str, Any] | None = None, **kwargs: Any) -> dict:
        merged_payload = dict(payload or {})
        merged_payload.update(kwargs)
        with self._lock:
            self._seq += 1
            cursor = f"dee_cur_{self._seq}"
            evt = {
                "cursor": cursor,
                "seq": self._seq,
                "ts": round(time.time(), 3),
                "type": event_type,
                "payload": merged_payload,
                **merged_payload,
            }
            self._history.append(evt)
            subs = list(self._subs)

        for q in subs:
            if q.qsize() < q.maxsize:
                q.put(evt)
        return evt

    def subscribe(self, replay_history: bool = True) -> Queue:
        q: Queue = Queue(maxsize=250)
        with self._lock:
            self._subs.append(q)
            if replay_history:
                for item in list(self._history)[-25:]:
                    q.put({**item, "historico": True})
        return q

    def unsubscribe(self, q: Queue) -> None:
        with self._lock:
            if q in self._subs:
                self._subs.remove(q)

    def poll_after(self, after_cursor: str | None = None, limit: int = 50) -> dict:
        """grok-bot-cli style delta poll: returns events strictly after `after_cursor`."""
        with self._lock:
            items = list(self._history)
            latest_cursor = items[-1]["cursor"] if items else "dee_cur_0"

        if not after_cursor:
            sliced = items[-limit:]
            return {
                "cursor": latest_cursor,
                "entryCount": len(sliced),
                "gapReset": False,
                "events": sliced,
            }

        idx = next((i for i, e in enumerate(items) if e["cursor"] == after_cursor), None)
        if idx is None:
            sliced = items[-limit:]
            return {
                "cursor": latest_cursor,
                "entryCount": len(sliced),
                "gapReset": True,
                "events": sliced,
            }

        sliced = items[idx + 1 : idx + 1 + limit]
        new_cursor = sliced[-1]["cursor"] if sliced else after_cursor
        return {
            "cursor": new_cursor,
            "entryCount": len(sliced),
            "gapReset": False,
            "events": sliced,
        }

    def poll_delta(self, after_cursor: str | None = None, limit: int = 50) -> dict:
        return self.poll_after(after_cursor=after_cursor, limit=limit)


class DeeCharacterState:
    """Tracks Dee's 3D kinematic pose, eye emotion, and Adaptive FPS target."""

    def __init__(self, bus: EventBus):
        self.bus = bus
        self.action = "idle"
        self.emotion = "curioso"
        self.note = "Dee Prime en línea"
        self.is_speaking = False
        self.is_listening = False
        self.fps_target = 8
        self.since = time.time()
        self._lock = threading.Lock()

    def transition(
        self,
        action: str | None = None,
        emotion: str | None = None,
        note: str = "",
        fps_target: int | None = None,
    ) -> dict:
        with self._lock:
            if action and action in VALID_ACTIONS:
                self.action = action
            if emotion and emotion in VALID_EMOTIONS:
                self.emotion = emotion
            if note:
                self.note = note
            if fps_target is not None:
                self.fps_target = fps_target
            else:
                self.fps_target = 30 if (self.action != "idle" or self.is_speaking or self.is_listening) else 8
            self.since = time.time()
            snap = self.snapshot()
        self.bus.publish("character_state", snap)
        return snap

    def set_action(self, action: str, emotion: str | None = None) -> dict:
        return self.transition(action=action, emotion=emotion)

    def set_emotion(self, emotion: str) -> dict:
        return self.transition(emotion=emotion)

    def set_speaking(self, speaking: bool) -> dict:
        with self._lock:
            self.is_speaking = speaking
            self.fps_target = 30 if speaking else 8
            snap = self.snapshot()
        self.bus.publish("character_state", snap)
        return snap

    def set_listening(self, listening: bool) -> dict:
        with self._lock:
            self.is_listening = listening
            self.fps_target = 30 if listening else 8
            snap = self.snapshot()
        self.bus.publish("character_state", snap)
        return snap

    def snapshot(self) -> dict:
        return {
            "action": self.action,
            "emotion": self.emotion,
            "note": self.note,
            "is_speaking": self.is_speaking,
            "is_listening": self.is_listening,
            "fps_target": self.fps_target,
            "since_s": round(time.time() - self.since, 1),
        }

    def get_state(self) -> dict:
        return self.snapshot()


class TurnInterruptController:
    """Allows instant Barge-In / Kill-Switch interruption of both LLM tokens and TTS audio."""

    def __init__(self, bus: EventBus):
        self.bus = bus
        self._lock = threading.Lock()
        self.turn_id = 0
        self.abort_event = threading.Event()
        self._active_procs: list[Any] = []

    def start_new_turn(self) -> tuple[int, threading.Event]:
        with self._lock:
            if self.abort_event:
                self.abort_event.set()
            self.turn_id += 1
            self.abort_event = threading.Event()
            return self.turn_id, self.abort_event

    def clear_interrupt(self) -> None:
        with self._lock:
            self.abort_event.clear()

    def is_interrupted(self) -> bool:
        return self.abort_event.is_set()

    def register_process(self, proc: Any) -> None:
        with self._lock:
            self._active_procs.append(proc)

    def unregister_process(self, proc: Any) -> None:
        with self._lock:
            if proc in self._active_procs:
                self._active_procs.remove(proc)

    def trigger_barge_in(self, reason: str = "user_barge_in") -> int:
        return self.interrupt_all(reason=reason)

    def trigger_kill_switch(self, reason: str = "emergency_kill_switch") -> int:
        tid = self.interrupt_all(reason=reason)
        self.bus.publish("kill_switch_activated", {"turn_id": tid, "reason": reason})
        return tid

    def interrupt_all(self, reason: str = "user_barge_in") -> int:
        with self._lock:
            if self.abort_event:
                self.abort_event.set()
            procs = list(self._active_procs)
            self._active_procs.clear()
            tid = self.turn_id

        for p in procs:
            try:
                p.terminate()
            except Exception:
                pass

        self.bus.publish("interrupted", {"turn_id": tid, "reason": reason})
        return tid


BUS = EventBus()
CHARACTER = DeeCharacterState(BUS)
TURN_CTRL = TurnInterruptController(BUS)

# Standard aliases used across all sensory, security, and orchestrator modules
event_bus = BUS
character_state = CHARACTER
turn_interrupt = TURN_CTRL

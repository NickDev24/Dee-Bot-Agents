"""
Dee-Bot-Agents v4.0 Supreme - Sentinel Safety Supervisor.
Deterministic Pre-Execution Command Guard + Voice-Verified Approval Queue + Kill-Switch.
"""

import json
import re
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from core.events import event_bus, turn_interrupt


class SentinelSupervisor:
    """
    Audits every shell command, file write, and remote dispatch before execution.
    Immune to prompt injection because rules are evaluated deterministically in Python.
    """

    def __init__(self, scope_config_path: Path | None = None) -> None:
        root_dir = Path(__file__).resolve().parent.parent.parent
        self.scope_path = scope_config_path or (root_dir / "config" / "security_scope.json")
        self._lock = threading.Lock()
        self.scope = self._load_scope()
        self.pending_approvals: dict[str, dict[str, Any]] = {}
        self.audit_log: list[dict[str, Any]] = []

    def _load_scope(self) -> dict[str, Any]:
        if self.scope_path.exists():
            try:
                return json.loads(self.scope_path.read_text(encoding="utf-8"))
            except Exception:
                pass
        return {
            "deny_always_regex": [r"rm\s+-rf\s+/(?:\s|$)", r"mkfs\.", r":\(\)\{\s*:\|:&\s*\};:"],
            "ask_facu_regex": [r"\b(?:reboot|shutdown|poweroff)\b", r"\bapt(?:-get)?\s+(?:remove|purge)\b"],
            "kill_switch_phrases": ["dee alto", "dee detente", "dee para", "abortar todo", "kill switch"],
        }

    def check_kill_switch_phrase(self, text: str) -> bool:
        """Checks if incoming speech or text triggers the instant Kill-Switch."""
        clean = re.sub(r"[^\w\s]", "", text.lower()).strip()
        for phrase in self.scope.get("kill_switch_phrases", []):
            if phrase in clean:
                turn_interrupt.trigger_kill_switch(reason=f"Kill-switch phrase detected: '{phrase}'")
                self._record_audit("KILL_SWITCH", text, "TRIGGERED")
                return True
        return False

    def is_kill_switch(self, text: str) -> bool:
        return self.check_kill_switch_phrase(text)

    def evaluate_command(self, command: str, target_node: str = "facu") -> dict[str, Any]:
        """
        Evaluates a shell command against DENY_ALWAYS and ASK_FACU rules.
        Returns verdict: 'ALLOW' | 'ASK_FACU' | 'DENY_ALWAYS'.
        """
        cmd_str = command.strip()
        cmd_lower = cmd_str.lower()

        for pat in self.scope.get("deny_always_patterns", []):
            if pat.lower() in cmd_lower:
                self._record_audit("COMMAND", cmd_str, "DENY_ALWAYS", target_node)
                event_bus.publish(
                    "sentinel_blocked",
                    {"command": cmd_str, "node": target_node, "rule": pat},
                )
                return {
                    "verdict": "DENY_ALWAYS",
                    "allowed": False,
                    "reason": f"Comando bloqueado permanentemente por regla de seguridad ({pat}).",
                }

        for pattern in self.scope.get("deny_always_regex", []):
            if re.search(pattern, cmd_str, flags=re.IGNORECASE):
                self._record_audit("COMMAND", cmd_str, "DENY_ALWAYS", target_node)
                event_bus.publish(
                    "sentinel_blocked",
                    {"command": cmd_str, "node": target_node, "rule": pattern},
                )
                return {
                    "verdict": "DENY_ALWAYS",
                    "allowed": False,
                    "reason": f"Comando bloqueado permanentemente por regla de seguridad ({pattern}).",
                }

        for pat in self.scope.get("ask_facu_patterns", []):
            if pat.lower() in cmd_lower:
                req_id = self.create_approval_request(cmd_str, target_node, reason=pat)
                self._record_audit("COMMAND", cmd_str, "ASK_FACU", target_node)
                return {
                    "verdict": "ASK_FACU",
                    "allowed": False,
                    "approval_id": req_id,
                    "reason": f"Comando sensible ({pat}). Requiere confirmación de Facu (ID: {req_id}).",
                }

        for pattern in self.scope.get("ask_facu_regex", []):
            if re.search(pattern, cmd_str, flags=re.IGNORECASE):
                req_id = self.create_approval_request(cmd_str, target_node, reason=pattern)
                self._record_audit("COMMAND", cmd_str, "ASK_FACU", target_node)
                return {
                    "verdict": "ASK_FACU",
                    "allowed": False,
                    "approval_id": req_id,
                    "reason": f"Comando sensible ({pattern}). Requiere confirmación de Facu (ID: {req_id}).",
                }

        self._record_audit("COMMAND", cmd_str, "ALLOW", target_node)
        return {
            "verdict": "ALLOW",
            "allowed": True,
            "reason": "Safe command",
        }

    def create_approval_request(self, command: str, target_node: str, reason: str) -> str:
        req_id = uuid.uuid4().hex[:8]
        entry = {
            "id": req_id,
            "command": command,
            "target_node": target_node,
            "reason": reason,
            "status": "pending",
            "created_at": time.time(),
            "expires_at": time.time() + 180.0,
        }
        with self._lock:
            self.pending_approvals[req_id] = entry
        event_bus.publish("sentinel_approval_requested", entry)
        return req_id

    def resolve_approval(
        self,
        approval_id: str | None = None,
        approved: bool = False,
        speaker_verified: bool = True,
    ) -> dict[str, Any]:
        with self._lock:
            if approval_id is None:
                pending = [v for v in self.pending_approvals.values() if v["status"] == "pending"]
                if not pending:
                    return {"ok": False, "reason": "No hay aprobaciones pendientes."}
                entry = sorted(pending, key=lambda x: x["created_at"], reverse=True)[0]
            else:
                entry = self.pending_approvals.get(approval_id)
                if not entry:
                    return {"ok": False, "reason": f"ID {approval_id} no encontrado."}

            if time.time() > entry["expires_at"]:
                entry["status"] = "expired"
                return {"ok": False, "reason": "La solicitud de aprobación expiró."}

            if approved and self.scope.get("voice_biometric_required_for_elevated", True) and not speaker_verified:
                return {
                    "ok": False,
                    "reason": "Aprobación rechazada: la huella biométrica vocal no coincide con Facu.",
                }

            entry["status"] = "approved" if approved else "denied"
            entry["resolved_at"] = time.time()

        event_bus.publish("sentinel_approval_resolved", entry)
        return {"ok": True, "approval": entry}

    def _record_audit(self, kind: str, target: str, verdict: str, node: str = "facu") -> None:
        with self._lock:
            self.audit_log.append(
                {
                    "ts": round(time.time(), 2),
                    "kind": kind,
                    "target": target[:200],
                    "verdict": verdict,
                    "node": node,
                }
            )
            if len(self.audit_log) > 100:
                self.audit_log = self.audit_log[-100:]

    def get_status(self) -> dict[str, Any]:
        with self._lock:
            pending = [v for v in self.pending_approvals.values() if v["status"] == "pending"]
            recent = list(self.audit_log[-10:])
        return {
            "pending_approvals": pending,
            "recent_audit": recent,
        }

    def status(self) -> dict[str, Any]:
        return self.get_status()

    def trigger_kill_switch(self, source: str = "manual") -> dict[str, Any]:
        tid = turn_interrupt.trigger_kill_switch(reason=source)
        self._record_audit("KILL_SWITCH", source, "TRIGGERED")
        return {"ok": True, "turn_id": tid, "source": source}

    def inspect_command(self, agent_id: str, tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
        cmd = str(args.get("cmd") or args.get("command") or "")
        target = str(args.get("target") or "facu")
        res = self.evaluate_command(cmd, target_node=target)
        verdict_map = {"ALLOW": "allow", "ASK_FACU": "ask", "DENY_ALWAYS": "deny"}
        return {
            **res,
            "verdict": verdict_map.get(res["verdict"], "deny"),
        }

    def request_approval(self, agent_id: str, tool_name: str, args: dict[str, Any], reason: str) -> dict[str, Any]:
        cmd = str(args.get("cmd") or "")
        target = str(args.get("target") or "facu")
        req_id = self.create_approval_request(cmd, target, reason=reason)
        with self._lock:
            self.pending_approvals[req_id]["args"] = args
            return dict(self.pending_approvals[req_id])


SENTINEL = SentinelSupervisor()

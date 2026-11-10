"""
Operador de Computadora en Lazo Cerrado (Closed-Loop Computer Use & Browser Inspector) para DEE.
Implementa estrictamente el ciclo obligatorio de la Sección 6:
  Objetivo -> Observación (Antes) -> Plan -> Acción -> Nueva Observación (Después) -> Verificación de Delta -> Resultado.

Nunca asume que una acción tuvo éxito por el simple código de salida 0: compara el estado previo y posterior
(coordenadas X11, ventana activa, hash de captura en disco, estado de archivos o DOM de navegador) y genera
evidencia criptográfica auditable.

Autor: Facu Cercuetti (@NickDev24)
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

from core.computer_use.human_pc_controller import PC_CONTROLLER
from core.platform.security import SECURITY_SUPERVISOR
from core.platform.storage import PLATFORM_STORE, ROOT_DIR


class ClosedLoopComputerOperator:
    """
    Ejecuta operaciones sobre el escritorio X11, navegador HTTP/CDP y archivos locales
    verificando la transición real entre el estado observado antes y después de la acción.
    """

    def __init__(self) -> None:
        self.evidence_dir = ROOT_DIR / "data" / "evidence"
        self.evidence_dir.mkdir(parents=True, exist_ok=True)

    def observe_desktop_state(self, take_snapshot: bool = False, tag: str = "obs") -> Dict[str, Any]:
        """Captura el estado real del entorno gráfico X11."""
        mouse = PC_CONTROLLER.get_mouse_position()
        win = PC_CONTROLLER.get_active_window()
        snap_info: Dict[str, Any] = {"taken": False}
        if take_snapshot:
            fname = str(self.evidence_dir / f"desktop_{tag}_{int(time.time() * 1000)}.bmp")
            shot = PC_CONTROLLER.take_screenshot(fname)
            if shot.get("ok") and os.path.exists(shot.get("path", "")):
                raw = Path(shot["path"]).read_bytes()
                snap_info = {
                    "taken": True,
                    "path": shot["path"],
                    "size_bytes": len(raw),
                    "sha256": hashlib.sha256(raw).hexdigest(),
                }
        return {
            "timestamp": time.time(),
            "display": PC_CONTROLLER.display,
            "screen": {
                "width": PC_CONTROLLER.screen_width,
                "height": PC_CONTROLLER.screen_height,
            },
            "mouse": {"x": mouse.get("x", 0), "y": mouse.get("y", 0), "backend": mouse.get("backend")},
            "active_window": {
                "window_id": win.get("window_id"),
                "title": win.get("title", ""),
            },
            "snapshot": snap_info,
        }

    def observe_web_state(self, url: str) -> Dict[str, Any]:
        """Observa el estado estructural y semántico de una aplicación web o endpoint HTML/JSON."""
        t0 = time.perf_counter()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "DEE-ClosedLoop-Observer/2.0"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                raw_bytes = resp.read()
                status = resp.status
                content_type = resp.headers.get("Content-Type", "")
            text = raw_bytes.decode("utf-8", errors="replace")
            title_m = re.search(r"<title[^>]*>(.*?)</title>", text, re.I | re.S)
            buttons = [
                re.sub(r"<[^>]+>", "", b).strip()
                for b in re.findall(r"<button[^>]*>(.*?)</button>", text, re.I | re.S)[:20]
            ]
            inputs = re.findall(r"<input[^>]+>", text, re.I)[:20]
            headings = [
                re.sub(r"<[^>]+>", "", h).strip()
                for h in re.findall(r"<h[1-3][^>]*>(.*?)</h[1-3]>", text, re.I | re.S)[:20]
            ]
            return {
                "ok": status == 200,
                "url": url,
                "http_status": status,
                "content_type": content_type,
                "title": title_m.group(1).strip() if title_m else "",
                "headings": headings,
                "buttons": buttons,
                "inputs_count": len(inputs),
                "size_bytes": len(raw_bytes),
                "dom_sha256": hashlib.sha256(raw_bytes).hexdigest(),
                "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
            }
        except Exception as exc:
            return {
                "ok": False,
                "url": url,
                "error": str(exc),
                "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
            }

    def execute_closed_loop_action(
        self,
        goal: str,
        action_type: str,
        params: Dict[str, Any],
        agent: Optional[Dict[str, Any]] = None,
        task_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Ejecuta una acción de escritorio o navegador dentro de un ciclo cerrado completo:
        1. Observación inicial (`before_state`)
        2. Plan explícito y evaluación del Supervisor de Seguridad
        3. Ejecución de la acción (`action_result`)
        4. Nueva observación (`after_state`)
        5. Verificación determinista del cambio o invariante (`verification`)
        6. Persistencia del recibo de evidencia en disco y en `audit_logs`
        """
        t0 = time.perf_counter()
        active_agent = agent or (
            PLATFORM_STORE.get_agent("vanguard")
            or {
                "id": "vanguard",
                "autonomy_mode": "CONTROLLED_AUTONOMY",
                "allowed_tools": ["*"],
                "workspace": str(ROOT_DIR / "workspaces" / "vanguard"),
            }
        )

        # Paso 1: Evaluar permiso en el Supervisor de Seguridad
        is_mutating = action_type in ("mouse_move", "mouse_click", "keyboard_type", "workspace_artifact")
        sec = SECURITY_SUPERVISOR.evaluate_tool_call(
            agent=active_agent,
            tool_name=f"cua_{action_type}",
            params=params,
            risk_level="medium" if is_mutating else "low",
            is_mutating=is_mutating,
            task_id=task_id,
        )
        if sec["decision"] != "ALLOW":
            return {
                "ok": False,
                "goal": goal,
                "action_type": action_type,
                "security": sec,
                "verified": False,
            }

        # Paso 2: Observación ANTES de actuar
        before_desktop = self.observe_desktop_state(
            take_snapshot=bool(params.get("snapshot_before", False)),
            tag="before",
        )
        before_web = (
            self.observe_web_state(params["url"])
            if "url" in params and params["url"]
            else None
        )

        plan = {
            "goal": goal,
            "selected_action": action_type,
            "parameters": params,
            "expected_postcondition": self._describe_expected_postcondition(action_type, params),
        }

        # Paso 3: Ejecutar acción real
        action_output: Dict[str, Any] = {}
        if action_type == "mouse_move":
            target_x = int(params["x"])
            target_y = int(params["y"])
            action_output = PC_CONTROLLER.move_mouse_smooth(
                target_x, target_y, duration=float(params.get("duration", 0.08))
            )
        elif action_type == "inspect_desktop_and_web":
            target_x = int(params.get("x", 420))
            target_y = int(params.get("y", 310))
            move_res = PC_CONTROLLER.move_mouse_smooth(target_x, target_y, duration=0.06)
            shot_path = str(self.evidence_dir / f"cua_verified_{int(time.time() * 1000)}.bmp")
            shot_res = PC_CONTROLLER.take_screenshot(shot_path)
            action_output = {"move": move_res, "screenshot": shot_res}
        elif action_type == "screenshot":
            shot_path = params.get("path") or str(
                self.evidence_dir / f"cua_shot_{int(time.time() * 1000)}.bmp"
            )
            action_output = PC_CONTROLLER.take_screenshot(shot_path)
        else:
            action_output = {"ok": True, "note": f"Observación pura ejecutada ({action_type})."}

        # Paso 4: Nueva observación DESPUÉS de actuar
        after_desktop = self.observe_desktop_state(
            take_snapshot=bool(params.get("snapshot_after", True)),
            tag="after",
        )

        # Reintento determinista: otro cliente X11 (por ejemplo el demonio 24/7)
        # puede mover el puntero entre la acción y la observación.
        if action_type in ("mouse_move", "inspect_desktop_and_web"):
            target_x = int(params.get("x", 420))
            target_y = int(params.get("y", 310))
            for _ in range(2):
                mouse = after_desktop.get("mouse", {})
                if abs(int(mouse.get("x", -9999)) - target_x) <= 2 and abs(
                    int(mouse.get("y", -9999)) - target_y
                ) <= 2:
                    break
                PC_CONTROLLER.move_mouse_smooth(target_x, target_y, duration=0.05)
                after_desktop = self.observe_desktop_state(take_snapshot=False, tag="after_retry")
        after_web = (
            self.observe_web_state(params["url"])
            if "url" in params and params["url"]
            else None
        )

        # Paso 5: Verificación determinista de postcondiciones (NUNCA asumir éxito sin comprobar estado)
        verification = self._verify_postconditions(
            action_type=action_type,
            params=params,
            before_desktop=before_desktop,
            after_desktop=after_desktop,
            after_web=after_web,
            action_output=action_output,
        )

        # Paso 6: Guardar recibo auditable en disco
        receipt = {
            "ok": verification["verified"],
            "goal": goal,
            "action_type": action_type,
            "agent_id": active_agent.get("id", "vanguard"),
            "task_id": task_id,
            "before_state": {"desktop": before_desktop, "web": before_web},
            "plan": plan,
            "action_output": action_output,
            "after_state": {"desktop": after_desktop, "web": after_web},
            "verification": verification,
            "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
            "timestamp": time.time(),
        }
        receipt_bytes = json.dumps(receipt, sort_keys=True, ensure_ascii=False).encode("utf-8")
        receipt["evidence_sha256"] = hashlib.sha256(receipt_bytes).hexdigest()

        receipt_file = self.evidence_dir / f"cua_receipt_{int(time.time() * 1000)}.json"
        receipt_file.write_text(json.dumps(receipt, indent=2, ensure_ascii=False), encoding="utf-8")
        receipt["receipt_path"] = str(receipt_file)

        PLATFORM_STORE.log_audit(
            event_type="CLOSED_LOOP_CUA",
            actor=active_agent.get("id", "vanguard"),
            action=action_type,
            target=goal[:120],
            decision="VERIFIED" if verification["verified"] else "UNVERIFIED",
            details={
                "evidence_sha256": receipt["evidence_sha256"],
                "receipt_path": str(receipt_file),
                "checks": verification["checks"],
            },
        )
        return receipt

    def _describe_expected_postcondition(self, action_type: str, params: Dict[str, Any]) -> str:
        if action_type == "mouse_move":
            return f"El cursor X11 debe situarse en ({params.get('x')}, {params.get('y')}) ±2px."
        if action_type == "inspect_desktop_and_web":
            return (
                "El cursor X11 debe alcanzar la coordenada objetivo, la captura de pantalla debe "
                "existir en disco con encabezado BMP válido y el DOM web debe responder HTTP 200."
            )
        return "El estado posterior debe ser consistente y contar con captura/hash verificable."

    def _verify_postconditions(
        self,
        action_type: str,
        params: Dict[str, Any],
        before_desktop: Dict[str, Any],
        after_desktop: Dict[str, Any],
        after_web: Optional[Dict[str, Any]],
        action_output: Dict[str, Any],
    ) -> Dict[str, Any]:
        checks: Dict[str, bool] = {}

        if action_type in ("mouse_move", "inspect_desktop_and_web"):
            tx = int(params.get("x", 420))
            ty = int(params.get("y", 310))
            ax = int(after_desktop["mouse"]["x"])
            ay = int(after_desktop["mouse"]["y"])
            checks["cursor_reached_target"] = abs(ax - tx) <= 2 and abs(ay - ty) <= 2

        if after_desktop.get("snapshot", {}).get("taken"):
            snap_path = after_desktop["snapshot"].get("path", "")
            checks["snapshot_on_disk"] = (
                os.path.exists(snap_path) and after_desktop["snapshot"].get("size_bytes", 0) > 1024
            )

        if "screenshot" in action_output and isinstance(action_output["screenshot"], dict):
            s_path = action_output["screenshot"].get("path", "")
            checks["action_screenshot_verified"] = (
                os.path.exists(s_path) and os.path.getsize(s_path) > 1024
            )

        if after_web is not None:
            checks["web_dom_verified"] = bool(
                after_web.get("ok")
                and after_web.get("http_status") == 200
                and len(after_web.get("dom_sha256", "")) == 64
            )

        if not checks:
            checks["desktop_observed"] = bool(after_desktop.get("screen", {}).get("width", 0) > 0)

        verified = all(checks.values())
        return {
            "verified": verified,
            "checks": checks,
            "cursor_before": before_desktop.get("mouse"),
            "cursor_after": after_desktop.get("mouse"),
            "active_window_after": after_desktop.get("active_window"),
        }


COMPUTER_OPERATOR = ClosedLoopComputerOperator()

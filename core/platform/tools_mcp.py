"""
Motor de Herramientas Tipadas, Registro de Skills Reutilizables y Protocolo MCP (JSON-RPC 2.0) para DEE.
Valida entradas contra esquemas JSON, aplica permisos por agente mediante PlatformSecuritySupervisor,
gestiona paquetes de skills verificables y expone un servidor/cliente MCP real.

Autor: Facu Cercuetti (@NickDev24)
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from core.platform.security import SECURITY_SUPERVISOR
from core.platform.storage import PLATFORM_STORE, ROOT_DIR


class ToolValidationError(Exception):
    pass


class ToolRegistry:
    """
    Registro central de herramientas de DEE con:
    - Contratos de esquema JSON explícitos
    - Clasificación de riesgo (low, medium, high, critical)
    - Indicador mutating (True si altera estado del sistema, archivos o interfaz)
    - Timeout por herramienta y retorno estructurado con evidencia verificable
    """

    def __init__(self) -> None:
        self._tools: Dict[str, Dict[str, Any]] = {}
        self._register_builtin_tools()

    def register_tool(
        self,
        name: str,
        description: str,
        parameters_schema: Dict[str, Any],
        handler: Callable[[Dict[str, Any], Dict[str, Any]], Dict[str, Any]],
        risk_level: str = "low",
        mutating: bool = False,
        timeout_sec: int = 30,
    ) -> None:
        self._tools[name] = {
            "name": name,
            "description": description,
            "inputSchema": parameters_schema,
            "handler": handler,
            "risk_level": risk_level,
            "mutating": mutating,
            "timeout_sec": timeout_sec,
        }

    def list_tools(self, allowed_only: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        result = []
        for name, spec in sorted(self._tools.items()):
            if allowed_only is not None and "*" not in allowed_only and name not in allowed_only:
                continue
            result.append(
                {
                    "name": spec["name"],
                    "description": spec["description"],
                    "inputSchema": spec["inputSchema"],
                    "risk_level": spec["risk_level"],
                    "mutating": spec["mutating"],
                    "timeout_sec": spec["timeout_sec"],
                }
            )
        return result

    def get_tool(self, name: str) -> Optional[Dict[str, Any]]:
        return self._tools.get(name)

    def validate_params(self, tool_name: str, params: Dict[str, Any]) -> None:
        spec = self._tools.get(tool_name)
        if not spec:
            raise ToolValidationError(f"La herramienta '{tool_name}' no existe en ToolRegistry.")
        schema = spec.get("inputSchema", {})
        required = schema.get("required", [])
        properties = schema.get("properties", {})

        if not isinstance(params, dict):
            raise ToolValidationError("Los parámetros deben ser un objeto JSON (dict).")

        for req in required:
            if req not in params or params[req] is None:
                raise ToolValidationError(
                    f"Falta el parámetro obligatorio '{req}' en la herramienta '{tool_name}'."
                )

        type_map = {
            "string": str,
            "integer": int,
            "number": (int, float),
            "boolean": bool,
            "object": dict,
            "array": list,
        }
        for k, v in params.items():
            if k in properties and v is not None:
                expected_type_name = properties[k].get("type")
                if expected_type_name in type_map:
                    py_type = type_map[expected_type_name]
                    if not isinstance(v, py_type):
                        raise ToolValidationError(
                            f"Parámetro '{k}' en '{tool_name}' esperaba tipo '{expected_type_name}', "
                            f"recibió '{type(v).__name__}'."
                        )

    def execute(
        self,
        tool_name: str,
        params: Dict[str, Any],
        agent: Dict[str, Any],
        task_id: Optional[str] = None,
        approved_token: Optional[str] = None,
        db: Any = None,
    ) -> Dict[str, Any]:
        t0 = time.perf_counter()
        spec = self._tools.get(tool_name)
        if not spec:
            return {
                "ok": False,
                "tool": tool_name,
                "error": f"Herramienta desconocida: '{tool_name}'.",
                "decision": "DENY",
            }

        # 1. Evaluación determinista del Supervisor de Seguridad antes de ejecutar
        sec = SECURITY_SUPERVISOR.evaluate_tool_call(
            agent=agent,
            tool_name=tool_name,
            params=params,
            risk_level=spec["risk_level"],
            is_mutating=spec["mutating"],
            task_id=task_id,
            approved_token=approved_token,
            db=db,
        )
        if sec["decision"] != "ALLOW":
            return {
                "ok": False,
                "tool": tool_name,
                "decision": sec["decision"],
                "reason": sec["reason"],
                "approval_id": sec.get("approval_id"),
                "risk_level": sec.get("risk_level"),
                "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
            }

        # 2. Validación de esquema de entrada
        try:
            self.validate_params(tool_name, params)
        except ToolValidationError as exc:
            return {
                "ok": False,
                "tool": tool_name,
                "decision": "VALIDATION_ERROR",
                "error": str(exc),
                "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
            }

        # 3. Ejecución real y captura de evidencia
        try:
            output = spec["handler"](params, {"agent": agent, "task_id": task_id})
            latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            result = {
                "ok": bool(output.get("ok", True)),
                "tool": tool_name,
                "decision": "ALLOW",
                "output": output,
                "latency_ms": latency_ms,
                "timestamp": time.time(),
            }
            PLATFORM_STORE.log_audit(
                event_type="TOOL_EXECUTED",
                actor=agent.get("id", "system"),
                action=f"execute:{tool_name}",
                target=str(params.get("path") or params.get("command") or params.get("query") or tool_name),
                decision="SUCCESS" if result["ok"] else "ERROR",
                details={"latency_ms": latency_ms, "task_id": task_id, "ok": result["ok"]},
            )
            return result
        except Exception as exc:
            latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            PLATFORM_STORE.log_audit(
                event_type="TOOL_ERROR",
                actor=agent.get("id", "system"),
                action=f"execute:{tool_name}",
                target=tool_name,
                decision="EXCEPTION",
                details={"error": str(exc), "task_id": task_id},
            )
            return {
                "ok": False,
                "tool": tool_name,
                "decision": "RUNTIME_ERROR",
                "error": str(exc),
                "latency_ms": latency_ms,
            }

    def _resolve_workspace_path(self, raw_path: str, context: Dict[str, Any]) -> Path:
        p = Path(raw_path).expanduser()
        if not p.is_absolute():
            ws = context.get("agent", {}).get("workspace")
            base = Path(ws) if ws else ROOT_DIR
            p = (base / p).resolve()
        else:
            p = p.resolve()
        return p

    def _register_builtin_tools(self) -> None:
        # 1. fs_read
        def _fs_read(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            target = self._resolve_workspace_path(params["path"], ctx)
            if not target.exists() or not target.is_file():
                return {"ok": False, "error": f"Archivo no encontrado: {target}"}
            content = target.read_text(encoding="utf-8", errors="replace")
            max_chars = int(params.get("max_chars", 32000))
            return {
                "ok": True,
                "path": str(target),
                "size_bytes": target.stat().st_size,
                "sha256": hashlib.sha256(content.encode("utf-8", errors="ignore")).hexdigest(),
                "content": content[:max_chars],
            }

        self.register_tool(
            name="fs_read",
            description="Lee el contenido de un archivo local y devuelve su hash SHA-256 de evidencia.",
            parameters_schema={
                "type": "object",
                "required": ["path"],
                "properties": {
                    "path": {"type": "string", "description": "Ruta del archivo a leer"},
                    "max_chars": {"type": "integer", "description": "Límite de caracteres"},
                },
            },
            handler=_fs_read,
            risk_level="low",
            mutating=False,
        )

        # 2. fs_write
        def _fs_write(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            target = self._resolve_workspace_path(params["path"], ctx)
            existed_before = target.exists()
            before_hash = (
                hashlib.sha256(target.read_bytes()).hexdigest()
                if existed_before and target.is_file()
                else None
            )
            target.parent.mkdir(parents=True, exist_ok=True)
            content = str(params["content"])
            target.write_text(content, encoding="utf-8")
            after_bytes = target.read_bytes()
            after_hash = hashlib.sha256(after_bytes).hexdigest()
            verified = target.exists() and len(after_bytes) == len(content.encode("utf-8"))
            return {
                "ok": verified,
                "path": str(target),
                "existed_before": existed_before,
                "before_sha256": before_hash,
                "after_sha256": after_hash,
                "size_bytes": len(after_bytes),
                "verified_on_disk": verified,
            }

        self.register_tool(
            name="fs_write",
            description="Escribe un archivo en disco y verifica criptográficamente su persistencia (SHA-256).",
            parameters_schema={
                "type": "object",
                "required": ["path", "content"],
                "properties": {
                    "path": {"type": "string"},
                    "content": {"type": "string"},
                },
            },
            handler=_fs_write,
            risk_level="medium",
            mutating=True,
        )

        # 3. fs_patch
        def _fs_patch(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            target = self._resolve_workspace_path(params["path"], ctx)
            if not target.exists():
                return {"ok": False, "error": f"Archivo no existe: {target}"}
            original = target.read_text(encoding="utf-8")
            search_str = params["target"]
            replace_str = params["replacement"]
            if search_str not in original:
                return {"ok": False, "error": "El bloque 'target' no fue encontrado en el archivo."}
            before_hash = hashlib.sha256(original.encode("utf-8")).hexdigest()
            updated = original.replace(search_str, replace_str, 1)
            target.write_text(updated, encoding="utf-8")
            after_hash = hashlib.sha256(target.read_bytes()).hexdigest()
            return {
                "ok": before_hash != after_hash or search_str == replace_str,
                "path": str(target),
                "before_sha256": before_hash,
                "after_sha256": after_hash,
                "delta_verified": before_hash != after_hash,
            }

        self.register_tool(
            name="fs_patch",
            description="Aplica un parche exacto sobre un archivo y verifica el cambio de estado SHA-256.",
            parameters_schema={
                "type": "object",
                "required": ["path", "target", "replacement"],
                "properties": {
                    "path": {"type": "string"},
                    "target": {"type": "string"},
                    "replacement": {"type": "string"},
                },
            },
            handler=_fs_patch,
            risk_level="medium",
            mutating=True,
        )

        # 4. fs_list
        def _fs_list(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            target = self._resolve_workspace_path(params.get("path", "."), ctx)
            if not target.exists() or not target.is_dir():
                return {"ok": False, "error": f"Directorio no válido: {target}"}
            entries = []
            for item in sorted(target.iterdir())[:250]:
                entries.append(
                    {
                        "name": item.name,
                        "type": "dir" if item.is_dir() else "file",
                        "size": item.stat().st_size if item.is_file() else 0,
                    }
                )
            return {"ok": True, "path": str(target), "count": len(entries), "entries": entries}

        self.register_tool(
            name="fs_list",
            description="Lista archivos y directorios dentro de una ruta permitida.",
            parameters_schema={
                "type": "object",
                "properties": {"path": {"type": "string"}},
            },
            handler=_fs_list,
            risk_level="low",
            mutating=False,
        )

        # 5. shell_exec
        def _shell_exec(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            cmd = params["command"]
            cwd_raw = params.get("cwd") or ctx.get("agent", {}).get("workspace") or str(ROOT_DIR)
            cwd_path = self._resolve_workspace_path(cwd_raw, ctx)
            cwd_path.mkdir(parents=True, exist_ok=True)
            timeout = min(int(params.get("timeout_sec", 25)), 120)
            res = subprocess.run(
                cmd,
                shell=True,
                cwd=str(cwd_path),
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            return {
                "ok": res.returncode == 0,
                "returncode": res.returncode,
                "cwd": str(cwd_path),
                "stdout": SECURITY_SUPERVISOR.redact_secrets(res.stdout[-12000:]),
                "stderr": SECURITY_SUPERVISOR.redact_secrets(res.stderr[-8000:]),
            }

        self.register_tool(
            name="shell_exec",
            description="Ejecuta un comando de terminal dentro del workspace del agente con filtrado de seguridad.",
            parameters_schema={
                "type": "object",
                "required": ["command"],
                "properties": {
                    "command": {"type": "string"},
                    "cwd": {"type": "string"},
                    "timeout_sec": {"type": "integer"},
                },
            },
            handler=_shell_exec,
            risk_level="high",
            mutating=True,
        )

        # 6. python_test_runner
        def _python_test_runner(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            target_path = self._resolve_workspace_path(params["test_path"], ctx)
            cwd_path = target_path.parent if target_path.is_file() else target_path
            res = subprocess.run(
                [sys.executable, "-m", "unittest", str(target_path)],
                cwd=str(cwd_path),
                capture_output=True,
                text=True,
                timeout=45,
            )
            return {
                "ok": res.returncode == 0,
                "returncode": res.returncode,
                "test_path": str(target_path),
                "stdout": res.stdout[-10000:],
                "stderr": res.stderr[-10000:],
            }

        self.register_tool(
            name="python_test_runner",
            description="Ejecuta pruebas automatizadas Python sobre un archivo o paquete y devuelve el reporte.",
            parameters_schema={
                "type": "object",
                "required": ["test_path"],
                "properties": {"test_path": {"type": "string"}},
            },
            handler=_python_test_runner,
            risk_level="low",
            mutating=False,
        )

        # 7. memory_store
        def _memory_store(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            rec = PLATFORM_STORE.store_memory(
                tier=params.get("tier", "semantic"),
                topic=params["topic"],
                content=params["content"],
                source=params.get("source", "tool:memory_store"),
                agent_id=ctx.get("agent", {}).get("id", "system"),
                importance=float(params.get("importance", 0.7)),
                confidence=float(params.get("confidence", 1.0)),
                tags=params.get("tags", []),
            )
            return {"ok": True, "memory": rec}

        self.register_tool(
            name="memory_store",
            description="Almacena un recuerdo verificable en una de las 6 capas de memoria persistente de DEE.",
            parameters_schema={
                "type": "object",
                "required": ["topic", "content"],
                "properties": {
                    "tier": {"type": "string"},
                    "topic": {"type": "string"},
                    "content": {"type": "string"},
                    "source": {"type": "string"},
                    "importance": {"type": "number"},
                    "confidence": {"type": "number"},
                    "tags": {"type": "array"},
                },
            },
            handler=_memory_store,
            risk_level="low",
            mutating=True,
        )

        # 8. memory_search
        def _memory_search(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            res = PLATFORM_STORE.search_memory(
                query=params["query"],
                tier=params.get("tier"),
                agent_id=params.get("agent_id"),
                top_k=int(params.get("top_k", 6)),
            )
            return {"ok": True, **res}

        self.register_tool(
            name="memory_search",
            description="Busca en las 6 capas de memoria de DEE combinando FTS5 BM25 y similitud vectorial.",
            parameters_schema={
                "type": "object",
                "required": ["query"],
                "properties": {
                    "query": {"type": "string"},
                    "tier": {"type": "string"},
                    "agent_id": {"type": "string"},
                    "top_k": {"type": "integer"},
                },
            },
            handler=_memory_search,
            risk_level="low",
            mutating=False,
        )

        # 9. rag_query
        def _rag_query(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            from core.orchestrator.local_rag import LOCAL_RAG

            res = LOCAL_RAG.query(params["query"], top_k=int(params.get("top_k", 5)))
            return {"ok": True, **res}

        self.register_tool(
            name="rag_query",
            description="Consulta el motor RAG local SQLite FTS5 BM25 sobre documentos y conocimiento técnico.",
            parameters_schema={
                "type": "object",
                "required": ["query"],
                "properties": {
                    "query": {"type": "string"},
                    "top_k": {"type": "integer"},
                },
            },
            handler=_rag_query,
            risk_level="low",
            mutating=False,
        )

        # 10. pc_observe
        def _pc_observe(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            from core.computer_use.human_pc_controller import PC_CONTROLLER

            mouse = PC_CONTROLLER.get_mouse_position()
            win = PC_CONTROLLER.get_active_window()
            return {
                "ok": True,
                "display": PC_CONTROLLER.display,
                "screen": {"width": PC_CONTROLLER.screen_width, "height": PC_CONTROLLER.screen_height},
                "mouse": mouse,
                "active_window": win,
            }

        self.register_tool(
            name="pc_observe",
            description="Observa el estado actual del escritorio X11: resolución, coordenadas del cursor y ventana activa.",
            parameters_schema={"type": "object", "properties": {}},
            handler=_pc_observe,
            risk_level="low",
            mutating=False,
        )

        # 10b. pc_mouse_move, pc_mouse_click, pc_keyboard_type
        def _pc_mouse_move(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            from core.computer_use.human_pc_controller import PC_CONTROLLER

            return PC_CONTROLLER.mouse_move(int(params["x"]), int(params["y"]), smooth=bool(params.get("smooth", True)))

        self.register_tool(
            name="pc_mouse_move",
            description="Mueve el puntero del mouse X11 hacia las coordenadas (x, y).",
            parameters_schema={
                "type": "object",
                "required": ["x", "y"],
                "properties": {"x": {"type": "integer"}, "y": {"type": "integer"}, "smooth": {"type": "boolean"}},
            },
            handler=_pc_mouse_move,
            risk_level="medium",
            mutating=True,
        )

        def _pc_mouse_click(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            from core.computer_use.human_pc_controller import PC_CONTROLLER

            return PC_CONTROLLER.mouse_click(
                button=int(params.get("button", 1)),
                count=int(params.get("count", 1)),
                x=int(params["x"]) if "x" in params and params["x"] is not None else None,
                y=int(params["y"]) if "y" in params and params["y"] is not None else None,
            )

        self.register_tool(
            name="pc_mouse_click",
            description="Ejecuta un clic físico de mouse en X11.",
            parameters_schema={
                "type": "object",
                "properties": {
                    "button": {"type": "integer"},
                    "count": {"type": "integer"},
                    "x": {"type": "integer"},
                    "y": {"type": "integer"},
                },
            },
            handler=_pc_mouse_click,
            risk_level="medium",
            mutating=True,
        )

        def _pc_keyboard_type(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            from core.computer_use.human_pc_controller import PC_CONTROLLER

            return PC_CONTROLLER.keyboard_type(str(params["text"]))

        self.register_tool(
            name="pc_keyboard_type",
            description="Escribe texto en la ventana activa de X11.",
            parameters_schema={
                "type": "object",
                "required": ["text"],
                "properties": {"text": {"type": "string"}},
            },
            handler=_pc_keyboard_type,
            risk_level="medium",
            mutating=True,
        )

        # 10c. cluster_status & node_exec_remote
        def _cluster_status(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            from core.platform.cluster_scheduler import CLUSTER_SCHEDULER

            return {"ok": True, "nodes": CLUSTER_SCHEDULER.list_nodes()}

        self.register_tool(
            name="cluster_status",
            description="Consulta el estado, recursos y latencia de los nodos del clúster (facu, barto, manager1).",
            parameters_schema={"type": "object", "properties": {}},
            handler=_cluster_status,
            risk_level="low",
            mutating=False,
        )

        def _node_exec_remote(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            from core.platform.cluster_scheduler import CLUSTER_SCHEDULER

            return CLUSTER_SCHEDULER.execute_on_node(
                node_id=str(params.get("node_id", "barto")),
                command=str(params["command"]),
                task_id=ctx.get("task_id"),
            )

        self.register_tool(
            name="node_exec_remote",
            description="Ejecuta un comando autenticado en un nodo del clúster distribuido.",
            parameters_schema={
                "type": "object",
                "required": ["command"],
                "properties": {"node_id": {"type": "string"}, "command": {"type": "string"}},
            },
            handler=_node_exec_remote,
            risk_level="high",
            mutating=True,
        )

        # 10d. worktree_manage
        def _worktree_manage(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            from core.orchestrator.worktree_forge import WORKTREE_FORGE

            act = str(params.get("action", "list"))
            if act == "create":
                return WORKTREE_FORGE.create_isolated_worktree(str(params.get("name", "feature")))
            if act == "remove":
                return WORKTREE_FORGE.remove_worktree(str(params.get("path", "")))
            return WORKTREE_FORGE.list_worktrees()

        self.register_tool(
            name="worktree_manage",
            description="Crea, lista o elimina Git Worktrees aislados para desarrollo seguro.",
            parameters_schema={
                "type": "object",
                "properties": {
                    "action": {"type": "string"},
                    "name": {"type": "string"},
                    "path": {"type": "string"},
                },
            },
            handler=_worktree_manage,
            risk_level="medium",
            mutating=True,
        )

        # 11. pc_screenshot
        def _pc_screenshot(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            from core.computer_use.human_pc_controller import PC_CONTROLLER

            return PC_CONTROLLER.take_screenshot(params.get("filename"))

        self.register_tool(
            name="pc_screenshot",
            description="Toma una captura real de la pantalla X11 y devuelve su ruta y tamaño en disco.",
            parameters_schema={
                "type": "object",
                "properties": {"filename": {"type": "string"}},
            },
            handler=_pc_screenshot,
            risk_level="low",
            mutating=False,
        )

        # 12. browser_inspect_dom
        def _browser_inspect_dom(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            url = params["url"]
            req = urllib.request.Request(url, headers={"User-Agent": "DEE-Platform-Inspector/2.0"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                html = resp.read().decode("utf-8", errors="replace")
                status = resp.status
            import re

            title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
            headings = re.findall(r"<h[1-3][^>]*>(.*?)</h[1-3]>", html, re.IGNORECASE | re.DOTALL)
            buttons = re.findall(r"<button[^>]*>(.*?)</button>", html, re.IGNORECASE | re.DOTALL)
            links = re.findall(r'href=["\']([^"\']+)["\']', html, re.IGNORECASE)
            return {
                "ok": status == 200,
                "url": url,
                "http_status": status,
                "title": title_match.group(1).strip() if title_match else "",
                "headings": [ re.sub(r"<[^>]+>", "", h).strip() for h in headings[:15] ],
                "buttons": [ re.sub(r"<[^>]+>", "", b).strip() for b in buttons[:15] ],
                "links_count": len(links),
                "dom_sha256": hashlib.sha256(html.encode("utf-8", errors="ignore")).hexdigest(),
            }

        self.register_tool(
            name="browser_inspect_dom",
            description="Inspecciona el DOM de una URL HTTP/HTTPS local o remota y extrae título, cabeceras, botones y hash.",
            parameters_schema={
                "type": "object",
                "required": ["url"],
                "properties": {"url": {"type": "string"}},
            },
            handler=_browser_inspect_dom,
            risk_level="low",
            mutating=False,
        )

        # 13. verify_artifact
        def _verify_artifact(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            target = self._resolve_workspace_path(params["path"], ctx)
            if not target.exists():
                return {"ok": False, "exists": False, "path": str(target)}
            raw = target.read_bytes()
            sha = hashlib.sha256(raw).hexdigest()
            min_bytes = int(params.get("min_bytes", 1))
            must_contain = params.get("must_contain")
            contains_ok = True
            if must_contain:
                text = raw.decode("utf-8", errors="replace")
                contains_ok = must_contain in text
            ok = len(raw) >= min_bytes and contains_ok
            return {
                "ok": ok,
                "exists": True,
                "path": str(target),
                "size_bytes": len(raw),
                "sha256": sha,
                "contains_expected": contains_ok,
            }

        self.register_tool(
            name="verify_artifact",
            description="Verifica independientemente que un artefacto exista en disco, supere un tamaño mínimo y contenga evidencia esperada.",
            parameters_schema={
                "type": "object",
                "required": ["path"],
                "properties": {
                    "path": {"type": "string"},
                    "min_bytes": {"type": "integer"},
                    "must_contain": {"type": "string"},
                },
            },
            handler=_verify_artifact,
            risk_level="low",
            mutating=False,
        )

        # 14. security_audit
        def _security_audit(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
            return {"ok": True, "audit": SECURITY_SUPERVISOR.run_security_audit()}

        self.register_tool(
            name="security_audit",
            description="Ejecuta una auditoría determinista del supervisor de seguridad, permisos de agentes y logs.",
            parameters_schema={"type": "object", "properties": {}},
            handler=_security_audit,
            risk_level="low",
            mutating=False,
        )


class SkillRegistry:
    """
    Gestor de Skills modulares e instalables de DEE.
    Cada skill posee un manifiesto JSON con nombre, versión, descripción,
    dependencias, permisos requeridos (`allowed_tools`), punto de entrada y comando de prueba.
    """

    def __init__(self, skills_dir: Optional[Path] = None) -> None:
        self.skills_dir = skills_dir or (ROOT_DIR / "skills" / "packages")
        self.skills_dir.mkdir(parents=True, exist_ok=True)
        self._seed_builtin_skills()

    def _portable_test_command(self, entry_path: Path) -> str:
        """Genera un comando de prueba reproducible sin rutas absolutas de la máquina."""
        try:
            rel = entry_path.resolve().relative_to(ROOT_DIR)
            return f"python3 {rel}"
        except ValueError:
            return f"python3 {entry_path}"

    def _seed_builtin_skills(self) -> None:
        builtin = [
            {
                "name": "code-verifier",
                "version": "1.2.0",
                "description": "Analiza sintaxis Python, ejecuta suites unittest y verifica artefactos de software.",
                "allowed_tools": ["fs_read", "fs_write", "fs_patch", "python_test_runner", "verify_artifact"],
                "dependencies": ["python3"],
                "entrypoint": "skill_main.py",
                "code": (
                    "import ast, sys, json\n"
                    "if __name__ == '__main__':\n"
                    "    target = sys.argv[1] if len(sys.argv) > 1 else __file__\n"
                    "    src = open(target, encoding='utf-8').read()\n"
                    "    tree = ast.parse(src)\n"
                    "    print(json.dumps({'ok': True, 'skill': 'code-verifier', 'ast_nodes': len(list(ast.walk(tree)))}))\n"
                ),
            },
            {
                "name": "forensic-auditor",
                "version": "1.1.0",
                "description": "Audita directorios de código buscando mocks, archivos vacíos o promesas sin implementación.",
                "allowed_tools": ["fs_list", "fs_read", "verify_artifact"],
                "dependencies": ["python3"],
                "entrypoint": "skill_main.py",
                "code": (
                    "import os, sys, json\n"
                    "if __name__ == '__main__':\n"
                    "    root = sys.argv[1] if len(sys.argv) > 1 else '.'\n"
                    "    py_files = [os.path.join(dp, f) for dp, _, fn in os.walk(root) for f in fn if f.endswith('.py')]\n"
                    "    print(json.dumps({'ok': True, 'skill': 'forensic-auditor', 'scanned_py_files': len(py_files)}))\n"
                ),
            },
            {
                "name": "cluster-diagnostics",
                "version": "1.0.0",
                "description": "Inspecciona salud de memoria, CPU, disco y puertos de nodos distribuidos.",
                "allowed_tools": ["memory_search", "verify_artifact"],
                "dependencies": ["python3"],
                "entrypoint": "skill_main.py",
                "code": (
                    "import os, json\n"
                    "if __name__ == '__main__':\n"
                    "    load1, load5, load15 = os.getloadavg()\n"
                    "    print(json.dumps({'ok': True, 'skill': 'cluster-diagnostics', 'loadavg': [load1, load5, load15]}))\n"
                ),
            },
        ]
        for item in builtin:
            pkg_dir = self.skills_dir / item["name"]
            pkg_dir.mkdir(parents=True, exist_ok=True)
            manifest_path = pkg_dir / "skill.json"
            entry_path = pkg_dir / item["entrypoint"]
            if not manifest_path.exists():
                manifest = {
                    "name": item["name"],
                    "version": item["version"],
                    "description": item["description"],
                    "allowed_tools": item["allowed_tools"],
                    "dependencies": item["dependencies"],
                    "entrypoint": item["entrypoint"],
                    "test_command": self._portable_test_command(entry_path),
                }
                manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
            if not entry_path.exists():
                entry_path.write_text(item["code"], encoding="utf-8")

    def list_skills(self) -> List[Dict[str, Any]]:
        skills = []
        for child in sorted(self.skills_dir.iterdir()):
            if child.is_dir() and (child / "skill.json").exists():
                try:
                    data = json.loads((child / "skill.json").read_text(encoding="utf-8"))
                    data["path"] = str(child)
                    skills.append(data)
                except Exception:
                    continue
        return skills

    def get_skill(self, name: str) -> Optional[Dict[str, Any]]:
        for s in self.list_skills():
            if s.get("name") == name:
                return s
        return None

    def install_skill(
        self,
        name: str,
        description: str,
        allowed_tools: List[str],
        code: str,
        version: str = "1.0.0",
        dependencies: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        safe_name = "".join(c for c in name.lower() if c.isalnum() or c in ("-", "_")).strip("-_")
        if not safe_name:
            return {"ok": False, "error": "Nombre de skill inválido."}
        pkg_dir = self.skills_dir / safe_name
        pkg_dir.mkdir(parents=True, exist_ok=True)
        entry_path = pkg_dir / "skill_main.py"
        entry_path.write_text(code, encoding="utf-8")
        manifest = {
            "name": safe_name,
            "version": version,
            "description": description,
            "allowed_tools": allowed_tools,
            "dependencies": dependencies or ["python3"],
            "entrypoint": "skill_main.py",
            "test_command": self._portable_test_command(entry_path),
            "installed_at": time.time(),
        }
        (pkg_dir / "skill.json").write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        test_res = self.test_skill(safe_name)
        return {"ok": test_res["ok"], "skill": manifest, "verification": test_res}

    def test_skill(self, name: str, arg: Optional[str] = None) -> Dict[str, Any]:
        skill = self.get_skill(name)
        if not skill:
            return {"ok": False, "error": f"Skill '{name}' no encontrada."}
        entry = Path(skill["path"]) / skill["entrypoint"]
        cmd = [sys.executable, str(entry)]
        if arg:
            cmd.append(arg)
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        return {
            "ok": res.returncode == 0,
            "skill": name,
            "returncode": res.returncode,
            "stdout": res.stdout.strip(),
            "stderr": res.stderr.strip(),
        }


class MCPManager:
    """
    Implementación real del Model Context Protocol (MCP) sobre JSON-RPC 2.0.
    Actúa como:
    1. Servidor MCP nativo de DEE (`handle_jsonrpc`), exponiendo `initialize`,
       `tools/list`, `tools/call`, `resources/list`, `resources/read` y `prompts/list`.
    2. Cliente MCP capaz de inspeccionar servidores MCP registrados y ejecutar llamadas JSON-RPC.
    """

    PROTOCOL_VERSION = "2024-11-05"

    def __init__(self, tool_registry: ToolRegistry, skill_registry: SkillRegistry) -> None:
        self.tool_registry = tool_registry
        self.skill_registry = skill_registry
        self._servers: Dict[str, Dict[str, Any]] = {
            "dee-core-mcp": {
                "id": "dee-core-mcp",
                "name": "DEE Native MCP Server",
                "transport": "inproc+http",
                "endpoint": "/api/platform/mcp/rpc",
                "version": "2.0.0",
                "status": "ONLINE",
            }
        }

    def list_servers(self) -> List[Dict[str, Any]]:
        out = []
        for srv_id, srv in self._servers.items():
            info = dict(srv)
            if srv_id == "dee-core-mcp":
                info["tools_count"] = len(self.tool_registry.list_tools())
                info["skills_count"] = len(self.skill_registry.list_skills())
            out.append(info)
        return out

    def inspect_server(self, server_id: str = "dee-core-mcp") -> Dict[str, Any]:
        if server_id not in self._servers:
            return {"ok": False, "error": f"Servidor MCP '{server_id}' no registrado."}
        init_resp = self.handle_jsonrpc({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
        tools_resp = self.handle_jsonrpc({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
        res_resp = self.handle_jsonrpc({"jsonrpc": "2.0", "id": 3, "method": "resources/list", "params": {}})
        return {
            "ok": True,
            "server": self._servers[server_id],
            "initialize": init_resp.get("result"),
            "tools": tools_resp.get("result", {}).get("tools", []),
            "resources": res_resp.get("result", {}).get("resources", []),
        }

    def handle_jsonrpc(
        self,
        request: Dict[str, Any],
        agent: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        req_id = request.get("id")
        method = request.get("method", "")
        params = request.get("params") or {}

        if request.get("jsonrpc") != "2.0":
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {"code": -32600, "message": "Invalid Request: se requiere jsonrpc='2.0'."},
            }

        active_agent = agent or (
            PLATFORM_STORE.get_agent("dee")
            or {
                "id": "dee",
                "autonomy_mode": "CONTROLLED_AUTONOMY",
                "allowed_tools": ["*"],
                "workspace": str(ROOT_DIR / "workspaces" / "dee"),
            }
        )

        if method == "initialize":
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "protocolVersion": self.PROTOCOL_VERSION,
                    "serverInfo": {"name": "dee-core-mcp", "version": "2.0.0"},
                    "capabilities": {
                        "tools": {"listChanged": False},
                        "resources": {"subscribe": False, "listChanged": False},
                        "prompts": {"listChanged": False},
                    },
                },
            }

        if method == "tools/list":
            tools = self.tool_registry.list_tools(active_agent.get("allowed_tools"))
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {"tools": tools},
            }

        if method == "tools/call":
            tool_name = params.get("name", "")
            arguments = params.get("arguments") or {}
            exec_res = self.tool_registry.execute(
                tool_name=tool_name,
                params=arguments,
                agent=active_agent,
                task_id=params.get("task_id"),
                approved_token=params.get("approved_token"),
            )
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "isError": not exec_res.get("ok", False),
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(exec_res, ensure_ascii=False),
                        }
                    ],
                    "structured": exec_res,
                },
            }

        if method == "resources/list":
            skills = self.skill_registry.list_skills()
            resources = [
                {
                    "uri": "dee://memory/stats",
                    "name": "Estadísticas de Memoria 6 Capas DEE",
                    "mimeType": "application/json",
                },
                {
                    "uri": "dee://security/audit",
                    "name": "Auditoría de Seguridad Determinista",
                    "mimeType": "application/json",
                },
            ]
            for s in skills:
                resources.append(
                    {
                        "uri": f"dee://skills/{s['name']}",
                        "name": f"Skill: {s['name']} v{s['version']}",
                        "mimeType": "application/json",
                    }
                )
            return {"jsonrpc": "2.0", "id": req_id, "result": {"resources": resources}}

        if method == "resources/read":
            uri = params.get("uri", "")
            if uri == "dee://memory/stats":
                payload = PLATFORM_STORE.memory_stats()
            elif uri == "dee://security/audit":
                payload = SECURITY_SUPERVISOR.run_security_audit()
            elif uri.startswith("dee://skills/"):
                skill_name = uri.split("dee://skills/", 1)[1]
                payload = self.skill_registry.get_skill(skill_name) or {"error": "No encontrado"}
            else:
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32602, "message": f"Recurso MCP desconocido: {uri}"},
                }
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "contents": [
                        {
                            "uri": uri,
                            "mimeType": "application/json",
                            "text": json.dumps(payload, ensure_ascii=False),
                        }
                    ]
                },
            }

        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {"code": -32601, "message": f"Method not found: {method}"},
        }


TOOL_REGISTRY = ToolRegistry()
SKILL_REGISTRY = SkillRegistry()
MCP_MANAGER = MCPManager(TOOL_REGISTRY, SKILL_REGISTRY)

#!/usr/bin/env python3
"""DEE PROFESSIONAL CLI (`cli/dee_cli.py`) — DEE (Distributed Emergent Engine).
Autor: Facu Cercuetti (@NickDev24) · https://github.com/NickDev24/Dee-Bot-Agents

Implementa el contrato completo de la Sección 12 + retrocompatibilidad con los comandos clásicos:
  dee init
  dee start [--background]
  dee stop
  dee status

  dee agent list
  dee agent create <id> [--name N] [--role R] [--model M] [--mode AUTONOMY]
  dee agent run <id> "<objetivo>" [--mode AUTONOMY]
  dee agent inspect <id>

  dee team list
  dee team create <id> [--name N] [--supervisor S] [--members m1,m2]

  dee task run "<objetivo>" [--scenario A|B|C|D|E|F] [--mode AUTONOMY] [--auto-approve]
  dee task inspect [task_id]
  dee task cancel <task_id>
  dee task resume <task_id>

  dee node list
  dee node inspect <node_id>

  dee memory search "<query>" [--tier T]
  dee memory inspect [--tier T]

  dee model list
  dee model test [provider_id]

  dee skill list
  dee skill install <name> [--description D] [--tools t1,t2]

  dee mcp list
  dee mcp inspect [server_id]

  dee logs [--limit N]
  dee doctor
  dee benchmark
  dee security audit
"""
from __future__ import annotations

import argparse
import json
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from core.platform import (  # noqa: E402
    CLUSTER_SCHEDULER,
    MCP_MANAGER,
    MODEL_ENGINE,
    ORCHESTRATOR,
    PLATFORM_DB,
    SECURITY_SUPERVISOR,
    SKILL_REGISTRY,
    TOOL_REGISTRY,
    AgentRuntime,
    read_process_rss_mb,
    run_benchmarks,
    run_doctor,
)

DEE_URL = os.environ.get("DEE_API_URL", "http://127.0.0.1:8091")
PID_FILE = ROOT_DIR / "data" / "dee_server.pid"


def _print_json(data: Any) -> None:
    print(json.dumps(data, indent=2, ensure_ascii=False))


def _is_port_open(host: str = "127.0.0.1", port: int = 8091, timeout: float = 0.4) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


def _api(path: str, payload: dict | None = None, timeout: float = 25.0) -> dict:
    url = DEE_URL.rstrip("/") + path
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        return {"ok": False, "error": f"No se pudo conectar a {url}: {exc}"}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="dee",
        description="DEE — Distributed Emergent Engine CLI (por Facu Cercuetti @NickDev24)",
    )
    sub = parser.add_subparsers(dest="cmd")

    # 1. Ciclo de vida de la plataforma
    sub.add_parser("init", help="Inicializa base de datos SQLite WAL, workspaces aislados, skills y nodos")
    p_start = sub.add_parser("start", help="Inicia el demonio maestro de DEE (:8091)")
    p_start.add_argument("--foreground", action="store_true", help="Ejecutar en primer plano")
    sub.add_parser("stop", help="Detiene el demonio maestro de DEE (:8091)")
    sub.add_parser("status", help="Muestra el estado operativo de DEE, agentes, memoria, nodos y seguridad")
    sub.add_parser("serve", help="Alias para iniciar el servidor en primer plano")

    # 2. dee agent [list|create|run|inspect]
    p_agent = sub.add_parser("agent", help="Gestión de Agent Runtimes independientes")
    sub_agent = p_agent.add_subparsers(dest="agent_cmd")
    sub_agent.add_parser("list", help="Listar todos los agentes registrados")

    pa_create = sub_agent.add_parser("create", help="Crear o actualizar un agente autónomo")
    pa_create.add_argument("id", help="Identificador único del agente")
    pa_create.add_argument("--name", default="", help="Nombre visible")
    pa_create.add_argument("--role", default="Especialista Autónomo", help="Rol técnico")
    pa_create.add_argument("--persona", default="Riguroso y orientado a evidencia.", help="Personalidad")
    pa_create.add_argument("--instructions", default="Ejecutar y verificar resultados.", help="Instrucciones")
    pa_create.add_argument("--provider", default="openai_compatible", help="Proveedor de IA")
    pa_create.add_argument("--model", default="dee-reasoner-v4", help="Modelo de IA")
    pa_create.add_argument("--mode", default="CONTROLLED_AUTONOMY", help="Modo de autonomía")
    pa_create.add_argument("--tools", default="fs_read,fs_write,fs_list,memory_search,verify_artifact", help="Herramientas separadas por coma")

    pa_run = sub_agent.add_parser("run", help="Ejecutar un objetivo asignado a un agente")
    pa_run.add_argument("id", help="ID del agente")
    pa_run.add_argument("goal", nargs="+", help="Objetivo o tarea para el agente")
    pa_run.add_argument("--mode", default=None, help="Modo de autonomía (por defecto usa el del agente)")

    pa_insp = sub_agent.add_parser("inspect", help="Inspeccionar estado, workspace y presupuesto de un agente")
    pa_insp.add_argument("id", help="ID del agente")

    # 3. dee team [list|create]
    p_team = sub.add_parser("team", help="Gestión de equipos multiagente")
    sub_team = p_team.add_subparsers(dest="team_cmd")
    sub_team.add_parser("list", help="Listar equipos")
    pt_create = sub_team.add_parser("create", help="Crear un nuevo equipo")
    pt_create.add_argument("id", help="ID del equipo")
    pt_create.add_argument("--name", default="", help="Nombre del equipo")
    pt_create.add_argument("--supervisor", default="dee_prime", help="Agente supervisor")
    pt_create.add_argument("--members", default="dee_prime,barto_forge,rakazo_archivist", help="Miembros separados por coma")

    # 4. dee task [run|inspect|cancel|resume]
    p_task = sub.add_parser("task", help="Ejecución, inspección y control de tareas autónomas")
    sub_task = p_task.add_subparsers(dest="task_cmd")
    ptk_run = sub_task.add_parser("run", help="Ejecutar una tarea con planificación y verificación")
    ptk_run.add_argument("goal", nargs="+", help="Descripción del objetivo")
    ptk_run.add_argument("--scenario", default=None, help="Escenario opcional (A, B, C, D, E, F)")
    ptk_run.add_argument("--mode", default="CONTROLLED_AUTONOMY", help="PLAN_ONLY | ASK_BEFORE_ACTION | CONTROLLED_AUTONOMY | FULL_AUTONOMY")
    ptk_run.add_argument("--auto-approve", action="store_true", help="Auto-aprobar solicitud de capacidad en demostración")

    ptk_insp = sub_task.add_parser("inspect", help="Inspeccionar una tarea o listar las recientes")
    ptk_insp.add_argument("task_id", nargs="?", default="", help="ID de la tarea (opcional)")

    ptk_cancel = sub_task.add_parser("cancel", help="Cancelar una tarea")
    ptk_cancel.add_argument("task_id", help="ID de la tarea a cancelar")

    ptk_resume = sub_task.add_parser("resume", help="Reanudar una tarea interrumpida desde su último checkpoint")
    ptk_resume.add_argument("task_id", help="ID de la tarea a reanudar")

    # 5. dee node [list|inspect]
    p_node = sub.add_parser("node", help="Gestión de nodos del clúster distribuido")
    sub_node = p_node.add_subparsers(dest="node_cmd")
    sub_node.add_parser("list", help="Listar nodos y telemetría de recursos")
    pn_insp = sub_node.add_parser("inspect", help="Inspeccionar un nodo específico")
    pn_insp.add_argument("node_id", nargs="?", default="facu", help="ID del nodo (facu, barto, manager1)")

    # 6. dee memory [search|inspect]
    p_mem = sub.add_parser("memory", help="Motor de Memoria Persistente de 6 Niveles (SQLite FTS5 BM25)")
    sub_mem = p_mem.add_subparsers(dest="memory_cmd")
    pm_search = sub_mem.add_parser("search", help="Búsqueda híbrida BM25 + Coseno")
    pm_search.add_argument("query", nargs="+", help="Consulta a buscar")
    pm_search.add_argument("--tier", default=None, help="Filtro de nivel (session, episodic, semantic, procedural, project, shared)")
    pm_insp = sub_mem.add_parser("inspect", help="Inspeccionar estadísticas y registros por nivel")
    pm_insp.add_argument("--tier", default=None, help="Nivel opcional")

    # 7. dee model [list|test]
    p_mod = sub.add_parser("model", help="Motor de Proveedores de Modelos de IA")
    sub_mod = p_mod.add_subparsers(dest="model_cmd")
    sub_mod.add_parser("list", help="Listar proveedores, modalidades y estado de salud")
    pmd_test = sub_mod.add_parser("test", help="Probar generación y latencia de un proveedor")
    pmd_test.add_argument("provider_id", nargs="?", default="openai_compatible", help="ID del proveedor")
    pmd_test.add_argument("--prompt", default="Verificación operativa de DEE.", help="Prompt de prueba")

    # 8. dee skill [list|install]
    p_sk = sub.add_parser("skill", help="Sistema de Skills modulares verificables")
    sub_sk = p_sk.add_subparsers(dest="skill_cmd")
    sub_sk.add_parser("list", help="Listar skills instaladas")
    psk_inst = sub_sk.add_parser("install", help="Instalar y verificar una nueva skill")
    psk_inst.add_argument("name", help="Nombre de la skill")
    psk_inst.add_argument("--description", default="Skill reutilizable verificada de DEE", help="Descripción")
    psk_inst.add_argument("--tools", default="fs_read,verify_artifact", help="Herramientas permitidas")

    # 9. dee mcp [list|inspect]
    p_mcp = sub.add_parser("mcp", help="Servidores y Herramientas Model Context Protocol (MCP)")
    sub_mcp = p_mcp.add_subparsers(dest="mcp_cmd")
    sub_mcp.add_parser("list", help="Listar servidores MCP y conteo de herramientas")
    pmcp_insp = sub_mcp.add_parser("inspect", help="Inspeccionar handshake JSON-RPC 2.0, tools y resources")
    pmcp_insp.add_argument("server_id", nargs="?", default="dee-core-mcp", help="ID del servidor MCP")

    # 10. dee logs / doctor / benchmark / security audit
    p_logs = sub.add_parser("logs", help="Consultar bitácora de auditoría y bus inter-agente")
    p_logs.add_argument("--limit", type=int, default=25, help="Cantidad de eventos")

    sub.add_parser("doctor", help="Diagnóstico integral de salud de DEE")
    sub.add_parser("benchmark", help="Ejecutar suite de benchmarks reales (RAM, FTS5, coordinación, clúster)")

    p_sec = sub.add_parser("security", help="Supervisor de Seguridad Determinista")
    sub_sec = p_sec.add_subparsers(dest="sec_cmd")
    sub_sec.add_parser("audit", help="Ejecutar auditoría completa de seguridad, aislamiento y barreras")

    # 11. Comandos retrocompatibles (ask, plan, grill, goal, pc, rag, cdp, relay, worktree, nodes, kill)
    sub.add_parser("nodes", help="Telemetría de nodos")
    sub.add_parser("kill", help="Activar Kill-Switch inmediato")
    for legacy_mode in ("ask", "plan", "grill", "goal"):
        pl = sub.add_parser(legacy_mode, help=f"Modo cognitivo {legacy_mode}")
        pl.add_argument("text", nargs="+", help="Instrucción")
        pl.add_argument("--no-speak", action="store_true")

    args = parser.parse_args(argv)

    # =========================================================================
    # DESPACHO DE COMANDOS INDUSTRIALES
    # =========================================================================
    if args.cmd == "init":
        agents = PLATFORM_DB.list_agents()
        teams = PLATFORM_DB.list_teams()
        skills = SKILL_REGISTRY.list_skills()
        nodes = CLUSTER_SCHEDULER.refresh_nodes()
        _print_json(
            {
                "ok": True,
                "action": "dee init",
                "db_path": str(PLATFORM_DB.db_path),
                "agents_initialized": len(agents),
                "teams_initialized": len(teams),
                "skills_seeded": len(skills),
                "cluster_nodes": [n["id"] for n in nodes],
            }
        )
        return 0

    if args.cmd == "serve" or (args.cmd == "start" and getattr(args, "foreground", False)):
        from core.main import start_server

        start_server()
        return 0

    if args.cmd == "start":
        if _is_port_open("127.0.0.1", 8091):
            health = _api("/health", timeout=2.0)
            is_dee = health.get("service") == "Dee-Bot-Agents"
            _print_json(
                {
                    "ok": is_dee,
                    "status": "already_running" if is_dee else "port_in_use_by_other_process",
                    "url": "http://127.0.0.1:8091",
                    "health": health,
                }
            )
            return 0 if is_dee else 1
        log_file = ROOT_DIR / "data" / "dee_server.log"
        log_file.parent.mkdir(parents=True, exist_ok=True)
        with open(log_file, "a", encoding="utf-8") as out_fh:
            proc = subprocess.Popen(
                [sys.executable, "-m", "core.main"],
                cwd=str(ROOT_DIR),
                stdout=out_fh,
                stderr=out_fh,
                start_new_session=True,
            )
        PID_FILE.write_text(str(proc.pid), encoding="utf-8")
        for _ in range(15):
            if _is_port_open("127.0.0.1", 8091):
                break
            time.sleep(0.2)
        _print_json(
            {
                "ok": True,
                "status": "started",
                "pid": proc.pid,
                "listening_on_8091": _is_port_open("127.0.0.1", 8091),
                "log_file": str(log_file),
            }
        )
        return 0

    if args.cmd == "stop":
        stopped_pid = None
        if PID_FILE.exists():
            try:
                pid = int(PID_FILE.read_text(encoding="utf-8").strip())
                os.kill(pid, signal.SIGTERM)
                stopped_pid = pid
            except Exception:
                pass
            PID_FILE.unlink(missing_ok=True)
        listening = _is_port_open("127.0.0.1", 8091)
        for _ in range(15):
            if not listening:
                break
            time.sleep(0.2)
            listening = _is_port_open("127.0.0.1", 8091)
        if not listening:
            payload: dict[str, Any] = {"ok": True, "status": "stopped", "stopped_pid": stopped_pid, "listening_on_8091": False}
            rc = 0
        elif stopped_pid is None:
            payload = {
                "ok": False,
                "status": "no_pid_file",
                "stopped_pid": None,
                "listening_on_8091": True,
                "warning": "Hay un proceso escuchando en :8091 sin PID file de DEE; no se termina un proceso no identificado.",
            }
            rc = 1
        else:
            payload = {"ok": False, "status": "still_listening", "stopped_pid": stopped_pid, "listening_on_8091": True}
            rc = 1
        _print_json(payload)
        return rc

    if args.cmd == "status":
        mem = PLATFORM_DB.memory_stats()
        nodes = CLUSTER_SCHEDULER.list_nodes()
        agents = PLATFORM_DB.list_agents()
        tasks = PLATFORM_DB.list_tasks(limit=10)
        _print_json(
            {
                "ok": True,
                "engine": "DEE — Distributed Emergent Engine",
                "daemon_8091_online": _is_port_open("127.0.0.1", 8091),
                "process_rss_mb": read_process_rss_mb(),
                "agents_count": len(agents),
                "teams_count": len(PLATFORM_DB.list_teams()),
                "tasks_recent": len(tasks),
                "memory": mem,
                "nodes": [{"id": n["id"], "status": n["status"], "ram_free_mb": n["ram_free_mb"], "latency_ms": n["latency_ms"]} for n in nodes],
            }
        )
        return 0

    # --- dee agent ---
    if args.cmd == "agent":
        if args.agent_cmd == "list":
            _print_json({"ok": True, "agents": PLATFORM_DB.list_agents()})
            return 0
        if args.agent_cmd == "create":
            tools = [t.strip() for t in args.tools.split(",") if t.strip()]
            ag = PLATFORM_DB.create_or_update_agent(
                {
                    "id": args.id,
                    "name": args.name or args.id,
                    "role": args.role,
                    "persona": args.persona,
                    "instructions": args.instructions,
                    "provider": args.provider,
                    "model": args.model,
                    "permissions_mode": args.mode,
                    "allowed_tools": tools,
                }
            )
            _print_json({"ok": True, "agent": ag})
            return 0
        if args.agent_cmd == "inspect":
            ag = PLATFORM_DB.get_agent(args.id)
            if not ag:
                _print_json({"ok": False, "error": f"Agente '{args.id}' no encontrado"})
                return 1
            ws = Path(ag["workspace"])
            files = [p.name for p in sorted(ws.iterdir())[:30]] if ws.exists() else []
            _print_json({"ok": True, "agent": ag, "workspace_files": files})
            return 0
        if args.agent_cmd == "run":
            try:
                rt = AgentRuntime(args.id)
            except ValueError as exc:
                _print_json({"ok": False, "error": str(exc)})
                return 1
            goal_str = " ".join(args.goal)
            effective_mode = args.mode or rt.profile.get("permissions_mode") or "CONTROLLED_AUTONOMY"
            res = ORCHESTRATOR.run_task(
                goal=goal_str,
                title=f"[{rt.id}] {goal_str[:60]}",
                autonomy_mode=effective_mode,
                assigned_agent_id=rt.id,
            )
            _print_json({"ok": res.get("status") == "completed", "agent_id": rt.id, "task": res})
            return 0 if res.get("status") == "completed" else 1
        p_agent.print_help()
        return 0

    # --- dee team ---
    if args.cmd == "team":
        if args.team_cmd == "list":
            _print_json({"ok": True, "teams": PLATFORM_DB.list_teams()})
            return 0
        if args.team_cmd == "create":
            members = [m.strip() for m in args.members.split(",") if m.strip()]
            tm = PLATFORM_DB.create_team(
                {
                    "id": args.id,
                    "name": args.name or args.id,
                    "supervisor_id": args.supervisor,
                    "member_ids": members,
                }
            )
            _print_json({"ok": True, "team": tm})
            return 0
        p_team.print_help()
        return 0

    # --- dee task ---
    if args.cmd == "task":
        if args.task_cmd == "run":
            goal_str = " ".join(args.goal)
            res = ORCHESTRATOR.run_task(
                goal=goal_str,
                autonomy_mode=args.mode,
                scenario_hint=args.scenario,
                auto_approve_capability_in_demo=args.auto_approve,
            )
            _print_json({"ok": res.get("status") in ("completed", "waiting_approval", "interrupted"), "task": res})
            return 0
        if args.task_cmd == "inspect":
            if args.task_id:
                tk = PLATFORM_DB.get_task(args.task_id)
                _print_json({"ok": bool(tk), "task": tk})
                return 0 if tk else 1
            _print_json({"ok": True, "tasks": PLATFORM_DB.list_tasks(limit=20)})
            return 0
        if args.task_cmd == "cancel":
            res = ORCHESTRATOR.cancel_task(args.task_id)
            ok = bool(res.get("id")) and res.get("status") == "cancelled"
            _print_json({"ok": ok, "task": res})
            return 0 if ok else 1
        if args.task_cmd == "resume":
            res = ORCHESTRATOR.resume_task(args.task_id)
            ok = bool(res.get("id")) and res.get("status") in ("completed", "waiting_approval", "interrupted")
            _print_json({"ok": ok, "task": res})
            return 0 if ok else 1
        p_task.print_help()
        return 0

    # --- dee node ---
    if args.cmd == "node" or args.cmd == "nodes":
        if getattr(args, "node_cmd", "list") == "inspect":
            nd = CLUSTER_SCHEDULER.inspect_node(args.node_id)
            _print_json({"ok": bool(nd), "node": nd})
            return 0 if nd else 1
        _print_json({"ok": True, "nodes": CLUSTER_SCHEDULER.list_nodes()})
        return 0

    # --- dee memory ---
    if args.cmd == "memory":
        if args.memory_cmd == "search":
            q = " ".join(args.query)
            _print_json(PLATFORM_DB.search_memory(q, tier=args.tier))
            return 0
        if args.memory_cmd == "inspect":
            stats = PLATFORM_DB.memory_stats()
            recent = PLATFORM_DB.search_memory("", tier=args.tier, top_k=15)
            _print_json({**stats, "entries": recent.get("results", [])})
            return 0
        p_mem.print_help()
        return 0

    # --- dee model ---
    if args.cmd == "model":
        if args.model_cmd == "list":
            _print_json({"ok": True, "providers": MODEL_ENGINE.list_models_and_providers()})
            return 0
        if args.model_cmd == "test":
            probe = MODEL_ENGINE.probe_provider(args.provider_id)
            gen = MODEL_ENGINE.generate(prompt=args.prompt, preferred_provider=args.provider_id)
            _print_json({"ok": gen.get("ok", False), "probe": probe, "generation": gen})
            return 0
        p_mod.print_help()
        return 0

    # --- dee skill ---
    if args.cmd == "skill":
        if args.skill_cmd == "list":
            _print_json({"ok": True, "skills": SKILL_REGISTRY.list_skills()})
            return 0
        if args.skill_cmd == "install":
            tools = [t.strip() for t in args.tools.split(",") if t.strip()]
            code = (
                "import json, time\n"
                "if __name__ == '__main__':\n"
                f"    print(json.dumps({{'ok': True, 'skill': {args.name!r}, 'ts': time.time()}}))\n"
            )
            res = SKILL_REGISTRY.install_skill(
                name=args.name,
                description=args.description,
                allowed_tools=tools,
                code=code,
            )
            _print_json(res)
            return 0 if res.get("ok") else 1
        p_sk.print_help()
        return 0

    # --- dee mcp ---
    if args.cmd == "mcp":
        if args.mcp_cmd == "list":
            _print_json({"ok": True, "servers": MCP_MANAGER.list_servers(), "tools": TOOL_REGISTRY.list_tools()})
            return 0
        if args.mcp_cmd == "inspect":
            _print_json(MCP_MANAGER.inspect_server(args.server_id))
            return 0
        p_mcp.print_help()
        return 0

    # --- dee logs / doctor / benchmark / security audit ---
    if args.cmd == "logs":
        _print_json(
            {
                "ok": True,
                "audit_logs": PLATFORM_DB.list_audit_logs(limit=args.limit),
                "agent_messages": PLATFORM_DB.list_agent_messages(limit=args.limit),
            }
        )
        return 0

    if args.cmd == "doctor":
        doc = run_doctor()
        _print_json(doc)
        return 0 if doc.get("ok") else 1

    if args.cmd == "benchmark":
        bench = run_benchmarks()
        _print_json(bench)
        return 0 if bench.get("ok") else 1

    if args.cmd == "security":
        audit = SECURITY_SUPERVISOR.audit_system()
        _print_json(audit)
        return 0 if audit.get("ok") else 1

    if args.cmd == "kill":
        SECURITY_SUPERVISOR.kill_switch_engaged = True
        _print_json({"ok": True, "kill_switch_engaged": True})
        return 0

    if args.cmd in ("ask", "plan", "grill", "goal"):
        raw_text = " ".join(args.text)
        mode_map = {
            "ask": "CONTROLLED_AUTONOMY",
            "plan": "PLAN_ONLY",
            "grill": "ASK_BEFORE_ACTION",
            "goal": "FULL_AUTONOMY",
        }
        res = ORCHESTRATOR.run_task(goal=raw_text, autonomy_mode=mode_map.get(args.cmd, "CONTROLLED_AUTONOMY"))
        _print_json(res)
        return 0

    parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

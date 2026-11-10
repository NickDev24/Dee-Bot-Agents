"""DEE DOCTOR & REAL PERFORMANCE BENCHMARK ENGINE (`core/platform/benchmark.py`).
Autor: Facu Cercuetti (@NickDev24)

Implementa el diagnóstico integral del sistema (`dee doctor`) y la suite de benchmarks empíricos
reproducibles (`dee benchmark`) exigidos en las Secciones 12 y 13:
- RAM RSS en reposo (`/proc/self/status`).
- RAM RSS con tareas multiagente activas y delta de memoria.
- Uso de CPU y carga del sistema (`os.getloadavg`).
- Tiempo de arranque e inicialización de módulos core.
- Latencia de herramientas (`ToolRegistry.execute`).
- Latencia de búsqueda híbrida en memoria de 6 niveles (SQLite FTS5 BM25 + Coseno).
- Latencia de coordinación multiagente (`AgentBus` + `MultiAgentOrchestrator`).
- Latencia de recuperación de tareas tras reinicio (`Scenario E`).
- Escalabilidad paralela por nodos (`facu`, `barto`, `manager1`).
"""
from __future__ import annotations

import json
import os
import resource
import shutil
import sqlite3
import time
from pathlib import Path
from typing import Any

from core.platform.cluster_scheduler import CLUSTER_SCHEDULER
from core.platform.models import MODEL_ENGINE
from core.platform.orchestrator import ORCHESTRATOR
from core.platform.security import SECURITY_SUPERVISOR
from core.platform.storage import PLATFORM_DB, ROOT_DIR
from core.platform.tools_mcp import MCP_MANAGER, SKILL_REGISTRY, TOOL_REGISTRY


def read_process_rss_mb() -> float:
    """Lee el consumo real de RAM RSS del proceso actual desde /proc/self/status o resource."""
    try:
        with open("/proc/self/status", "r", encoding="utf-8") as fh:
            for line in fh:
                if line.startswith("VmRSS:"):
                    kb = int(line.split()[1])
                    return round(kb / 1024.0, 2)
    except Exception:
        pass
    ru = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return round(ru / 1024.0, 2)


def run_doctor() -> dict[str, Any]:
    """Ejecuta un chequeo real de salud sobre todos los subsistemas de DEE."""
    t0 = time.perf_counter()
    checks: dict[str, dict[str, Any]] = {}

    # 1. SQLite WAL + FTS5
    try:
        stats = PLATFORM_DB.memory_stats()
        checks["sqlite_wal_fts5"] = {
            "ok": bool(stats.get("ok")),
            "sqlite_version": sqlite3.sqlite_version,
            "db_path": stats.get("db_path"),
            "total_memories": stats.get("total_memories", 0),
        }
    except Exception as exc:
        checks["sqlite_wal_fts5"] = {"ok": False, "error": str(exc)}

    # 2. Agent Runtimes & Workspaces
    agents = PLATFORM_DB.list_agents()
    ws_ok = all(Path(a["workspace"]).exists() for a in agents)
    checks["agent_runtimes"] = {
        "ok": len(agents) >= 6 and ws_ok,
        "count": len(agents),
        "workspaces_isolated": ws_ok,
        "agents": [a["id"] for a in agents],
    }

    # 3. Security Supervisor
    sec = SECURITY_SUPERVISOR.audit_system()
    checks["security_supervisor"] = {
        "ok": bool(sec.get("ok")),
        "checks": sec.get("checks", {}),
    }

    # 4. Tool Engine, Skills & MCP JSON-RPC 2.0
    mcp_info = MCP_MANAGER.inspect_server("dee-core-mcp")
    checks["tools_and_mcp"] = {
        "ok": bool(mcp_info.get("ok")),
        "registered_tools": len(TOOL_REGISTRY.list_tools()),
        "installed_skills": len(SKILL_REGISTRY.list_skills()),
        "mcp_protocol_version": mcp_info.get("initialize", {}).get("protocolVersion"),
    }

    # 5. Cluster Nodes
    nodes = CLUSTER_SCHEDULER.refresh_nodes()
    checks["cluster_nodes"] = {
        "ok": len(nodes) >= 1,
        "nodes": [{"id": n["id"], "status": n["status"], "latency_ms": n["latency_ms"]} for n in nodes],
    }

    # 6. Model Providers
    provs = MODEL_ENGINE.list_models_and_providers()
    ready_provs = [p["id"] for p in provs if p.get("ready")]
    unconfigured_provs = [p["id"] for p in provs if p.get("requires_api_key") and not p.get("configured")]
    unreachable_provs = [
        p["id"] for p in provs if p["id"] not in ready_provs and p["id"] not in unconfigured_provs
    ]
    checks["model_providers"] = {
        "ok": len(ready_provs) >= 1,
        "ready_providers": ready_provs,
        "unconfigured_providers": unconfigured_provs,
        "unreachable_providers": unreachable_provs,
        "total_providers": len(provs),
    }

    # 7. Entorno Linux / X11 / Binarios
    checks["host_environment"] = {
        "ok": True,
        "display": os.environ.get("DISPLAY", ":0"),
        "ffmpeg_installed": shutil.which("ffmpeg") is not None,
        "git_installed": shutil.which("git") is not None,
        "rss_ram_mb": read_process_rss_mb(),
    }

    overall_ok = all(c.get("ok", False) for c in checks.values())
    return {
        "ok": overall_ok,
        "engine": "DEE — Distributed Emergent Engine",
        "elapsed_ms": round((time.perf_counter() - t0) * 1000.0, 2),
        "checks": checks,
    }


def run_benchmarks() -> dict[str, Any]:
    """Mide empíricamente el rendimiento real de DEE sin inventar cifras preestablecidas."""
    t_boot0 = time.perf_counter()
    ram_idle_mb = read_process_rss_mb()
    load_1m, load_5m, load_15m = os.getloadavg() if hasattr(os, "getloadavg") else (0.0, 0.0, 0.0)

    # 1. Tiempo de inicialización de DB y verificación de esquema
    _ = PLATFORM_DB.list_agents()
    startup_ms = round((time.perf_counter() - t_boot0) * 1000.0, 3)

    # 2. Latencia de memoria híbrida 6 niveles (store + FTS5 BM25 search)
    t_mem0 = time.perf_counter()
    PLATFORM_DB.store_memory(
        content="Benchmark empírico de búsqueda híbrida SQLite WAL FTS5 BM25 en DEE.",
        title="Benchmark FTS5 DEE",
        tier="semantic",
        namespace="benchmark",
        tags=["benchmark", "fts5"],
    )
    search_res = PLATFORM_DB.search_memory("búsqueda híbrida SQLite WAL FTS5", tier="semantic")
    memory_roundtrip_ms = round((time.perf_counter() - t_mem0) * 1000.0, 3)

    # 3. Latencia de ejecución de herramienta vía ToolRegistry + SecuritySupervisor
    dee_agent = PLATFORM_DB.get_agent("dee_prime") or {}
    t_tool0 = time.perf_counter()
    tool_res = TOOL_REGISTRY.execute("fs_list", {"path": str(ROOT_DIR)}, agent=dee_agent)
    tool_latency_ms = round((time.perf_counter() - t_tool0) * 1000.0, 3)

    # 4. Latencia de coordinación multiagente (Escenario A)
    t_coord0 = time.perf_counter()
    task_a = ORCHESTRATOR.run_task(
        goal="Benchmark de coordinación multiagente y contraste de fuentes",
        scenario_hint="A",
    )
    coordination_latency_ms = round((time.perf_counter() - t_coord0) * 1000.0, 3)

    # 5. Latencia de recuperación de tarea tras interrupción (Escenario E)
    interrupted_task = ORCHESTRATOR.run_task(
        goal="Benchmark de recuperación post-caída con checkpoint en Etapa 2",
        scenario_hint="E",
        simulate_interrupt_after_step=2,
    )
    t_rec0 = time.perf_counter()
    recovered_task = ORCHESTRATOR.resume_task(interrupted_task["id"])
    recovery_latency_ms = round((time.perf_counter() - t_rec0) * 1000.0, 3)

    # 6. Escalabilidad paralela en los 3 nodos del clúster (Escenario D)
    t_dist0 = time.perf_counter()
    task_d = ORCHESTRATOR.run_task(
        goal="Benchmark de ejecución distribuida en 3 nodos (facu, barto, manager1)",
        scenario_hint="D",
    )
    cluster_3nodes_latency_ms = round((time.perf_counter() - t_dist0) * 1000.0, 3)

    ram_active_mb = read_process_rss_mb()
    tokens_total = sum(int(a.get("tokens_used", 0)) for a in PLATFORM_DB.list_agents())

    report = {
        "ok": bool(
            tool_res.get("ok")
            and task_a.get("status") == "completed"
            and recovered_task.get("status") == "completed"
            and task_d.get("status") == "completed"
        ),
        "timestamp": time.time(),
        "hardware": {
            "cpu_cores": os.cpu_count() or 2,
            "loadavg": [round(load_1m, 2), round(load_5m, 2), round(load_15m, 2)],
            "gpu_required": False,
        },
        "metrics": {
            "ram_idle_rss_mb": ram_idle_mb,
            "ram_active_rss_mb": ram_active_mb,
            "ram_delta_mb": round(max(0.0, ram_active_mb - ram_idle_mb), 2),
            "startup_init_ms": startup_ms,
            "memory_hybrid_roundtrip_ms": memory_roundtrip_ms,
            "fts5_query_internal_ms": search_res.get("latency_ms", 0.0),
            "tool_execution_latency_ms": tool_latency_ms,
            "multiagent_coordination_ms": coordination_latency_ms,
            "crash_recovery_latency_ms": recovery_latency_ms,
            "cluster_3node_parallel_ms": cluster_3nodes_latency_ms,
            "total_tokens_consumed": tokens_total,
        },
    }

    bench_file = ROOT_DIR / "data" / "evidence" / "latest_benchmark.json"
    bench_file.parent.mkdir(parents=True, exist_ok=True)
    bench_file.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    report["artifact_path"] = str(bench_file)
    return report

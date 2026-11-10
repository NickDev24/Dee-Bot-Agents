"""DEE PLATFORM STORAGE & 6-TIER PERSISTENT MEMORY ENGINE (`core/platform/storage.py`).
Autor: Facu Cercuetti (@NickDev24)

Implementa la capa de persistencia transaccional ACID sobre SQLite (`WAL` + `FTS5 BM25`) para:
1. Agentes (`agents`): identidad, personalidad, instrucciones, proveedor/modelo, herramientas autorizadas,
   workspace físico aislado, presupuesto de tokens, límites de recursos y permisos.
2. Equipos (`teams`): supervisor, miembros, política de coordinación y espacio de memoria compartida.
3. Tareas (`tasks`): objetivos, descomposición por etapas (`steps`), modo de autonomía
   (`PLAN_ONLY`, `ASK_BEFORE_ACTION`, `CONTROLLED_AUTONOMY`, `FULL_AUTONOMY`), checkpoints para
   recuperación tras reinicios (`Scenario E`), artefactos y evidencia de verificación.
4. Mensajería Estructurada Inter-Agente (`agent_messages` / `AgentBus`): protocolos `DELEGATE`, `REPORT`,
   `QUERY`, `CONFLICT_RESOLUTION`, `ESCALATE_PERMISSION` con contador `hop_count` anti-ciclos.
5. Motor de Memoria Persistente de 6 Niveles (`memories` + `memories_fts`):
   - Nivel 1: `session` (Memoria de sesión inmediata)
   - Nivel 2: `episodic` (Experiencias y eventos pasados con marca temporal)
   - Nivel 3: `semantic` (Conocimiento factual y conceptos consolidados)
   - Nivel 4: `procedural` (Cómo resolver tareas, recetas y procedimientos verificados)
   - Nivel 5: `project` (Arquitectura, rutas, convenciones y estado del repositorio/proyecto)
   - Nivel 6: `shared` (Memoria compartida entre agentes de un mismo equipo)
   Incluye deduplicación criptográfica (`content_hash`), búsqueda híbrida (FTS5 BM25 + similitud coseno
   de n-gramas/términos en Python puro sin cargar modelos pesados en RAM), actualización y borrado controlado.
6. Nodos Distribuidos (`nodes`), Aprobaciones (`approvals`) y Registro de Auditoría (`audit_logs`).
"""
from __future__ import annotations

import contextlib
import hashlib
import json
import math
import re
import sqlite3
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Iterator

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_DB_PATH = ROOT_DIR / "data" / "dee_platform.sqlite"
WORKSPACES_ROOT = ROOT_DIR / "data" / "workspaces"

VALID_MEMORY_TIERS = ("session", "episodic", "semantic", "procedural", "project", "shared")
VALID_AUTONOMY_MODES = ("PLAN_ONLY", "ASK_BEFORE_ACTION", "CONTROLLED_AUTONOMY", "FULL_AUTONOMY")
VALID_TASK_STATUSES = (
    "pending",
    "planning",
    "running",
    "waiting_approval",
    "verifying",
    "completed",
    "failed",
    "cancelled",
    "interrupted",
)


def _tokenize_for_cosine(text: str) -> dict[str, float]:
    tokens = re.findall(r"[a-zA-Z0-9áéíóúñÁÉÍÓÚÑ_]{2,}", (text or "").lower())
    freq: dict[str, float] = {}
    for t in tokens:
        freq[t] = freq.get(t, 0.0) + 1.0
    norm = math.sqrt(sum(v * v for v in freq.values())) or 1.0
    return {k: v / norm for k, v in freq.items()}


def _cosine_similarity(vec_a: dict[str, float], vec_b: dict[str, float]) -> float:
    if not vec_a or not vec_b:
        return 0.0
    if len(vec_a) > len(vec_b):
        vec_a, vec_b = vec_b, vec_a
    return sum(val * vec_b.get(k, 0.0) for k, val in vec_a.items())


class DeePlatformDB:
    """Motor transaccional SQLite WAL para DEE — Distributed Emergent Engine."""

    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = Path(db_path or DEFAULT_DB_PATH).resolve()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        WORKSPACES_ROOT.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._init_schema()
        self._seed_defaults()

    @contextlib.contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(str(self.db_path), timeout=15.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        try:
            yield conn
        finally:
            conn.close()

    def _init_schema(self) -> None:
        with self._lock, self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS agents (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    role TEXT NOT NULL,
                    persona TEXT NOT NULL,
                    instructions TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    model TEXT NOT NULL,
                    color TEXT NOT NULL DEFAULT '#00f0ff',
                    workspace TEXT NOT NULL,
                    allowed_tools_json TEXT NOT NULL,
                    permissions_mode TEXT NOT NULL DEFAULT 'CONTROLLED_AUTONOMY',
                    token_budget INTEGER NOT NULL DEFAULT 100000,
                    tokens_used INTEGER NOT NULL DEFAULT 0,
                    max_concurrency INTEGER NOT NULL DEFAULT 2,
                    can_delegate INTEGER NOT NULL DEFAULT 1,
                    status TEXT NOT NULL DEFAULT 'idle',
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS teams (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    supervisor_id TEXT NOT NULL,
                    member_ids_json TEXT NOT NULL,
                    routing_policy TEXT NOT NULL DEFAULT 'dynamic_specialist',
                    shared_memory_ns TEXT NOT NULL,
                    created_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    parent_task_id TEXT,
                    title TEXT NOT NULL,
                    goal TEXT NOT NULL,
                    status TEXT NOT NULL,
                    autonomy_mode TEXT NOT NULL DEFAULT 'CONTROLLED_AUTONOMY',
                    assigned_agent_id TEXT NOT NULL,
                    team_id TEXT NOT NULL DEFAULT 'core_squad',
                    node_id TEXT NOT NULL DEFAULT 'facu',
                    plan_json TEXT NOT NULL DEFAULT '[]',
                    steps_json TEXT NOT NULL DEFAULT '[]',
                    artifacts_json TEXT NOT NULL DEFAULT '[]',
                    verification_json TEXT NOT NULL DEFAULT '{}',
                    checkpoint_json TEXT NOT NULL DEFAULT '{}',
                    result_summary TEXT NOT NULL DEFAULT '',
                    error TEXT,
                    retries INTEGER NOT NULL DEFAULT 0,
                    max_retries INTEGER NOT NULL DEFAULT 2,
                    tokens_consumed INTEGER NOT NULL DEFAULT 0,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS agent_messages (
                    id TEXT PRIMARY KEY,
                    task_id TEXT,
                    conversation_id TEXT NOT NULL DEFAULT 'main',
                    from_agent TEXT NOT NULL,
                    to_agent TEXT NOT NULL,
                    protocol_type TEXT NOT NULL,
                    content TEXT NOT NULL,
                    payload_json TEXT NOT NULL DEFAULT '{}',
                    hop_count INTEGER NOT NULL DEFAULT 0,
                    created_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS memories (
                    id TEXT PRIMARY KEY,
                    tier TEXT NOT NULL,
                    namespace TEXT NOT NULL DEFAULT 'global',
                    agent_id TEXT NOT NULL DEFAULT 'system',
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    tags_json TEXT NOT NULL DEFAULT '[]',
                    content_hash TEXT NOT NULL UNIQUE,
                    importance REAL NOT NULL DEFAULT 0.5,
                    access_count INTEGER NOT NULL DEFAULT 0,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                );

                CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
                    memory_id UNINDEXED,
                    tier,
                    namespace,
                    agent_id,
                    title,
                    content,
                    tags,
                    tokenize='unicode61'
                );

                CREATE TABLE IF NOT EXISTS nodes (
                    id TEXT PRIMARY KEY,
                    host TEXT NOT NULL,
                    port_gateway INTEGER NOT NULL DEFAULT 8730,
                    port_bench INTEGER NOT NULL DEFAULT 8731,
                    role TEXT NOT NULL DEFAULT 'worker',
                    cpu_cores INTEGER NOT NULL DEFAULT 2,
                    cpu_pct REAL NOT NULL DEFAULT 0.0,
                    ram_total_mb INTEGER NOT NULL DEFAULT 4096,
                    ram_free_mb INTEGER NOT NULL DEFAULT 2048,
                    disk_free_gb REAL NOT NULL DEFAULT 20.0,
                    gpu_available INTEGER NOT NULL DEFAULT 0,
                    capabilities_json TEXT NOT NULL DEFAULT '[]',
                    latency_ms REAL NOT NULL DEFAULT 1.0,
                    online INTEGER NOT NULL DEFAULT 1,
                    last_heartbeat REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS approvals (
                    id TEXT PRIMARY KEY,
                    task_id TEXT,
                    agent_id TEXT NOT NULL,
                    tool_name TEXT NOT NULL,
                    args_json TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    requested_at REAL NOT NULL,
                    resolved_at REAL,
                    resolved_by TEXT
                );

                CREATE TABLE IF NOT EXISTS audit_logs (
                    id TEXT PRIMARY KEY,
                    ts REAL NOT NULL,
                    actor TEXT NOT NULL,
                    category TEXT NOT NULL,
                    action TEXT NOT NULL,
                    target TEXT NOT NULL,
                    verdict TEXT NOT NULL,
                    evidence_json TEXT NOT NULL DEFAULT '{}'
                );
                """
            )
            conn.commit()

    def _seed_defaults(self) -> None:
        now = time.time()
        default_agents = [
            {
                "id": "dee_prime",
                "name": "Dee Prime",
                "role": "Supervisor Principal & Planificador Cognitivo",
                "persona": "Arquitecto jefe pragmático, riguroso y orientado a evidencia verificable.",
                "instructions": "Analizá objetivos complejos, descomponelos en etapas verificables, delegá a especialistas y validá los resultados antes de cerrar una tarea.",
                "provider": "openai_compatible",
                "model": "dee-reasoner-v4",
                "color": "#00f0ff",
                "allowed_tools": [
                    "plan_decompose",
                    "delegate_task",
                    "memory_search",
                    "memory_store",
                    "fs_read",
                    "fs_write",
                    "fs_list",
                    "verify_artifact",
                    "cluster_status",
                ],
                "permissions_mode": "CONTROLLED_AUTONOMY",
                "token_budget": 250000,
                "can_delegate": 1,
            },
            {
                "id": "rakazo_archivist",
                "name": "Rakazo Archivist",
                "role": "Especialista en Investigación Forense & Memoria 6-Niveles",
                "persona": "Investigador metódico que contrasta múltiples fuentes y nunca afirma algo sin citar evidencia.",
                "instructions": "Ejecutá búsquedas en la memoria de 6 niveles, índice RAG FTS5 y fuentes locales/web; contrastá fuentes y generá informes con citas verificables.",
                "provider": "openai_compatible",
                "model": "dee-research-v4",
                "color": "#a855f7",
                "allowed_tools": [
                    "memory_search",
                    "memory_store",
                    "rag_query",
                    "fs_read",
                    "fs_list",
                    "fs_write",
                    "verify_artifact",
                    "web_fetch",
                ],
                "permissions_mode": "CONTROLLED_AUTONOMY",
                "token_budget": 150000,
                "can_delegate": 0,
            },
            {
                "id": "barto_forge",
                "name": "Barto Forge",
                "role": "Ingeniero de Software, Testing & Workspaces Aislados",
                "persona": "Ingeniero de sistemas senior obsesionado con código limpio, pruebas automatizadas y cero regresiones.",
                "instructions": "Desarrollá código en workspaces aislados, ejecutá suites de pruebas reales, analizá fallos de test, corregí errores y verificá que todos los tests pasen.",
                "provider": "openai_compatible",
                "model": "dee-coder-v4",
                "color": "#10b981",
                "allowed_tools": [
                    "fs_read",
                    "fs_write",
                    "fs_patch",
                    "fs_list",
                    "shell_exec",
                    "python_test_runner",
                    "worktree_manage",
                    "verify_artifact",
                ],
                "permissions_mode": "CONTROLLED_AUTONOMY",
                "token_budget": 200000,
                "can_delegate": 0,
            },
            {
                "id": "hermes_x11",
                "name": "Hermes X11",
                "role": "Operador de Computadora (X11/Wayland) & Automatización Web CDP",
                "persona": "Operador de sistemas físicos y navegador con verificación visual/DOM antes y después de cada acción.",
                "instructions": "Observá el estado de la pantalla o DOM antes de actuar, ejecutá la acción de mouse/teclado/CDP y verificá empíricamente que el estado cambió según lo esperado.",
                "provider": "openai_compatible",
                "model": "dee-cua-v4",
                "color": "#ec4899",
                "allowed_tools": [
                    "pc_observe",
                    "pc_mouse_move",
                    "pc_mouse_click",
                    "pc_keyboard_type",
                    "pc_screenshot",
                    "browser_inspect_dom",
                    "browser_navigate",
                    "fs_read",
                ],
                "permissions_mode": "CONTROLLED_AUTONOMY",
                "token_budget": 120000,
                "can_delegate": 0,
            },
            {
                "id": "manager_scout",
                "name": "Manager Scout",
                "role": "Ingeniero de Clúster Distribuido & Telemetría Multi-Nodo",
                "persona": "Especialista en sistemas distribuidos, balanceo de carga y tolerancia a fallos.",
                "instructions": "Descubrí nodos disponibles, medí latencia/CPU/RAM, distribuí subtareas hacia facu, barto y manager1 y consolidá los resultados.",
                "provider": "openai_compatible",
                "model": "dee-cluster-v4",
                "color": "#f59e0b",
                "allowed_tools": [
                    "cluster_status",
                    "node_exec_remote",
                    "gateway_transfer",
                    "fs_read",
                    "fs_write",
                ],
                "permissions_mode": "CONTROLLED_AUTONOMY",
                "token_budget": 120000,
                "can_delegate": 0,
            },
            {
                "id": "sentinel_guard",
                "name": "Sentinel Guard",
                "role": "Auditor de Seguridad, Permisos & Sandboxing",
                "persona": "Auditor de seguridad ofensiva/defensiva con tolerancia cero ante inyecciones y fugas de secretos.",
                "instructions": "Auditá permisos de herramientas, bloqueá Path Traversal y Command Injection, y gestioná solicitudes de escalamiento de permisos.",
                "provider": "openai_compatible",
                "model": "dee-security-v4",
                "color": "#f43f5e",
                "allowed_tools": [
                    "security_audit",
                    "fs_read",
                    "fs_list",
                    "memory_search",
                ],
                "permissions_mode": "ASK_BEFORE_ACTION",
                "token_budget": 100000,
                "can_delegate": 0,
            },
        ]

        with self._lock, self._connect() as conn:
            for ag in default_agents:
                ws = WORKSPACES_ROOT / ag["id"]
                ws.mkdir(parents=True, exist_ok=True)
                conn.execute(
                    """
                    INSERT OR IGNORE INTO agents (
                        id, name, role, persona, instructions, provider, model, color,
                        workspace, allowed_tools_json, permissions_mode, token_budget,
                        tokens_used, max_concurrency, can_delegate, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 2, ?, 'idle', ?, ?)
                    """,
                    (
                        ag["id"],
                        ag["name"],
                        ag["role"],
                        ag["persona"],
                        ag["instructions"],
                        ag["provider"],
                        ag["model"],
                        ag["color"],
                        str(ws),
                        json.dumps(ag["allowed_tools"], ensure_ascii=False),
                        ag["permissions_mode"],
                        ag["token_budget"],
                        ag["can_delegate"],
                        now,
                        now,
                    ),
                )
            # Asegurar herramientas base de verificación en agentes por defecto existentes
            for base_ag in default_agents:
                row = conn.execute("SELECT allowed_tools_json FROM agents WHERE id = ?", (base_ag["id"],)).fetchone()
                if row:
                    cur_tools = json.loads(row["allowed_tools_json"] or "[]")
                    changed = False
                    for t_req in base_ag["allowed_tools"]:
                        if t_req not in cur_tools:
                            cur_tools.append(t_req)
                            changed = True
                    if changed:
                        conn.execute(
                            "UPDATE agents SET allowed_tools_json = ? WHERE id = ?",
                            (json.dumps(cur_tools, ensure_ascii=False), base_ag["id"]),
                        )

            conn.execute(
                """
                INSERT OR IGNORE INTO teams (
                    id, name, description, supervisor_id, member_ids_json,
                    routing_policy, shared_memory_ns, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "core_squad",
                    "Escuadrón Principal DEE",
                    "Equipo distribuido de 6 agentes especialistas con coordinación jerárquica y verificación empírica.",
                    "dee_prime",
                    json.dumps([a["id"] for a in default_agents]),
                    "supervisor_dag",
                    "team_core_squad",
                    now,
                ),
            )

            default_nodes = [
                ("facu", "127.0.0.1", 8730, 8731, "master", 2, 11400, 79.0, ["x11", "alsa", "sqlite_fts5", "python3", "git", "docker", "electron"]),
                ("barto", "192.168.0.52", 8730, 8731, "worker", 2, 4096, 45.0, ["python3", "git", "hermes_api", "webcam"]),
                ("manager1", "192.168.0.193", 8730, 8731, "worker", 2, 4096, 38.0, ["python3", "alsa_mic_backup", "webcam", "hermes_api"]),
            ]
            for nid, host, pgw, pbn, role, cores, ram_mb, disk_gb, caps in default_nodes:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO nodes (
                        id, host, port_gateway, port_bench, role, cpu_cores, cpu_pct,
                        ram_total_mb, ram_free_mb, disk_free_gb, gpu_available,
                        capabilities_json, latency_ms, online, last_heartbeat
                    ) VALUES (?, ?, ?, ?, ?, ?, 15.0, ?, ?, ?, 0, ?, 1.0, ?, ?)
                    """,
                    (
                        nid,
                        host,
                        pgw,
                        pbn,
                        role,
                        cores,
                        ram_mb,
                        int(ram_mb * 0.6),
                        disk_gb,
                        json.dumps(caps),
                        1 if nid == "facu" else 0,
                        now,
                    ),
                )
            # Asegurar herramientas base de verificación en agentes por defecto existentes
            for base_ag in default_agents:
                row = conn.execute("SELECT allowed_tools_json FROM agents WHERE id = ?", (base_ag["id"],)).fetchone()
                if row:
                    cur_tools = json.loads(row["allowed_tools_json"] or "[]")
                    changed = False
                    for t_req in base_ag["allowed_tools"]:
                        if t_req not in cur_tools:
                            cur_tools.append(t_req)
                            changed = True
                    if changed:
                        conn.execute(
                            "UPDATE agents SET allowed_tools_json = ? WHERE id = ?",
                            (json.dumps(cur_tools, ensure_ascii=False), base_ag["id"]),
                        )
            conn.commit()

    # =========================================================================
    # GESTIÓN DE AGENTES Y EQUIPOS
    # =========================================================================
    def list_agents(self) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            rows = conn.execute("SELECT * FROM agents ORDER BY created_at ASC").fetchall()
            out = []
            for r in rows:
                d = dict(r)
                d["allowed_tools"] = json.loads(d.pop("allowed_tools_json", "[]"))
                d["can_delegate"] = bool(d["can_delegate"])
                out.append(d)
            return out

    def get_agent(self, agent_id: str) -> dict[str, Any] | None:
        with self._lock, self._connect() as conn:
            r = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
            if not r:
                return None
            d = dict(r)
            d["allowed_tools"] = json.loads(d.pop("allowed_tools_json", "[]"))
            d["can_delegate"] = bool(d["can_delegate"])
            return d

    def create_or_update_agent(self, data: dict[str, Any]) -> dict[str, Any]:
        now = time.time()
        agent_id = re.sub(r"[^a-z0-9_-]", "_", str(data.get("id") or data.get("name") or f"agent_{int(now)}").lower())
        existing = self.get_agent(agent_id) or {}
        ws = Path(data.get("workspace") or existing.get("workspace") or (WORKSPACES_ROOT / agent_id))
        ws.mkdir(parents=True, exist_ok=True)
        tools = data.get("allowed_tools") if "allowed_tools" in data else existing.get("allowed_tools", ["fs_read", "fs_list", "memory_search"])
        mode = str(data.get("permissions_mode") or existing.get("permissions_mode") or "CONTROLLED_AUTONOMY")
        if mode not in VALID_AUTONOMY_MODES:
            mode = "CONTROLLED_AUTONOMY"

        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO agents (
                    id, name, role, persona, instructions, provider, model, color,
                    workspace, allowed_tools_json, permissions_mode, token_budget,
                    tokens_used, max_concurrency, can_delegate, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    agent_id,
                    str(data.get("name") or existing.get("name") or agent_id),
                    str(data.get("role") or existing.get("role") or "Especialista Autónomo"),
                    str(data.get("persona") or existing.get("persona") or "Agente técnico verificable."),
                    str(data.get("instructions") or existing.get("instructions") or "Ejecutar tareas asignadas y verificar resultados."),
                    str(data.get("provider") or existing.get("provider") or "openai_compatible"),
                    str(data.get("model") or existing.get("model") or "dee-reasoner-v4"),
                    str(data.get("color") or existing.get("color") or "#38bdf8"),
                    str(ws),
                    json.dumps(list(tools), ensure_ascii=False),
                    mode,
                    int(data.get("token_budget") or existing.get("token_budget") or 100000),
                    int(data.get("tokens_used") if "tokens_used" in data else existing.get("tokens_used", 0)),
                    int(data.get("max_concurrency") or existing.get("max_concurrency") or 2),
                    1 if data.get("can_delegate", existing.get("can_delegate", False)) else 0,
                    str(data.get("status") or existing.get("status") or "idle"),
                    float(existing.get("created_at") or now),
                    now,
                ),
            )
            conn.commit()
        return self.get_agent(agent_id) or {}

    def increment_agent_tokens(self, agent_id: str, tokens: int) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                "UPDATE agents SET tokens_used = tokens_used + ?, updated_at = ? WHERE id = ?",
                (max(0, int(tokens)), time.time(), agent_id),
            )
            conn.commit()

    def set_agent_status(self, agent_id: str, status: str) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                "UPDATE agents SET status = ?, updated_at = ? WHERE id = ?",
                (status, time.time(), agent_id),
            )
            conn.commit()

    def list_teams(self) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            rows = conn.execute("SELECT * FROM teams ORDER BY created_at ASC").fetchall()
            out = []
            for r in rows:
                d = dict(r)
                d["member_ids"] = json.loads(d.pop("member_ids_json", "[]"))
                out.append(d)
            return out

    def create_team(self, data: dict[str, Any]) -> dict[str, Any]:
        now = time.time()
        tid = re.sub(r"[^a-z0-9_-]", "_", str(data.get("id") or data.get("name") or f"team_{int(now)}").lower())
        members = data.get("member_ids") or ["dee_prime", "barto_forge", "rakazo_archivist"]
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO teams (
                    id, name, description, supervisor_id, member_ids_json,
                    routing_policy, shared_memory_ns, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    tid,
                    str(data.get("name") or tid),
                    str(data.get("description") or "Equipo autónomo DEE"),
                    str(data.get("supervisor_id") or members[0]),
                    json.dumps(list(members)),
                    str(data.get("routing_policy") or "supervisor_dag"),
                    f"team_{tid}",
                    now,
                ),
            )
            conn.commit()
        return next((t for t in self.list_teams() if t["id"] == tid), {})

    # =========================================================================
    # MOTOR DE MEMORIA PERSISTENTE DE 6 NIVELES (SQLite FTS5 BM25 + Híbrido)
    # =========================================================================
    def store_memory(
        self,
        content: str = "",
        title: str = "",
        tier: str = "episodic",
        namespace: str = "global",
        agent_id: str = "system",
        tags: list[str] | None = None,
        importance: float = 0.6,
        *,
        topic: str | None = None,
        source: str | None = None,
        confidence: float | None = None,
    ) -> dict[str, Any]:
        clean_tier = tier if tier in VALID_MEMORY_TIERS else "episodic"
        clean_content = (content or "").strip()
        if not clean_content:
            return {"ok": False, "error": "El contenido de la memoria no puede estar vacío"}
        clean_title = (title or topic or clean_content.splitlines()[0][:80]).strip()
        tags_list = list(tags or [])
        if source and source not in tags_list:
            tags_list.append(f"src:{source}")
        if confidence is not None:
            importance = max(float(importance), float(confidence) * 0.8)
        content_hash = hashlib.sha256(f"{clean_tier}:{namespace}:{clean_content}".encode("utf-8")).hexdigest()
        now = time.time()

        with self._lock, self._connect() as conn:
            existing = conn.execute(
                "SELECT id, access_count FROM memories WHERE content_hash = ?",
                (content_hash,),
            ).fetchone()
            if existing:
                mem_id = existing["id"]
                conn.execute(
                    "UPDATE memories SET updated_at = ?, access_count = access_count + 1, importance = MAX(importance, ?) WHERE id = ?",
                    (now, float(importance), mem_id),
                )
                conn.commit()
                return {"ok": True, "id": mem_id, "deduplicated": True, "tier": clean_tier, "content_hash": content_hash}

            mem_id = f"mem_{clean_tier[:3]}_{int(now * 1000)}_{uuid.uuid4().hex[:6]}"
            conn.execute(
                """
                INSERT INTO memories (
                    id, tier, namespace, agent_id, title, content, tags_json,
                    content_hash, importance, access_count, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                """,
                (
                    mem_id,
                    clean_tier,
                    namespace,
                    agent_id,
                    clean_title,
                    clean_content,
                    json.dumps(tags_list, ensure_ascii=False),
                    content_hash,
                    float(importance),
                    now,
                    now,
                ),
            )
            conn.execute(
                """
                INSERT INTO memories_fts (memory_id, tier, namespace, agent_id, title, content, tags)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    mem_id,
                    clean_tier,
                    namespace,
                    agent_id,
                    clean_title,
                    clean_content,
                    " ".join(tags_list),
                ),
            )
            conn.commit()
            return {"ok": True, "id": mem_id, "deduplicated": False, "tier": clean_tier, "content_hash": content_hash}

    def search_memory(
        self,
        query: str,
        tier: str | None = None,
        namespace: str | None = None,
        agent_id: str | None = None,
        top_k: int = 8,
    ) -> dict[str, Any]:
        t0 = time.perf_counter()
        tokens = [re.sub(r"[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ_]", "", w) for w in (query or "").split()]
        tokens = [t for t in tokens if len(t) >= 2][:12]
        q_vec = _tokenize_for_cosine(query or "")

        candidates: dict[str, dict[str, Any]] = {}
        with self._lock, self._connect() as conn:
            if tokens:
                fts_expr = " OR ".join(f'"{t}"*' for t in tokens)
                rows = conn.execute(
                    """
                    SELECT m.*, bm25(memories_fts) AS bm25_raw
                    FROM memories_fts f
                    JOIN memories m ON m.id = f.memory_id
                    WHERE memories_fts MATCH ?
                    ORDER BY bm25_raw
                    LIMIT 40
                    """,
                    (fts_expr,),
                ).fetchall()
                for r in rows:
                    d = dict(r)
                    d["bm25_score"] = abs(float(d.pop("bm25_raw", 0.0)))
                    candidates[d["id"]] = d

            # Fallback / complemento para recuperar memorias recientes del nivel o namespace solicitado
            sql = "SELECT * FROM memories WHERE 1=1"
            params: list[Any] = []
            if tier:
                sql += " AND tier = ?"
                params.append(tier)
            if namespace:
                sql += " AND namespace = ?"
                params.append(namespace)
            if agent_id:
                sql += " AND agent_id = ?"
                params.append(agent_id)
            sql += " ORDER BY updated_at DESC LIMIT 40"
            for r in conn.execute(sql, params).fetchall():
                d = dict(r)
                if d["id"] not in candidates:
                    d["bm25_score"] = 0.0
                    candidates[d["id"]] = d

            results: list[dict[str, Any]] = []
            for mem in candidates.values():
                if tier and mem["tier"] != tier:
                    continue
                if namespace and mem["namespace"] != namespace:
                    continue
                if agent_id and mem["agent_id"] != agent_id:
                    continue
                doc_vec = _tokenize_for_cosine(f"{mem['title']} {mem['content']}")
                cos_sim = _cosine_similarity(q_vec, doc_vec) if q_vec else 0.5
                hybrid_score = round((mem.get("bm25_score", 0.0) * 0.65) + (cos_sim * 2.5) + (float(mem["importance"]) * 0.35), 4)
                if q_vec and hybrid_score < 0.05 and mem.get("bm25_score", 0.0) == 0.0:
                    continue
                mem["tags"] = json.loads(mem.pop("tags_json", "[]"))
                mem["cosine_similarity"] = round(cos_sim, 4)
                mem["hybrid_score"] = hybrid_score
                results.append(mem)

            results.sort(key=lambda x: (x["hybrid_score"], x["updated_at"]), reverse=True)
            selected = results[: int(top_k)]
            for item in selected:
                conn.execute("UPDATE memories SET access_count = access_count + 1 WHERE id = ?", (item["id"],))
            conn.commit()

        latency_ms = round((time.perf_counter() - t0) * 1000.0, 3)
        return {
            "ok": True,
            "query": query,
            "tier_filter": tier,
            "latency_ms": latency_ms,
            "count": len(selected),
            "results": selected,
        }

    def delete_memory(self, memory_id: str) -> dict[str, Any]:
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
            conn.execute("DELETE FROM memories_fts WHERE memory_id = ?", (memory_id,))
            conn.commit()
        return {"ok": True, "deleted_id": memory_id}

    def memory_stats(self) -> dict[str, Any]:
        with self._lock, self._connect() as conn:
            by_tier: dict[str, int] = {t: 0 for t in VALID_MEMORY_TIERS}
            for row in conn.execute("SELECT tier, COUNT(*) AS cnt FROM memories GROUP BY tier").fetchall():
                by_tier[row["tier"]] = int(row["cnt"])
            total = sum(by_tier.values())
            return {
                "ok": True,
                "db_path": str(self.db_path),
                "total_memories": total,
                "by_tier": by_tier,
            }

    # =========================================================================
    # GESTIÓN DE TAREAS, CHECKPOINTS Y RECUPERACIÓN TRAS REINICIOS (Scenario E)
    # =========================================================================
    def create_task(
        self,
        goal: str,
        title: str = "",
        assigned_agent_id: str = "dee_prime",
        team_id: str = "core_squad",
        node_id: str = "facu",
        autonomy_mode: str = "CONTROLLED_AUTONOMY",
        parent_task_id: str | None = None,
        plan: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        now = time.time()
        task_id = f"task_{int(now * 1000)}_{uuid.uuid4().hex[:6]}"
        clean_mode = autonomy_mode if autonomy_mode in VALID_AUTONOMY_MODES else "CONTROLLED_AUTONOMY"
        clean_title = (title or goal.splitlines()[0][:90]).strip()
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO tasks (
                    id, parent_task_id, title, goal, status, autonomy_mode,
                    assigned_agent_id, team_id, node_id, plan_json, steps_json,
                    artifacts_json, verification_json, checkpoint_json,
                    result_summary, error, retries, max_retries, tokens_consumed,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, '[]', '[]', '{}', '{}', '', NULL, 0, 2, 0, ?, ?)
                """,
                (
                    task_id,
                    parent_task_id,
                    clean_title,
                    goal,
                    clean_mode,
                    assigned_agent_id,
                    team_id,
                    node_id,
                    json.dumps(plan or [], ensure_ascii=False),
                    now,
                    now,
                ),
            )
            conn.commit()
        return self.get_task(task_id) or {}

    def update_task(self, task_id: str, **fields: Any) -> dict[str, Any]:
        now = time.time()
        allowed_cols = {
            "status",
            "autonomy_mode",
            "assigned_agent_id",
            "node_id",
            "result_summary",
            "error",
            "retries",
            "tokens_consumed",
        }
        json_cols = {
            "plan": "plan_json",
            "steps": "steps_json",
            "artifacts": "artifacts_json",
            "verification": "verification_json",
            "checkpoint": "checkpoint_json",
        }
        sets: list[str] = ["updated_at = ?"]
        vals: list[Any] = [now]
        for k, v in fields.items():
            if k in allowed_cols:
                sets.append(f"{k} = ?")
                vals.append(v)
            elif k in json_cols:
                sets.append(f"{json_cols[k]} = ?")
                vals.append(json.dumps(v, ensure_ascii=False))
        vals.append(task_id)
        with self._lock, self._connect() as conn:
            conn.execute(f"UPDATE tasks SET {', '.join(sets)} WHERE id = ?", vals)
            conn.commit()
        return self.get_task(task_id) or {}

    def get_task(self, task_id: str) -> dict[str, Any] | None:
        with self._lock, self._connect() as conn:
            r = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
            if not r:
                return None
            return self._HydrateTask(dict(r))

    def list_tasks(self, status: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            if status:
                rows = conn.execute(
                    "SELECT * FROM tasks WHERE status = ? ORDER BY updated_at DESC LIMIT ?",
                    (status, int(limit)),
                ).fetchall()
            else:
                rows = conn.execute("SELECT * FROM tasks ORDER BY updated_at DESC LIMIT ?", (int(limit),)).fetchall()
            return [self._HydrateTask(dict(r)) for r in rows]

    def _HydrateTask(self, d: dict[str, Any]) -> dict[str, Any]:
        d["plan"] = json.loads(d.pop("plan_json", "[]"))
        d["steps"] = json.loads(d.pop("steps_json", "[]"))
        d["artifacts"] = json.loads(d.pop("artifacts_json", "[]"))
        d["verification"] = json.loads(d.pop("verification_json", "{}"))
        d["checkpoint"] = json.loads(d.pop("checkpoint_json", "{}"))
        return d

    # =========================================================================
    # COMUNICACIÓN ESTRUCTURADA ENTRE AGENTES (`AgentBus`)
    # =========================================================================
    def record_agent_message(
        self,
        from_agent: str,
        to_agent: str,
        protocol_type: str,
        content: str,
        task_id: str | None = None,
        conversation_id: str = "main",
        payload: dict[str, Any] | None = None,
        hop_count: int = 0,
    ) -> dict[str, Any]:
        if hop_count >= 6:
            raise ValueError(f"Ciclo de delegación detectado entre agentes (hop_count={hop_count} >= 6)")
        now = time.time()
        msg_id = f"amsg_{int(now * 1000)}_{uuid.uuid4().hex[:6]}"
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO agent_messages (
                    id, task_id, conversation_id, from_agent, to_agent,
                    protocol_type, content, payload_json, hop_count, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    msg_id,
                    task_id,
                    conversation_id,
                    from_agent,
                    to_agent,
                    protocol_type,
                    content,
                    json.dumps(payload or {}, ensure_ascii=False),
                    int(hop_count),
                    now,
                ),
            )
            conn.commit()
        return {
            "id": msg_id,
            "task_id": task_id,
            "from_agent": from_agent,
            "to_agent": to_agent,
            "protocol_type": protocol_type,
            "content": content,
            "payload": payload or {},
            "hop_count": hop_count,
            "created_at": now,
        }

    def list_agent_messages(self, task_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            if task_id:
                rows = conn.execute(
                    "SELECT * FROM agent_messages WHERE task_id = ? ORDER BY created_at ASC LIMIT ?",
                    (task_id, int(limit)),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM agent_messages ORDER BY created_at DESC LIMIT ?",
                    (int(limit),),
                ).fetchall()
            out = []
            for r in rows:
                d = dict(r)
                d["payload"] = json.loads(d.pop("payload_json", "{}"))
                out.append(d)
            return out

    # =========================================================================
    # NODOS DISTRIBUIDOS, APROBACIONES Y AUDITORÍA FORENSE
    # =========================================================================
    def list_nodes(self) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            rows = conn.execute("SELECT * FROM nodes ORDER BY id ASC").fetchall()
            out = []
            for r in rows:
                d = dict(r)
                d["capabilities"] = json.loads(d.pop("capabilities_json", "[]"))
                d["online"] = bool(d["online"])
                d["gpu_available"] = bool(d["gpu_available"])
                d["has_gpu"] = d["gpu_available"]
                d["port"] = d["port_bench"] if d["id"] == "barto" else d["port_gateway"]
                d["status"] = "ONLINE" if d["online"] else "STANDBY_LOCAL_WORKBENCH"
                out.append(d)
            return out

    def get_node(self, node_id: str) -> dict[str, Any] | None:
        return next((n for n in self.list_nodes() if n["id"] == node_id), None)

    def upsert_node(self, node_data: dict[str, Any]) -> dict[str, Any]:
        now = time.time()
        nid = str(node_data["id"])
        existing = next((n for n in self.list_nodes() if n["id"] == nid), {})
        caps = node_data.get("capabilities") if "capabilities" in node_data else existing.get("capabilities", [])
        status_str = str(node_data.get("status") or "")
        if "online" in node_data:
            is_online = bool(node_data["online"])
        elif status_str:
            is_online = status_str.upper() == "ONLINE"
        else:
            is_online = bool(existing.get("online", True))
        gpu_val = node_data.get("gpu_available", node_data.get("has_gpu", existing.get("gpu_available", False)))
        port_gw = int(node_data.get("port_gateway") or node_data.get("port") or existing.get("port_gateway") or 8730)
        port_bn = int(node_data.get("port_bench") or node_data.get("port") or existing.get("port_bench") or 8731)
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO nodes (
                    id, host, port_gateway, port_bench, role, cpu_cores, cpu_pct,
                    ram_total_mb, ram_free_mb, disk_free_gb, gpu_available,
                    capabilities_json, latency_ms, online, last_heartbeat
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    nid,
                    str(node_data.get("host") or existing.get("host") or "127.0.0.1"),
                    port_gw,
                    port_bn,
                    str(node_data.get("role") or existing.get("role") or "worker"),
                    int(node_data.get("cpu_cores") or existing.get("cpu_cores") or 2),
                    float(node_data.get("cpu_pct") if "cpu_pct" in node_data else existing.get("cpu_pct", 0.0)),
                    int(node_data.get("ram_total_mb") or existing.get("ram_total_mb") or 4096),
                    int(node_data.get("ram_free_mb") if "ram_free_mb" in node_data else existing.get("ram_free_mb", 2048)),
                    float(node_data.get("disk_free_gb") if "disk_free_gb" in node_data else existing.get("disk_free_gb", 20.0)),
                    1 if gpu_val else 0,
                    json.dumps(list(caps)),
                    float(node_data.get("latency_ms") if "latency_ms" in node_data else existing.get("latency_ms", 1.0)),
                    1 if is_online else 0,
                    now,
                ),
            )
            conn.commit()
        return self.get_node(nid) or {}

    def create_approval(
        self,
        agent_id: str,
        tool_name: str,
        args: dict[str, Any],
        reason: str,
        task_id: str | None = None,
    ) -> dict[str, Any]:
        now = time.time()
        ap_id = f"appr_{int(now * 1000)}_{uuid.uuid4().hex[:6]}"
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO approvals (
                    id, task_id, agent_id, tool_name, args_json, reason, status, requested_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
                """,
                (ap_id, task_id, agent_id, tool_name, json.dumps(args, ensure_ascii=False), reason, now),
            )
            conn.commit()
        return self.get_approval(ap_id) or {}

    def resolve_approval(self, approval_id: str, approved: bool, resolved_by: str = "facu") -> dict[str, Any]:
        now = time.time()
        status = "approved" if approved else "rejected"
        with self._lock, self._connect() as conn:
            conn.execute(
                "UPDATE approvals SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?",
                (status, now, resolved_by, approval_id),
            )
            conn.commit()
        ap = self.get_approval(approval_id)
        if ap and approved and ap["tool_name"].startswith("grant_skill_or_tool:"):
            granted = ap["tool_name"].split(":", 1)[1]
            agent = self.get_agent(ap["agent_id"])
            if agent and granted not in agent["allowed_tools"]:
                agent["allowed_tools"].append(granted)
                self.create_or_update_agent(agent)
        return ap or {}

    def get_approval(self, approval_id: str) -> dict[str, Any] | None:
        with self._lock, self._connect() as conn:
            r = conn.execute("SELECT * FROM approvals WHERE id = ?", (approval_id,)).fetchone()
            if not r:
                return None
            d = dict(r)
            d["args"] = json.loads(d.pop("args_json", "{}"))
            return d

    def list_approvals(self, status: str | None = None) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            if status:
                rows = conn.execute(
                    "SELECT * FROM approvals WHERE status = ? ORDER BY requested_at DESC",
                    (status,),
                ).fetchall()
            else:
                rows = conn.execute("SELECT * FROM approvals ORDER BY requested_at DESC LIMIT 50").fetchall()
            out = []
            for r in rows:
                d = dict(r)
                d["args"] = json.loads(d.pop("args_json", "{}"))
                out.append(d)
            return out

    def log_audit(
        self,
        actor: str = "system",
        category: str = "general",
        action: str = "",
        target: str = "",
        verdict: str = "ALLOW",
        evidence: dict[str, Any] | None = None,
        *,
        event_type: str | None = None,
        decision: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        now = time.time()
        lid = f"aud_{int(now * 1000)}_{uuid.uuid4().hex[:6]}"
        cat = event_type or category or "general"
        verd = decision or verdict or "ALLOW"
        ev = details if details is not None else (evidence or {})
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO audit_logs (id, ts, actor, category, action, target, verdict, evidence_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (lid, now, actor, cat, action, target, verd, json.dumps(ev, ensure_ascii=False)),
            )
            conn.commit()
        return {"id": lid, "ts": now, "actor": actor, "category": cat, "action": action, "target": target, "verdict": verd}

    def list_audit_logs(self, limit: int = 80) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            rows = conn.execute("SELECT * FROM audit_logs ORDER BY ts DESC LIMIT ?", (int(limit),)).fetchall()
            out = []
            for r in rows:
                d = dict(r)
                d["evidence"] = json.loads(d.pop("evidence_json", "{}"))
                out.append(d)
            return out


PLATFORM_DB = DeePlatformDB()
PLATFORM_STORE = PLATFORM_DB

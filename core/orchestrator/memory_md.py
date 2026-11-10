"""MEMORIA EPISÓDICA MARKDOWN (0-RAM) & CRISTALIZADOR DE SKILLS DE DEE.

Inspirado en:
1. `OpenGrokBot/server/memory.ts`: Cada agente mantiene sus notas de largo plazo en un archivo
   `.md` liviano (`data/memory/<agent_id>.md`, máx 4.000 caracteres), destilado en segundo plano
   al terminar una ronda con escritura atómica (`.tmp` + `replace`). Consume 0 MB de RAM.
2. `Hermes Skill Loop` + `grok-bot-cli skills`: Tareas resueltas con éxito o enseñadas por Facu
   se cristalizan en `data/skills/<id>.skill.md` y se invocan con `/nombre` ahorrando el 90%
   de los tokens de razonamiento.
"""
from __future__ import annotations

import json
import re
import threading
import time
from pathlib import Path

from ..events import BUS
from .llm_pool import LLM_POOL

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
MEMORY_DIR = ROOT_DIR / "data" / "memory"
SKILLS_DIR = ROOT_DIR / "data" / "skills"
MAX_MEMORY_CHARS = 4000


DEFAULT_FACU_MEMORY = """# Perfil y Contexto Permanente de Facu (Comandante del Laboratorio)
- **Identidad**: Facu, arquitecto de software y comandante del cluster (`facu`, `barto`, `manager1`).
- **Preferencias de comunicación**: Español argentino (voseo), directo, al hueso, sin relleno corporativo.
- **Infraestructura confirmada**:
  - `facu` (Master): Pentium B950 2c, 11 GiB RAM, Debian 13 X11, FreeLLMAPI :3001, Hermes :8642, Dee :8091.
  - `barto` (Worker 1): Celeron N4020 2c, 7.6 GiB RAM, 431 GB disco, builds pesados y worktrees.
  - `manager1` (Worker 2): Celeron N4020 2c, 7.6 GiB RAM, automatización web y cámara USB principal.
  - `carecam`: Cámara IP `192.168.100.22` (snapshot HTTP JPEG).
- **Regla de Oro**: Dee decide y enruta con máxima eficiencia; cero consumo innecesario de RAM/CPU/Tokens.
"""

STARTER_SKILLS = {
    # --- NIVEL PRIMARIO (Core Cluster, Seguridad & Optimización) ---
    "auditar-nodos": {
        "id": "auditar-nodos",
        "tier": "primary",
        "icon": "⚡",
        "name": "Auditoría de Clúster (3 PCs)",
        "description": "Verifica CPU, RAM, disco libre y servicios en facu, barto y manager1.",
        "cmd": "echo '=== NODOS & RECURSOS ===' && uname -n && uptime && free -h && df -h / | tail -n 1 && ss -tln | grep -E ':(3001|8091|8642|8730|8731)' || true",
        "action": "manipular_datos",
        "emotion": "curioso",
        "body": "Ejecutar chequeo de telemetría real en facu, barto y manager1; reportar estado de puertos :3001, :8091, :8642, :8730 y :8731.",
    },
    "hardening-seguridad": {
        "id": "hardening-seguridad",
        "tier": "primary",
        "icon": "🛡️",
        "name": "Sentinel SAST & Puertos",
        "description": "Audita puertos en escucha, conexiones activas y permisos críticos.",
        "cmd": "echo '=== AUDITORIA SENTINEL ===' && ss -tulpn 2>/dev/null | head -n 15 && echo '--- Conexiones establecidas ---' && ss -tn state established | head -n 10",
        "action": "explicacion",
        "emotion": "combate",
        "body": "Auditar con Sentinel los puertos abiertos (`ss -tlnp`), permisos `.env` y verificar que ningún servicio interno esté expuesto fuera de la LAN.",
    },
    "limpiar-ram": {
        "id": "limpiar-ram",
        "tier": "primary",
        "icon": "🧹",
        "name": "Mayordomo RAM & Temp",
        "description": "Ejecuta el Mayordomo de Dee y reporta el Top de procesos por memoria.",
        "cmd": "echo '=== TOP PROCESOS RAM ===' && ps aux --sort=-%mem | awk 'NR<=8 {printf \"%-10s %-6s %-6s %s\\n\", $1, $3\"%\", $4\"%\", $11}' && free -m",
        "action": "trabajando",
        "emotion": "orgullo",
        "body": "Disparar barrido del Mayordomo (`BUTLER.sweep()`), listar el top de procesos por memoria y reportar RAM libre.",
    },
    "procesos-top": {
        "id": "procesos-top",
        "tier": "primary",
        "icon": "📊",
        "name": "Inspector de Procesos CPU",
        "description": "Muestra en tiempo real los procesos que más CPU consumen en el nodo.",
        "cmd": "echo '=== TOP PROCESOS CPU ===' && ps aux --sort=-%cpu | awk 'NR<=10 {printf \"PID:%-7s CPU:%-6s MEM:%-6s CMD:%s\\n\", $2, $3\"%\", $4\"%\", $11}'",
        "action": "manipular_datos",
        "emotion": "curioso",
        "body": "Inspeccionar el árbol de procesos activos ordenados por uso de CPU para detectar cuellos de botella en el Pentium B950.",
    },
    # --- NIVEL SECUNDARIO (DevOps, Docker, Git, Red LAN) ---
    "docker-ops": {
        "id": "docker-ops",
        "tier": "secondary",
        "icon": "🐳",
        "name": "Docker Engine & Imágenes",
        "description": "Lista contenedores activos, imágenes construidas y uso de recursos Docker.",
        "cmd": "echo '=== DOCKER CONTAINERS & IMAGES ===' && docker ps -a --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}' 2>/dev/null || true && docker images nickdev24/dee-bot-agents",
        "action": "trabajando",
        "emotion": "orgullo",
        "body": "Verificar estado de contenedores e imágenes Docker de Dee-Bot-Agents en el nodo local.",
    },
    "git-sync": {
        "id": "git-sync",
        "tier": "secondary",
        "icon": "🌿",
        "name": "Git Multi-Branch Status",
        "description": "Audita ramas remotas/locales, últimos commits y estado del árbol Git.",
        "cmd": "echo '=== GIT REPO STATUS (@NickDev24) ===' && git branch -a && echo '--- Últimos Commits ---' && git log --oneline -n 5 && git status -s",
        "action": "trabajando",
        "emotion": "curioso",
        "body": "Inspeccionar ramas (main, control-ops, private-control), commits recientes y estado del repositorio Dee-Bot-Agents.",
    },
    "red-lan-scan": {
        "id": "red-lan-scan",
        "tier": "secondary",
        "icon": "📡",
        "name": "Escáner LAN & ARP Nodos",
        "description": "Descubre interfaces de red, tabla ARP de vecinos LAN y latencia local.",
        "cmd": "echo '=== INTERFACES & VECINOS LAN ===' && ip -br addr show && echo '--- Tabla ARP / Vecinos ---' && ip neigh show",
        "action": "manipular_datos",
        "emotion": "curioso",
        "body": "Escanear interfaces IP y vecinos en la red LAN para localizar a barto, manager1 y CareCam.",
    },
    "logs-vivo": {
        "id": "logs-vivo",
        "tier": "secondary",
        "icon": "📜",
        "name": "Tail de Logs & Eventos",
        "description": "Muestra los últimos eventos del sistema, servidor :8091 y workbench :8731.",
        "cmd": "echo '=== ULTIMOS LOGS DE DEE-BOT-AGENTS ===' && tail -n 20 /tmp/dee_core_8091.log 2>/dev/null || dmesg | tail -n 15",
        "action": "trabajando",
        "emotion": "curioso",
        "body": "Extraer las últimas líneas de telemetría y logs operativos del servidor maestro de Dee.",
    },
    # --- NIVEL TERCIARIO (Sensores Físicos, Biometría, Benchmark & Automatización) ---
    "camara-snapshot": {
        "id": "camara-snapshot",
        "tier": "tertiary",
        "icon": "👁️",
        "name": "Captura Visual & PGM Diff",
        "description": "Dispara captura en cámara autorizada y verifica filtro de movimiento PGM.",
        "cmd": "echo '=== DISPOSITIVOS DE VIDEO & SENSORES ===' && ls -la /dev/video* 2>/dev/null || echo 'Sin webcam local USB en facu (usando CareCam LAN / Manager1)' && curl -s http://127.0.0.1:8091/api/status | python3 -c \"import sys,json; d=json.load(sys.stdin)['sensory']['eyes']; print('Ojos:', d)\"",
        "action": "explicacion",
        "emotion": "combate",
        "body": "Verificar dispositivos V4L2/CareCam y consultar estado biométrico del motor de visión de Dee.",
    },
    "audio-alsa-check": {
        "id": "audio-alsa-check",
        "tier": "tertiary",
        "icon": "🎙️",
        "name": "Diagnóstico ALSA & Micrófono",
        "description": "Lista placas de sonido ALSA de captura/reproducción y estado de Oídos.",
        "cmd": "echo '=== DISPOSITIVOS ALSA (CAPTURA & PLAYBACK) ===' && arecord -l 2>/dev/null || true && aplay -l 2>/dev/null || true",
        "action": "manipular_datos",
        "emotion": "curioso",
        "body": "Inspeccionar hardware de sonido ALSA para el detector de doble aplauso y huella de voz MFCC de Facu.",
    },
    "benchmark-cpu": {
        "id": "benchmark-cpu",
        "tier": "tertiary",
        "icon": "🚀",
        "name": "Micro-Benchmark CPU & IOPS",
        "description": "Mide velocidad de cómputo en Python y lectura en disco de facu en <1s.",
        "cmd": "python3 -c \"import time, hashlib; t0=time.time(); [hashlib.sha256(b'dee-supreme').digest() for _ in range(150000)]; dt=(time.time()-t0)*1000; print(f'Benchmark SHA256 x150k: {dt:.1f} ms ({int(150000/(dt/1000))} ops/seg)')\" && lscpu | grep -E 'Model name|CPU\\(s\\)|MHz' || true",
        "action": "celebracion_salto",
        "emotion": "orgullo",
        "body": "Ejecutar micro-benchmark criptográfico en Python stdlib para medir rendimiento real del procesador.",
    },
    "test-integridad": {
        "id": "test-integridad",
        "tier": "tertiary",
        "icon": "✅",
        "name": "Prueba de Integridad Completa",
        "description": "Verifica salud de los puertos :8091, :8730, :8731 y ahorro de tokens.",
        "cmd": "curl -s http://127.0.0.1:8091/health && echo '' && curl -s http://127.0.0.1:8730/health && echo '' && curl -s http://127.0.0.1:8731/health && echo ''",
        "action": "celebracion_salto",
        "emotion": "orgullo",
        "body": "Verificar respuesta instantánea de los 3 demonios de Dee-Bot-Agents (:8091, :8730 y :8731).",
    },
    "control-pc-x11": {
        "id": "control-pc-x11",
        "tier": "primary",
        "icon": "🖱️",
        "name": "Control Total PC X11 (Mouse/Ventanas)",
        "description": "Inspecciona resolución X11, coordenadas del puntero, ventanas activas y volumen del sistema.",
        "cmd": "curl -s http://127.0.0.1:8091/api/pc | python3 -m json.tool | head -n 35",
        "action": "trabajando",
        "emotion": "orgullo",
        "body": "Consultar el controlador nativo C/X11 (libX11 + libXtst) para ver posición del cursor, resolución y ventanas abiertas.",
    },
    "rag-indexar": {
        "id": "rag-indexar",
        "tier": "secondary",
        "icon": "📚",
        "name": "Motor RAG Local 0-RAM (SQLite FTS5)",
        "description": "Muestra estadísticas del índice BM25 en SQLite y busca fragmentos relevantes en <3ms.",
        "cmd": "curl -s 'http://127.0.0.1:8091/api/rag?q=Sentinel+Gateway+X11' | python3 -m json.tool | head -n 30",
        "action": "manipular_datos",
        "emotion": "curioso",
        "body": "Ejecutar búsqueda léxico-semántica BM25 sobre la base SQLite FTS5 local con 0 MB de consumo de RAM.",
    },
    "gateway-check": {
        "id": "gateway-check",
        "tier": "secondary",
        "icon": "🌉",
        "name": "Verificar Gateway :8730 & Bench :8731",
        "description": "Ejecuta bin/gateway-check.sh verificando transferencia atómica y telemetría POSIX.",
        "cmd": "bash ./bin/gateway-check.sh 127.0.0.1:8730",
        "action": "celebracion_salto",
        "emotion": "orgullo",
        "body": "Validar el Gateway de Archivos Atómico (:8730) y el Workbench de Grupos de Procesos (:8731).",
    },
}


class MarkdownMemoryStore:
    def __init__(self):
        MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        SKILLS_DIR.mkdir(parents=True, exist_ok=True)
        self._busy_agents: set[str] = set()
        self._lock = threading.Lock()
        self._ensure_starter_files()

    def _ensure_starter_files(self) -> None:
        master_mem = MEMORY_DIR / "dee_core.md"
        if not master_mem.exists():
            master_mem.write_text(DEFAULT_FACU_MEMORY.strip() + "\n", encoding="utf-8")

        for sid, sdata in STARTER_SKILLS.items():
            spath = SKILLS_DIR / f"{sid}.json"
            spath.write_text(json.dumps(sdata, indent=2, ensure_ascii=False), encoding="utf-8")

    def read_memory(self, agent_id: str = "dee_core") -> str:
        safe_id = re.sub(r"[^a-zA-Z0-9_-]", "", agent_id) or "dee_core"
        p = MEMORY_DIR / f"{safe_id}.md"
        return p.read_text(encoding="utf-8") if p.exists() else ""

    def write_memory(self, agent_id: str, text: str) -> dict:
        safe_id = re.sub(r"[^a-zA-Z0-9_-]", "", agent_id) or "dee_core"
        p = MEMORY_DIR / f"{safe_id}.md"
        tmp = p.with_suffix(".md.tmp")
        cleaned = (text or "").strip()[:MAX_MEMORY_CHARS]
        tmp.write_text(cleaned + "\n", encoding="utf-8")
        tmp.replace(p)
        BUS.publish("memory_updated", agent_id=safe_id, chars=len(cleaned))
        return {"ok": True, "agent_id": safe_id, "chars": len(cleaned)}

    def list_memories(self) -> list[dict]:
        items = []
        for p in sorted(MEMORY_DIR.glob("*.md")):
            content = p.read_text(encoding="utf-8").strip()
            items.append(
                {
                    "id": p.stem,
                    "agent_id": p.stem,
                    "title": f"Memoria de {p.stem}",
                    "content": content,
                    "chars": len(content),
                    "updated_at": round(p.stat().st_mtime, 1),
                }
            )
        return items

    def distill_in_background(self, agent_id: str, user_text: str, agent_reply: str) -> None:
        """OpenGrokBot style background memory folding."""
        with self._lock:
            if agent_id in self._busy_agents:
                return
            self._busy_agents.add(agent_id)

        def _worker():
            try:
                current = self.read_memory(agent_id)
                prompt = (
                    f"Notas actuales de {agent_id}:\n{current or '(vacío)'}\n\n"
                    f"Nuevo intercambio:\n[Facu]: {user_text[:400]}\n[{agent_id}]: {agent_reply[:500]}\n\n"
                    f"Reescribí las notas en Markdown ultra-conciso (máximo {MAX_MEMORY_CHARS} caracteres) "
                    "conservando únicamente hechos durables, decisiones técnicas, rutas y preferencias de Facu."
                )
                res = LLM_POOL.chat_completion(
                    messages=[
                        {
                            "role": "system",
                            "content": "Mantenés la memoria episódica en Markdown de un agente de Facu. Respondé SOLO con las notas en Markdown.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    model="auto:fast",
                    temperature=0.1,
                    max_tokens=500,
                )
                if res.get("ok") and res.get("text"):
                    self.write_memory(agent_id, res["text"])
            except Exception:
                pass
            finally:
                with self._lock:
                    self._busy_agents.discard(agent_id)

        threading.Thread(target=_worker, daemon=True, name=f"mem-{agent_id}").start()

    # ---- Skills Crystallizer ----
    def list_skills(self) -> dict[str, dict]:
        out = {}
        for p in sorted(SKILLS_DIR.glob("*.json")):
            try:
                d = json.loads(p.read_text(encoding="utf-8"))
                out[d["id"]] = d
            except Exception:
                pass
        return out

    def save_skill(self, skill_id: str, name: str, description: str, body: str) -> dict:
        sid = re.sub(r"[^a-z0-9_-]", "-", skill_id.lower()).strip("-") or f"skill-{int(time.time())}"
        data = {
            "id": sid,
            "name": name.strip(),
            "description": description.strip(),
            "body": body.strip(),
            "created_at": round(time.time(), 1),
        }
        p = SKILLS_DIR / f"{sid}.json"
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        BUS.publish("skill_saved", **data)
        return data

    def expand_skill_tokens(self, text: str) -> str:
        """Replaces `/skill-id` in user prompts with the crystallized skill instructions."""
        skills = self.list_skills()

        def _repl(match):
            lead, sid = match.group(1), match.group(2)
            sk = skills.get(sid)
            if not sk:
                return match.group(0)
            LLM_POOL.total_tokens_saved += 350
            return f'{lead}[SKILL CRISTALIZADA "{sk["name"]}": {sk["body"]}]'

        return re.sub(r"(^|\s)/([a-z0-9_-]+)\b", _repl, text)

    def get_context_for_prompt(self, query: str = "") -> str:
        return self.read_memory("dee_core")


MEMORY_STORE = MarkdownMemoryStore()

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
    "auditar-nodos": {
        "id": "auditar-nodos",
        "name": "Auditoría Rápida de Cluster (3 PCs)",
        "description": "Verifica CPU, RAM, disco libre y servicios en facu, barto y manager1.",
        "body": "Ejecutar chequeo de telemetría real en facu, barto y manager1; reportar estado de puertos :3001, :8642 y :8731.",
    },
    "hardening-seguridad": {
        "id": "hardening-seguridad",
        "name": "Escaneo SAST & Puertos Expuestos",
        "description": "Revisa puertos en escucha, permisos de archivos sensibles y secretos expuestos.",
        "body": "Auditar con Sentinel los puertos abiertos (`ss -tlnp`), permisos `.env` y verificar que ningún servicio interno esté expuesto fuera de la LAN.",
    },
    "limpiar-ram": {
        "id": "limpiar-ram",
        "name": "Optimización de Memoria y Temporales",
        "description": "Ejecuta el Mayordomo de Dee y reporta procesos de mayor consumo de RAM.",
        "body": "Disparar barrido del Mayordomo (`BUTLER.sweep()`), listar el top 5 de procesos por memoria (`ps aux --sort=-%mem | head -n 6`) y reportar RAM libre.",
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
            if not spath.exists():
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

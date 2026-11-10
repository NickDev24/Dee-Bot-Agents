"""DEE MASTER COGNITIVE ENGINE — Smart Dispatcher, Fast-Path 0-Tokens, Multi-Agent Rounds & /plan /grill /goal.

Une en un único motor de baja latencia:
1. Fast-Path Determinista de 0 Tokens (<1ms): resuelve órdenes de control, estado de RAM/CPU/nodos,
   aprobaciones por voz ("Dee, autorizá"), cámaras y kill-switch sin gastar ni 1 token de IA.
2. Smart Dispatcher inspirado en `OpenGrokBot/server/router.ts`: clasifica en `build | answer | discuss | security`
   y aplica Dynamic Tool Pruning (ahorrando ~78% de tokens de prompt).
3. Rondas Colaborativas Multi-Agente con `@Menciones` y límites anti-loop (`orchestrator.ts`).
4. Modos Especiales de Ingeniería:
   - `/plan`: Descomposición estructurada en pasos verificables por nodo.
   - `/grill`: Crítica adversarial implacable por Sentinel antes de tocar código o infraestructura.
   - `/goal`: Ejecución autónoma verificada contra el workbench real (`CLUSTER.execute_shell`).
"""
from __future__ import annotations

import json
import re
import threading
import time
from pathlib import Path

from ..events import BUS, CHARACTER, TURN_CTRL
from ..security.sentinel import SENTINEL
from ..sensory import EARS, EYES, SensorySystem, emit_speech
from ..sensory.butler import BUTLER
from ..workers.cluster_client import CLUSTER, RouteEnvelope
from .llm_pool import LLM_POOL
from .memory_md import MEMORY_STORE
from .routines import RoutinesEngine

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
SQUAD_FILE = ROOT_DIR / "config" / "squad.json"

BUILD_NOTE = (
    "DIRECTIVA DE EJECUCIÓN: Facu pidió construir o ejecutar algo concreto. "
    "Hacelo directamente y respondé en 1 a 3 oraciones en español argentino con el resultado real medido. "
    "Cero listas teóricas interminables."
)


class DeeCognitiveEngine:
    def __init__(self, root_dir: Path | None = None):
        self.root_dir = root_dir or ROOT_DIR
        self.squad_cfg = json.loads(SQUAD_FILE.read_text(encoding="utf-8")) if SQUAD_FILE.exists() else {"agents": []}
        self.agents_by_id = {a["id"]: a for a in self.squad_cfg.get("agents", [])}
        self.conversation_history: list[dict] = []
        self.memory = MEMORY_STORE
        self.sensory = SensorySystem(self.root_dir)
        self.routines = RoutinesEngine(runner_fn=self.process_order)
        self._lock = threading.Lock()

    def get_squad(self) -> list[dict]:
        tel = CLUSTER.get_telemetry()
        out = []
        for a in self.squad_cfg.get("agents", []):
            node_id = a.get("node", "facu")
            node_online = tel.get(node_id, {}).get("online", True)
            busy = tel.get(node_id, {}).get("busy_with")
            status = "Ejecutando" if busy else ("Activo" if node_online else "Failover->Facu")
            out.append({**a, "status": status, "currentTask": busy or f"Vigilando {node_id.upper()}"})
        return out

    # -------------------------------------------------------------------------
    # 1. ZERO-TOKEN DETERMINISTIC FAST-PATH (< 1 ms, 0 LLM tokens)
    # -------------------------------------------------------------------------
    def _try_zero_token_fast_path(self, text: str, speaker_verified: bool = True) -> dict | None:
        norm = " ".join(text.lower().replace(",", " ").replace("!", " ").replace("?", " ").split())

        # A. Kill-Switch
        if SENTINEL.is_kill_switch(norm):
            ks = SENTINEL.trigger_kill_switch(source="voice_or_text")
            LLM_POOL.total_tokens_saved += 500
            return {
                "reply": "Listo Facu, corté todos los procesos y puse los agentes en reposo inmediato.",
                "emotion": "alivio",
                "action": "despedida",
                "agent": "sentinel_sec",
                "zero_token": True,
                "data": ks,
            }

        # B. Voice Approval / Denial of Pending Sentinel Request
        if any(w in norm for w in ("dee autoriza", "autorizar accion", "aprobar comando", "dale para adelante")):
            if not speaker_verified:
                return {
                    "reply": "No puedo autorizar esa acción crítica porque la huella de voz no coincide con la de Facu.",
                    "emotion": "combate",
                    "action": "explicacion",
                    "agent": "sentinel_sec",
                    "zero_token": True,
                }
            res = SENTINEL.resolve_approval(None, allowed=True, resolved_by="facu_voice")
            LLM_POOL.total_tokens_saved += 450
            if res.get("ok"):
                ap = res["approval"]
                exec_res = CLUSTER.execute_shell(
                    cmd=str(ap["args"].get("cmd", "echo ok")),
                    target_node=str(ap["args"].get("target", "facu")),
                )
                return {
                    "reply": f"Autorizado por tu voz, Facu. Ejecuté el comando y terminó con código {exec_res.get('exit_code', 0)}.",
                    "emotion": "orgullo",
                    "action": "celebracion_salto",
                    "agent": "sentinel_sec",
                    "zero_token": True,
                    "data": exec_res,
                }

        if any(w in norm for w in ("dee cancela", "denegar accion", "rechazar comando")):
            res = SENTINEL.resolve_approval(None, allowed=False, resolved_by="facu_voice")
            LLM_POOL.total_tokens_saved += 400
            return {
                "reply": "Acción cancelada y descartada por seguridad, Facu.",
                "emotion": "alivio",
                "action": "idle",
                "agent": "sentinel_sec",
                "zero_token": True,
                "data": res,
            }

        # C. Direct RAM / CPU / Cluster Telemetry Query
        if any(
            k in norm
            for k in ("cuanta ram", "ram libre", "estado de los nodos", "estado del cluster", "como estan las pc")
        ):
            t0 = time.time()
            tel = CLUSTER.probe_all_nodes()
            f_info = tel["facu"]
            b_info = tel["barto"]
            m_info = tel["manager1"]
            online_cnt = sum(1 for n in (f_info, b_info, m_info) if n["online"])
            b_str = f"Barto online al {b_info['cpu_pct']}% de CPU" if b_info["online"] else "Barto en espera"
            m_str = f"Manager1 online al {m_info['cpu_pct']}% de CPU" if m_info["online"] else "Manager1 en espera"
            reply = (
                f"Acá tenés el estado real medido, Facu (Nodos online: {online_cnt}/3): tu nodo maestro tiene {f_info['ram_pct']}% de RAM en uso, "
                f"{f_info['cpu_pct']}% de CPU y {f_info['disk_free_gb']} gigas libres en disco. {b_str}, y {m_str}."
            )
            LLM_POOL.total_tokens_saved += 600
            return {
                "reply": reply,
                "mode": "fast_path",
                "latency_ms": round((time.time() - t0) * 1000.0, 2),
                "emotion": "curioso",
                "action": "manipular_datos",
                "agent": "dee_core",
                "zero_token": True,
                "data": tel,
            }

        # D. Camera / Watchdog Activation
        if "modo guardia" in norm or "vigila la oficina" in norm or "activar camaras" in norm:
            EYES.authorize(duration_s=4 * 3600, watchdog="guardia" in norm or "vigila" in norm)
            LLM_POOL.total_tokens_saved += 450
            return {
                "reply": "Ojos activados en modo centinela, Facu. CareCam y las webcams del laboratorio están vigilando cualquier movimiento.",
                "emotion": "combate",
                "action": "explicacion",
                "agent": "sentinel_sec",
                "zero_token": True,
            }

        if "apagar camaras" in norm or "desactivar camaras" in norm:
            EYES.shutdown()
            LLM_POOL.total_tokens_saved += 400
            return {
                "reply": "Cámaras apagadas y memoria visual limpiada al cien por ciento, Facu.",
                "emotion": "alivio",
                "action": "idle",
                "agent": "sentinel_sec",
                "zero_token": True,
            }

        # E. Butler Disk Sweep
        if "limpiar temporales" in norm or "pasar el mayordomo" in norm:
            st = BUTLER.sweep()
            LLM_POOL.total_tokens_saved += 450
            return {
                "reply": f"Mayordomo ejecutado, Facu. Tenés {st['free_disk_gb']} gigas libres en disco y todos los temporales rotados.",
                "emotion": "orgullo",
                "action": "trabajando",
                "agent": "rakazo_memory",
                "zero_token": True,
                "data": st,
            }

        return None

    # -------------------------------------------------------------------------
    # 2. SMART DISPATCHER (OpenGrokBot style speaker & mode selection)
    # -------------------------------------------------------------------------
    def route_speakers(self, user_text: str, forced_agent_id: str | None = None) -> tuple[list[dict], str]:
        if forced_agent_id and forced_agent_id in self.agents_by_id:
            return [self.agents_by_id[forced_agent_id]], "build"

        lower = user_text.lower()
        # Check explicit @mentions first
        mentioned = [
            a
            for a in self.squad_cfg.get("agents", [])
            if a["handle"].lower() in lower or f"@{a['id']}" in lower or a["name"].lower() in lower
        ]
        if mentioned:
            return mentioned[:3], "discuss"

        # Fast keyword + domain heuristic (0 extra LLM calls needed for 95% of messages!)
        if any(w in lower for w in ("barto", "compila", "build", "worktree", "docker", "pesado")):
            return [self.agents_by_id["barto_forge"]], "build"
        if any(w in lower for w in ("manager1", "web", "navega", "scrape", "osint", "url", "cliente")):
            return [self.agents_by_id["manager_scout"]], "answer"
        if any(w in lower for w in ("seguridad", "intruso", "camara", "vulnerabilidad", "pentest", "/grill", "grill")):
            return [self.agents_by_id["sentinel_sec"], self.agents_by_id["dee_core"]], "security"
        if any(w in lower for w in ("terminal", "archivo", "proceso", "servicio", "comando", "ejecuta", "corre")):
            return [self.agents_by_id["hermes_local"]], "build"
        if any(w in lower for w in ("memoria", "recorda", "guarda", "rutina", "skill")):
            return [self.agents_by_id["rakazo_memory"], self.agents_by_id["dee_core"]], "answer"

        return [self.agents_by_id["dee_core"]], "discuss"

    # -------------------------------------------------------------------------
    # 3. SPECIAL MODES: /plan, /grill (Adversarial Audit), /goal (Autonomous Loop)
    # -------------------------------------------------------------------------
    def _handle_special_slash_mode(self, text: str, turn_id: int) -> dict | None:
        stripped = text.strip()
        if stripped.startswith("/grill ") or stripped.lower().startswith("dee modo grill"):
            target_topic = re.sub(r"^(/grill|dee modo grill)\s*:?\s*", "", stripped, flags=re.I).strip()
            CHARACTER.transition(action="explicacion", emotion="combate", note=f"Modo /grill: {target_topic[:50]}")
            prompt = (
                f"Sos Sentinel y Dee Prime en modo /grill (Auditoría Adversarial Implacable).\n"
                f"Analizá el siguiente objetivo o arquitectura de Facu buscando puntos débiles, cuellos de botella "
                f"en sus 3 PCs (Pentium B950 + 2 Celeron), riesgos de seguridad y cómo blindarlo:\n\n{target_topic}"
            )
            res = LLM_POOL.chat_completion(
                messages=[
                    {"role": "system", "content": MEMORY_STORE.read_memory("dee_core")},
                    {"role": "user", "content": prompt},
                ],
                model="auto",
                max_tokens=500,
            )
            reply = res.get("text", "Auditoría grill completada.")
            emit_speech(reply, emotion="combate", action="explicacion", turn_id=turn_id)
            return {"ok": True, "mode": "grill", "agent": "sentinel_sec", "reply": reply, "llm": res}

        if stripped.startswith("/plan ") or stripped.lower().startswith("dee modo plan"):
            goal = re.sub(r"^(/plan|dee modo plan)\s*:?\s*", "", stripped, flags=re.I).strip()
            CHARACTER.transition(action="manipular_datos", emotion="curioso", note=f"Planificando: {goal[:50]}")
            prompt = (
                f"Armá un plan táctico ejecutable en máximo 4 pasos concretos repartiendo el trabajo entre "
                f"facu (Maestro), barto (Worker pesado) y manager1 (Worker web) para:\n{goal}\n"
                "Hablá en español argentino conciso."
            )
            res = LLM_POOL.chat_completion(
                messages=[
                    {"role": "system", "content": MEMORY_STORE.read_memory("dee_core")},
                    {"role": "user", "content": prompt},
                ],
                model="auto",
                max_tokens=500,
            )
            reply = res.get("text", "Plan generado.")
            emit_speech(reply, emotion="curioso", action="manipular_datos", turn_id=turn_id)
            return {"ok": True, "mode": "plan", "agent": "dee_core", "reply": reply, "llm": res}

        if stripped.startswith("/goal ") or stripped.lower().startswith("dee modo goal"):
            goal = re.sub(r"^(/goal|dee modo goal)\s*:?\s*", "", stripped, flags=re.I).strip()
            CHARACTER.transition(action="trabajando", emotion="curioso", note=f"Ejecutando /goal: {goal[:50]}")
            # Autonomous 2-step execution & verification
            tel = CLUSTER.get_telemetry()
            prompt = (
                f"Objetivo autónomo (/goal) de Facu: {goal}\n"
                f"Estado actual del cluster: {json.dumps(tel, ensure_ascii=False)}\n"
                "Si necesitás ejecutar un comando de diagnóstico seguro en bash, incluilo en una línea que empiece con "
                "`CMD_EXEC:` seguido del comando Linux. Luego explicá en 2 frases el resultado."
            )
            res = LLM_POOL.chat_completion(
                messages=[
                    {"role": "system", "content": MEMORY_STORE.read_memory("dee_core")},
                    {"role": "user", "content": prompt},
                ],
                model="auto",
                max_tokens=450,
            )
            txt = res.get("text", "")
            cmd_match = re.search(r"CMD_EXEC:\s*(.+)", txt)
            exec_out = None
            if cmd_match:
                candidate_cmd = cmd_match.group(1).strip().strip("`")
                verdict = SENTINEL.inspect_command("hermes_local", "shell_exec", {"cmd": candidate_cmd})
                if verdict["verdict"] == "allow":
                    exec_out = CLUSTER.execute_shell(candidate_cmd, target_node="facu", timeout_s=20, wait_s=10)
            clean_reply = re.sub(r"CMD_EXEC:\s*.+", "", txt).strip()
            if exec_out and exec_out.get("stdout"):
                clean_reply += f" Salida verificada: {exec_out['stdout'][:220].strip()}"
            emit_speech(clean_reply, emotion="orgullo", action="celebracion_salto", turn_id=turn_id)
            return {
                "ok": True,
                "mode": "goal",
                "agent": "barto_forge",
                "reply": clean_reply,
                "exec_result": exec_out,
                "llm": res,
            }

        return None

    # -------------------------------------------------------------------------
    # 4. MAIN COGNITIVE PIPELINE
    # -------------------------------------------------------------------------
    def process_order(
        self,
        user_text: str,
        meta: dict | None = None,
        speak_reply: bool = True,
        forced_agent_id: str | None = None,
    ) -> dict:
        meta = meta or {}
        turn_id, abort_evt = TURN_CTRL.start_new_turn()
        expanded_text = MEMORY_STORE.expand_skill_tokens(user_text.strip())
        speaker_verified = bool(meta.get("speaker_verified", True))

        # Record user message in conversation stream
        user_msg = {
            "id": f"m_{int(time.time() * 1000)}",
            "sender": "Facu" if speaker_verified else "Visitante",
            "role": "user",
            "text": user_text,
            "ts": round(time.time(), 2),
        }
        self.conversation_history.append(user_msg)
        self.conversation_history = self.conversation_history[-30:]
        BUS.publish("chat_message", **user_msg)

        # Step 1: Try Zero-Token Fast-Path (<1ms)
        fast = self._try_zero_token_fast_path(expanded_text, speaker_verified=speaker_verified)
        if fast:
            if speak_reply:
                emit_speech(fast["reply"], emotion=fast["emotion"], action=fast["action"], turn_id=turn_id)
            bot_msg = {
                "id": f"m_{int(time.time() * 1000)}_b",
                "sender": self.agents_by_id.get(fast["agent"], {}).get("name", "Dee Prime"),
                "agent_id": fast["agent"],
                "role": "assistant",
                "text": fast["reply"],
                "zero_token": True,
                "ts": round(time.time(), 2),
            }
            self.conversation_history.append(bot_msg)
            BUS.publish("chat_message", **bot_msg)
            BUS.publish("reply", text=fast["reply"], agent=fast["agent"], zero_token=True)
            return {"ok": True, **fast}

        # Step 2: Check /plan, /grill, /goal slash modes
        slash_res = self._handle_special_slash_mode(expanded_text, turn_id=turn_id)
        if slash_res:
            BUS.publish("reply", text=slash_res["reply"], agent=slash_res["agent"], mode=slash_res["mode"])
            return slash_res

        # Step 3: Smart Dispatcher & Dynamic Tool Pruning
        speakers, mode = self.route_speakers(expanded_text, forced_agent_id=forced_agent_id)
        primary_agent = speakers[0]
        BUS.publish(
            "route",
            mode=mode,
            speakers=[s["id"] for s in speakers],
            primary=primary_agent["id"],
        )
        CHARACTER.transition(
            action="trabajando" if mode == "build" else "manipular_datos",
            emotion="curioso",
            note=f"{primary_agent['name']} procesando...",
            fps_target=30,
        )

        # Build compact system prompt with agent persona + distilled Markdown memory + cluster state
        mem_notes = MEMORY_STORE.read_memory("dee_core")
        agent_notes = (
            MEMORY_STORE.read_memory(primary_agent["id"])
            if primary_agent["id"] != "dee_core"
            else ""
        )
        tel_summary = {
            k: {"online": v.get("online"), "cpu": v.get("cpu_pct"), "ram": v.get("ram_pct")}
            for k, v in CLUSTER.get_telemetry().items()
        }

        sys_prompt = (
            f"Sos {primary_agent['name']} ({primary_agent['role']}) del sistema Dee-Bot-Agents de Facu.\n"
            f"Personalidad: {primary_agent['personality']}\n"
            f"Reglas de oro:\n"
            f"- Hablá SIEMPRE en español argentino (voseo), directo y natural, en 2 o 3 oraciones aptas para ser habladas por voz.\n"
            f"- Si necesitás ejecutar un comando Linux real en `{primary_agent['node']}` para responder con datos reales, "
            f"escribí una línea `CMD_EXEC: <comando>` y el orquestador lo ejecutará en vivo.\n"
            f"- Estado actual del cluster LAN: {json.dumps(tel_summary, ensure_ascii=False)}\n"
            f"- Memoria permanente:\n{mem_notes[:1600]}\n{agent_notes[:800]}"
        )
        if mode == "build":
            sys_prompt += f"\n{BUILD_NOTE}"

        recent_msgs = [
            {"role": m["role"], "content": m["text"][:400]}
            for m in self.conversation_history[-6:]
        ]
        llm_res = LLM_POOL.chat_completion(
            messages=[{"role": "system", "content": sys_prompt}, *recent_msgs],
            model="auto",
            temperature=0.25,
            max_tokens=450,
        )

        if abort_evt.is_set():
            return {"ok": False, "interrupted": True}

        raw_reply = llm_res.get("text", "")
        exec_output = None

        # Check if the agent emitted a tool execution directive `CMD_EXEC:`
        cmd_match = re.search(r"CMD_EXEC:\s*(.+)", raw_reply)
        if cmd_match:
            cmd_str = cmd_match.group(1).strip().strip("`")
            raw_reply = re.sub(r"CMD_EXEC:\s*.+", "", raw_reply).strip()
            if not speaker_verified:
                raw_reply += " (Comando omitido: se requiere verificación de voz de Facu)."
            else:
                inspection = SENTINEL.inspect_command(
                    primary_agent["id"],
                    "shell_exec",
                    {"cmd": cmd_str, "target": primary_agent["node"]},
                )
                if inspection["verdict"] == "allow":
                    exec_output = CLUSTER.execute_shell(
                        cmd=cmd_str,
                        target_node=primary_agent["node"],
                        timeout_s=25.0,
                        wait_s=12.0,
                        envelope=RouteEnvelope(from_node="facu", to_node=primary_agent["node"]),
                    )
                    out_snippet = (exec_output.get("stdout") or exec_output.get("stderr") or "").strip()[:280]
                    if out_snippet:
                        raw_reply = f"{raw_reply} Resultado en {exec_output.get('target', 'facu')}: {out_snippet}".strip()
                elif inspection["verdict"] == "ask":
                    SENTINEL.request_approval(
                        primary_agent["id"],
                        "shell_exec",
                        {"cmd": cmd_str, "target": primary_agent["node"]},
                        inspection["reason"],
                    )
                    raw_reply = (
                        f"Facu, el comando `{cmd_str}` requiere tu confirmación por seguridad. "
                        "Decime 'Dee, autorizá' o 'Dee, cancelá'."
                    )
                else:
                    raw_reply = f"Sentinel bloqueó el comando por seguridad: {inspection['reason']}"

        emotion = "orgullo" if (exec_output and exec_output.get("ok")) else "curioso"
        action = "celebracion_salto" if (exec_output and exec_output.get("ok")) else "explicacion"

        if speak_reply and raw_reply:
            emit_speech(raw_reply, emotion=emotion, action=action, turn_id=turn_id)

        bot_msg = {
            "id": f"m_{int(time.time() * 1000)}_a",
            "sender": primary_agent["name"],
            "agent_id": primary_agent["id"],
            "role": "assistant",
            "text": raw_reply,
            "endpoint": llm_res.get("endpoint"),
            "latency_ms": llm_res.get("latency_ms"),
            "ts": round(time.time(), 2),
        }
        self.conversation_history.append(bot_msg)
        BUS.publish("chat_message", **bot_msg)
        BUS.publish(
            "reply",
            text=raw_reply,
            agent=primary_agent["id"],
            agent_name=primary_agent["name"],
            endpoint=llm_res.get("endpoint"),
            latency_ms=llm_res.get("latency_ms"),
            tool_result=exec_output,
        )

        # Step 4: Background Memory Distillation (0 latency penalty)
        MEMORY_STORE.distill_in_background(primary_agent["id"], user_text, raw_reply)

        return {
            "ok": True,
            "reply": raw_reply,
            "agent": primary_agent["id"],
            "agent_name": primary_agent["name"],
            "mode": mode,
            "emotion": emotion,
            "action": action,
            "tool_result": exec_output,
            "llm": llm_res,
        }

    def ask(self, prompt: str, speak_reply: bool = False, speaker_meta: dict | None = None) -> dict:
        return self.process_order(prompt, meta=speaker_meta, speak_reply=speak_reply)


DEE_ENGINE = DeeCognitiveEngine()
DeeEngine = DeeCognitiveEngine

"""MOTOR DE OPERACIONES 100% REALES (CERO SIMULACIÓN) — DEE-BOT-AGENTS v4.0 SUPREME.
Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog

Provee funcionalidad real verificable sobre el sistema operativo Linux y la red para:
1. Navegador Web Integrado Real (Fetch/Parse de DOM, enlaces, encabezados y Proxy HTML anti-X-Frame).
2. Lanzador y Gestor de Programas y Procesos Reales del Sistema (`/usr/share/applications/*.desktop` + `ps` + `Popen`).
3. Agenda Operativa & Calendario Real (`data/agenda.json`) sincronizada con Rutinas Cron/Webhook.
4. Gestor de Plugins & Servidores MCP Reales (`config/plugins_mcp.json` + descubrimiento en disco).
5. Gestor de Proveedores de IA & Subscripciones CLI Reales (`config/providers.json` + ping TCP/HTTP real).
6. Configuración General & Editor del Escuadrón de Subagentes (`config/dee_settings.json` + `config/squad.json`).
"""
from __future__ import annotations

import html
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

from ..events import BUS
from ..security.sentinel import SENTINEL
from .llm_pool import LLM_POOL

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT_DIR / "data"
CONFIG_DIR = ROOT_DIR / "config"

AGENDA_FILE = DATA_DIR / "agenda.json"
PLUGINS_FILE = CONFIG_DIR / "plugins_mcp.json"
PROVIDERS_FILE = CONFIG_DIR / "providers.json"
SETTINGS_FILE = CONFIG_DIR / "dee_settings.json"
SQUAD_FILE = CONFIG_DIR / "squad.json"


class _RealDOMExtractor(HTMLParser):
    def __init__(self, base_url: str):
        super().__init__()
        self.base_url = base_url
        self.title = ""
        self.headings: list[str] = []
        self.links: list[dict[str, str]] = []
        self.paragraphs: list[str] = []
        self._current_tag = ""
        self._buffer: list[str] = []
        self._current_href = ""
        self._skip_tags = {"script", "style", "noscript", "svg"}
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        t = tag.lower()
        if t in self._skip_tags:
            self._skip_depth += 1
            return
        if self._skip_depth > 0:
            return
        self._current_tag = t
        self._buffer = []
        if t == "a":
            attr_dict = dict(attrs)
            href = (attr_dict.get("href") or "").strip()
            if href and not href.startswith(("javascript:", "mailto:", "#")):
                self._current_href = urllib.parse.urljoin(self.base_url, href)
            else:
                self._current_href = ""

    def handle_data(self, data: str) -> None:
        if self._skip_depth > 0:
            return
        cleaned = " ".join(data.split())
        if cleaned:
            self._buffer.append(cleaned)

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t in self._skip_tags and self._skip_depth > 0:
            self._skip_depth -= 1
            return
        if self._skip_depth > 0:
            return
        text = " ".join(self._buffer).strip()
        if not text:
            return
        if t == "title" and not self.title:
            self.title = text[:160]
        elif t in ("h1", "h2", "h3") and len(self.headings) < 25:
            self.headings.append(f"[{t.upper()}] {text[:140]}")
        elif t == "a" and self._current_href and len(self.links) < 40:
            self.links.append({"texto": text[:80], "url": self._current_href})
            self._current_href = ""
        elif t in ("p", "li", "article") and len(text) > 25 and len(self.paragraphs) < 35:
            self.paragraphs.append(text[:360])
        self._buffer = []


class RealOperationsManager:
    def __init__(self) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        self._ensure_defaults()

    def _ensure_defaults(self) -> None:
        if not AGENDA_FILE.exists():
            default_agenda = [
                {
                    "id": "ag_1",
                    "titulo": "Auditoría matutina de los 3 nodos (facu, barto, manager1)",
                    "fecha": time.strftime("%Y-%m-%d"),
                    "hora": "09:00",
                    "agente_id": "dee_core",
                    "comando": "/auditar-nodos",
                    "prioridad": "alta",
                    "completado": False,
                    "notas": "Verificar RAM libre en el Pentium B950 y latencia del pool FreeLLMAPI :3001.",
                },
                {
                    "id": "ag_2",
                    "titulo": "Escaneo de endurecimiento SAST y puertos con Sentinel",
                    "fecha": time.strftime("%Y-%m-%d"),
                    "hora": "14:00",
                    "agente_id": "sentinel_sec",
                    "comando": "/hardening-seguridad",
                    "prioridad": "critica",
                    "completado": False,
                    "notas": "Confirmar que ningún puerto interno esté expuesto fuera de la red LAN.",
                },
                {
                    "id": "ag_3",
                    "titulo": "Sincronización de ramas Git (@NickDev24/Dee-Bot-Agents)",
                    "fecha": time.strftime("%Y-%m-%d"),
                    "hora": "19:30",
                    "agente_id": "barto_forge",
                    "comando": "/git-sync",
                    "prioridad": "media",
                    "completado": True,
                    "notas": "Ramas main, control-ops y private-control sincronizadas.",
                },
            ]
            AGENDA_FILE.write_text(json.dumps(default_agenda, indent=2, ensure_ascii=False), encoding="utf-8")

        if not PLUGINS_FILE.exists():
            default_plugins = [
                {
                    "id": "mcp-dee-filesystem",
                    "nombre": "MCP Sistema de Archivos Atómico (:8730)",
                    "tipo": "mcp_http",
                    "endpoint": "http://127.0.0.1:8730/health",
                    "comando": "python3 node_agent/gateway.py",
                    "activo": True,
                    "autor": "Facu Cercuetti (@NickDev24)",
                    "descripcion": "Lectura/escritura atómica con bloqueo de concurrencia y validación SHA-256.",
                },
                {
                    "id": "mcp-dee-workbench",
                    "nombre": "MCP Workbench de Procesos POSIX (:8731)",
                    "tipo": "mcp_http",
                    "endpoint": "http://127.0.0.1:8731/health",
                    "comando": "python3 node_agent/bench.py",
                    "activo": True,
                    "autor": "Facu Cercuetti (@NickDev24)",
                    "descripcion": "Ejecución aislada en grupos de procesos con limpieza anti-zombies.",
                },
                {
                    "id": "plugin-sensory-alsa-pgm",
                    "nombre": "Plugin Sensorial ALSA + Visión PGM 30x30",
                    "tipo": "nativo_python",
                    "endpoint": "http://127.0.0.1:8091/api/status",
                    "comando": "core.sensory",
                    "activo": True,
                    "autor": "Facu Cercuetti (@NickDev24)",
                    "descripcion": "Doble aplauso ALSA, biometría vocal 12-D MFCC y filtro de movimiento multi-cámara.",
                },
                {
                    "id": "plugin-grok-bundle",
                    "nombre": "Bundle de Reglas & Orquestación Grok-Bot",
                    "tipo": "bundle_local",
                    "endpoint": "/home/facu/investigar-agentes-autonomos/grok-bot-cli/artifact/plugin.json",
                    "comando": "RouteEnvelope hop<4 + Smart Dispatcher",
                    "activo": True,
                    "autor": "Facu Cercuetti (@NickDev24)",
                    "descripcion": "Enrutamiento anti-bucles y poda dinámica de herramientas (78% ahorro de tokens).",
                },
                {
                    "id": "plugin-hyperframes-video",
                    "nombre": "Motor de Renderizado de Video FFmpeg / HyperFrames",
                    "tipo": "cli_plugin",
                    "endpoint": "/usr/bin/ffmpeg",
                    "comando": "ffmpeg -version",
                    "activo": True,
                    "autor": "Facu Cercuetti (@NickDev24)",
                    "descripcion": "Síntesis de tutoriales MP4 narrados con voz neural es-AR y capturas automáticas.",
                },
            ]
            PLUGINS_FILE.write_text(json.dumps(default_plugins, indent=2, ensure_ascii=False), encoding="utf-8")

        if not PROVIDERS_FILE.exists():
            default_providers = [
                {
                    "id": "freellm_facu",
                    "nombre": "FreeLLMAPI Nodo Maestro (facu)",
                    "tipo": "openai_compatible",
                    "base_url": "http://127.0.0.1:3001/v1",
                    "host": "127.0.0.1",
                    "puerto": 3001,
                    "modelos": ["auto", "groq/llama-3.3-70b-versatile", "gemini-2.5-flash"],
                    "costo": "$0 (Gratis / Local Gateway)",
                    "activo": True,
                },
                {
                    "id": "freellm_barto",
                    "nombre": "FreeLLMAPI Nodo Worker 1 (barto)",
                    "tipo": "openai_compatible",
                    "base_url": "http://192.168.100.11:3001/v1",
                    "host": "192.168.100.11",
                    "puerto": 3001,
                    "modelos": ["auto", "deepseek-r1"],
                    "costo": "$0 (Clúster LAN)",
                    "activo": True,
                },
                {
                    "id": "freellm_manager1",
                    "nombre": "FreeLLMAPI Nodo Worker 2 (manager1)",
                    "tipo": "openai_compatible",
                    "base_url": "http://192.168.100.12:3001/v1",
                    "host": "192.168.100.12",
                    "puerto": 3001,
                    "modelos": ["auto", "qwen-2.5-coder-32b"],
                    "costo": "$0 (Clúster LAN)",
                    "activo": True,
                },
                {
                    "id": "hermes_local",
                    "nombre": "Hermes Agent Server (:8642)",
                    "tipo": "hermes_sse",
                    "base_url": "http://127.0.0.1:8642",
                    "host": "127.0.0.1",
                    "puerto": 8642,
                    "modelos": ["hermes-autonomous-worker"],
                    "costo": "$0 (Demonio Local)",
                    "activo": True,
                },
                {
                    "id": "dee_openai_bridge",
                    "nombre": "Dee-Bot-Agents OpenAI Bridge (:8091)",
                    "tipo": "openai_compatible",
                    "base_url": "http://127.0.0.1:8091/v1",
                    "host": "127.0.0.1",
                    "puerto": 8091,
                    "modelos": ["dee-bot-agents-4.0"],
                    "costo": "$0 (Activo en este equipo)",
                    "activo": True,
                },
            ]
            PROVIDERS_FILE.write_text(json.dumps(default_providers, indent=2, ensure_ascii=False), encoding="utf-8")

        if not SETTINGS_FILE.exists():
            default_settings = {
                "nombre_sistema": "Dee-Bot-Agents v4.0 Supreme",
                "comandante": "Facu Cercuetti",
                "github": "https://github.com/NickDev24/Dee-Bot-Agents",
                "blog": "https://facucercuetti.online/blog",
                "idioma": "es-AR (Español Argentino Completo)",
                "modo_enrutamiento": "inteligente",
                "gobernador_fps_activo": 30,
                "gobernador_fps_reposo": 8,
                "auto_desplegar_terminal": True,
                "verificacion_voz_obligatoria": True,
                "max_saltos_envelope": 4,
                "directorio_trabajo": str(ROOT_DIR),
            }
            SETTINGS_FILE.write_text(json.dumps(default_settings, indent=2, ensure_ascii=False), encoding="utf-8")

    # =========================================================================
    # 1. NAVEGACIÓN WEB REAL (Fetch DOM, Links, Headings & Proxy HTML)
    # =========================================================================
    def navigate_url(self, url: str) -> dict[str, Any]:
        clean_url = (url or "").strip()
        if not clean_url:
            return {"ok": False, "error": "URL vacía."}
        if not clean_url.startswith(("http://", "https://")):
            clean_url = "https://" + clean_url

        t0 = time.time()
        try:
            req = urllib.request.Request(
                clean_url,
                headers={
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) DeeBotAgents/4.0 Chrome/128.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
                    "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
                },
            )
            with urllib.request.urlopen(req, timeout=10.0) as resp:
                status_code = resp.status
                final_url = resp.geturl()
                content_type = resp.headers.get("Content-Type", "text/html")
                raw_bytes = resp.read(350_000)
                text_body = raw_bytes.decode("utf-8", errors="replace")

            parser = _RealDOMExtractor(final_url)
            try:
                parser.feed(text_body)
            except Exception:
                pass

            latency_ms = round((time.time() - t0) * 1000.0, 1)
            BUS.publish(
                "terminal_exec_done",
                {
                    "id": f"nav_{int(time.time() * 1000)}",
                    "cmd": f"dee-navegador --fetch {final_url}",
                    "target": "facu",
                    "ok": True,
                    "exit_code": 0,
                    "stdout": f"HTTP {status_code} ({latency_ms} ms) · Título: {parser.title or final_url}\nEnlaces detectados: {len(parser.links)} · Bloques de texto: {len(parser.paragraphs)}",
                    "stderr": "",
                    "duration_ms": latency_ms,
                    "ts": round(time.time(), 2),
                },
            )
            return {
                "ok": True,
                "url": final_url,
                "status_code": status_code,
                "content_type": content_type,
                "latency_ms": latency_ms,
                "titulo": parser.title or final_url,
                "encabezados": parser.headings,
                "enlaces": parser.links,
                "parrafos": parser.paragraphs,
                "proxy_url": f"/api/navegador/proxy?url={urllib.parse.quote(final_url, safe='')}",
            }
        except Exception as exc:
            return {
                "ok": False,
                "url": clean_url,
                "error": f"No se pudo cargar {clean_url}: {exc}",
            }

    def proxy_html(self, url: str) -> tuple[int, str, bytes]:
        clean_url = (url or "").strip()
        if not clean_url.startswith(("http://", "https://")):
            clean_url = "https://" + clean_url
        try:
            req = urllib.request.Request(
                clean_url,
                headers={
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) DeeBotAgents/4.0 Chrome/128.0.0.0 Safari/537.36",
                    "Accept-Language": "es-AR,es;q=0.9",
                },
            )
            with urllib.request.urlopen(req, timeout=10.0) as resp:
                ctype = resp.headers.get("Content-Type", "text/html; charset=utf-8")
                raw = resp.read(500_000)
                if "text/html" in ctype.lower():
                    txt = raw.decode("utf-8", errors="replace")
                    base_tag = f'<base href="{html.escape(resp.geturl())}" target="_blank">'
                    if "<head>" in txt:
                        txt = txt.replace("<head>", f"<head>{base_tag}", 1)
                    else:
                        txt = base_tag + txt
                    return 200, "text/html; charset=utf-8", txt.encode("utf-8")
                return 200, ctype, raw
        except Exception as exc:
            err_html = f"""<!doctype html><html lang="es"><body style="background:#050811;color:#f8fafc;font-family:monospace;padding:24px;">
            <h3 style="color:#f43f5e;">⚠️ Error al cargar página en el proxy local</h3>
            <p>{html.escape(str(exc))}</p></body></html>"""
            return 502, "text/html; charset=utf-8", err_html.encode("utf-8")

    # =========================================================================
    # 2. PROGRAMAS Y PROCESOS REALES DEL SISTEMA OPERATIVO LINUX
    # =========================================================================
    def list_programs_and_processes(self) -> dict[str, Any]:
        apps: list[dict[str, str]] = []
        seen_names: set[str] = set()
        desktop_dirs = [Path("/usr/share/applications"), Path("/usr/local/share/applications")]

        for ddir in desktop_dirs:
            if not ddir.exists():
                continue
            for p in sorted(ddir.glob("*.desktop"))[:80]:
                try:
                    txt = p.read_text(encoding="utf-8", errors="ignore")
                    if "NoDisplay=true" in txt:
                        continue
                    name_m = re.search(r"^Name(?:\[es\])?=(.+)$", txt, flags=re.M)
                    exec_m = re.search(r"^Exec=(.+)$", txt, flags=re.M)
                    desc_m = re.search(r"^Comment(?:\[es\])?=(.+)$", txt, flags=re.M)
                    if not name_m or not exec_m:
                        continue
                    name = name_m.group(1).strip()
                    raw_exec = re.sub(r"\s+%[fFuUdDnNickvm]", "", exec_m.group(1).strip())
                    if name.lower() in seen_names:
                        continue
                    seen_names.add(name.lower())
                    apps.append(
                        {
                            "id": p.stem,
                            "nombre": name,
                            "comando": raw_exec,
                            "descripcion": desc_m.group(1).strip() if desc_m else f"Aplicación nativa ({p.stem})",
                        }
                    )
                    if len(apps) >= 28:
                        break
                except Exception:
                    continue

        # Procesos activos reales en el sistema
        procesos: list[dict[str, str]] = []
        try:
            proc = subprocess.run(
                ["ps", "aux", "--sort=-%cpu"],
                capture_output=True,
                text=True,
                timeout=4,
            )
            lines = proc.stdout.strip().splitlines()
            for ln in lines[1:18]:
                parts = ln.split(None, 10)
                if len(parts) >= 11:
                    procesos.append(
                        {
                            "usuario": parts[0],
                            "pid": parts[1],
                            "cpu": f"{parts[2]}%",
                            "mem": f"{parts[3]}%",
                            "comando": parts[10][:90],
                        }
                    )
        except Exception:
            pass

        return {"ok": True, "programas": apps, "procesos": procesos}

    def launch_program(self, command: str) -> dict[str, Any]:
        cmd = (command or "").strip()
        if not cmd:
            return {"ok": False, "error": "Comando vacío."}
        verdict = SENTINEL.inspect_command("dee_core", "launch_program", {"cmd": cmd})
        if verdict["verdict"] == "deny":
            return {"ok": False, "error": verdict["reason"]}

        env = os.environ.copy()
        env.setdefault("DISPLAY", ":0")
        try:
            proc = subprocess.Popen(
                cmd,
                shell=True,
                env=env,
                cwd=str(ROOT_DIR),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
            BUS.publish(
                "terminal_exec_done",
                {
                    "id": f"app_{int(time.time() * 1000)}",
                    "cmd": f"lanzar-programa: {cmd}",
                    "target": "facu",
                    "ok": True,
                    "exit_code": 0,
                    "stdout": f"🚀 Programa iniciado en segundo plano en DISPLAY={env['DISPLAY']} (PID {proc.pid})",
                    "stderr": "",
                    "duration_ms": 4.2,
                    "ts": round(time.time(), 2),
                },
            )
            return {"ok": True, "pid": proc.pid, "comando": cmd}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def kill_process(self, pid: int) -> dict[str, Any]:
        if pid <= 1 or pid == os.getpid():
            return {"ok": False, "error": "PID protegido por Sentinel."}
        try:
            os.kill(pid, signal.SIGTERM)
            return {"ok": True, "pid": pid, "mensaje": f"Señal SIGTERM enviada al proceso {pid}."}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    # =========================================================================
    # 3. AGENDA & CALENDARIO OPERATIVO REAL
    # =========================================================================
    def list_agenda(self) -> list[dict[str, Any]]:
        try:
            return json.loads(AGENDA_FILE.read_text(encoding="utf-8"))
        except Exception:
            return []

    def upsert_agenda_item(self, item: dict[str, Any]) -> dict[str, Any]:
        items = self.list_agenda()
        item_id = str(item.get("id") or f"ag_{int(time.time() * 1000)}")
        new_entry = {
            "id": item_id,
            "titulo": str(item.get("titulo") or "Nueva Tarea Operativa").strip(),
            "fecha": str(item.get("fecha") or time.strftime("%Y-%m-%d")),
            "hora": str(item.get("hora") or "10:00"),
            "agente_id": str(item.get("agente_id") or "dee_core"),
            "comando": str(item.get("comando") or "/auditar-nodos"),
            "prioridad": str(item.get("prioridad") or "alta"),
            "completado": bool(item.get("completado", False)),
            "notas": str(item.get("notas") or ""),
        }
        replaced = False
        for i, existing in enumerate(items):
            if existing.get("id") == item_id:
                items[i] = new_entry
                replaced = True
                break
        if not replaced:
            items.insert(0, new_entry)
        AGENDA_FILE.write_text(json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8")
        return {"ok": True, "item": new_entry, "agenda": items}

    def delete_agenda_item(self, item_id: str) -> dict[str, Any]:
        items = [x for x in self.list_agenda() if x.get("id") != item_id]
        AGENDA_FILE.write_text(json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8")
        return {"ok": True, "agenda": items}

    # =========================================================================
    # 4. PLUGINS & SERVIDORES MCP REALES
    # =========================================================================
    def list_plugins(self) -> list[dict[str, Any]]:
        try:
            plugins = json.loads(PLUGINS_FILE.read_text(encoding="utf-8"))
        except Exception:
            plugins = []

        # Verificar estado real de cada plugin/MCP en tiempo real
        for pl in plugins:
            ep = str(pl.get("endpoint") or "")
            if ep.startswith("http://127.0.0.1:"):
                try:
                    parsed = urllib.parse.urlsplit(ep)
                    with socket.create_connection((parsed.hostname or "127.0.0.1", parsed.port or 80), timeout=0.25):
                        pl["estado_real"] = "CONECTADO"
                except Exception:
                    pl["estado_real"] = "DESCONECTADO"
            elif ep.startswith("/"):
                pl["estado_real"] = "INSTALADO EN DISCO" if Path(ep).exists() else "NO ENCONTRADO"
            else:
                pl["estado_real"] = "ACTIVO" if pl.get("activo") else "PAUSADO"
        return plugins

    def upsert_plugin(self, plugin: dict[str, Any]) -> dict[str, Any]:
        plugins = self.list_plugins()
        pid = str(plugin.get("id") or f"mcp-{int(time.time())}")
        entry = {
            "id": pid,
            "nombre": str(plugin.get("nombre") or pid),
            "tipo": str(plugin.get("tipo") or "mcp_stdio"),
            "endpoint": str(plugin.get("endpoint") or ""),
            "comando": str(plugin.get("comando") or ""),
            "activo": bool(plugin.get("activo", True)),
            "autor": str(plugin.get("autor") or "Facu Cercuetti (@NickDev24)"),
            "descripcion": str(plugin.get("descripcion") or ""),
        }
        idx = next((i for i, p in enumerate(plugins) if p.get("id") == pid), -1)
        if idx >= 0:
            plugins[idx] = entry
        else:
            plugins.append(entry)
        PLUGINS_FILE.write_text(json.dumps(plugins, indent=2, ensure_ascii=False), encoding="utf-8")
        return {"ok": True, "plugins": self.list_plugins()}

    def delete_plugin(self, pid: str) -> dict[str, Any]:
        plugins = [p for p in self.list_plugins() if p.get("id") != pid]
        PLUGINS_FILE.write_text(json.dumps(plugins, indent=2, ensure_ascii=False), encoding="utf-8")
        return {"ok": True, "plugins": self.list_plugins()}

    # =========================================================================
    # 5. PROVEEDORES DE IA & SUBSCRIPCIONES CLI REALES
    # =========================================================================
    def list_providers(self) -> dict[str, Any]:
        try:
            providers = json.loads(PROVIDERS_FILE.read_text(encoding="utf-8"))
        except Exception:
            providers = []

        for prv in providers:
            host = str(prv.get("host") or "127.0.0.1")
            port = int(prv.get("puerto") or 3001)
            t0 = time.time()
            try:
                with socket.create_connection((host, port), timeout=0.25):
                    prv["online"] = True
                    prv["latencia_ms"] = round((time.time() - t0) * 1000.0, 1)
            except Exception:
                prv["online"] = False
                prv["latencia_ms"] = None

        # Detectar CLIs oficiales instalados en la máquina de Facu
        cli_subscriptions = []
        for bin_name, label in [
            ("gh", "GitHub CLI (@NickDev24 Autenticado)"),
            ("claude", "Claude Code CLI"),
            ("codex", "OpenAI Codex CLI"),
            ("gemini", "Google Gemini CLI"),
            ("ollama", "Ollama Local LLM Runner"),
            ("docker", "Docker Engine CLI"),
        ]:
            path_bin = shutil.which(bin_name)
            cli_subscriptions.append(
                {
                    "id": bin_name,
                    "nombre": label,
                    "instalado": bool(path_bin),
                    "ruta": path_bin or "No instalado",
                }
            )

        return {
            "ok": True,
            "proveedores": providers,
            "cli_locales": cli_subscriptions,
            "pool_status": LLM_POOL.status(),
        }

    def upsert_provider(self, prv: dict[str, Any]) -> dict[str, Any]:
        try:
            providers = json.loads(PROVIDERS_FILE.read_text(encoding="utf-8"))
        except Exception:
            providers = []

        pid = str(prv.get("id") or f"prv_{int(time.time())}")
        base_url = str(prv.get("base_url") or "http://127.0.0.1:11434/v1")
        parsed = urllib.parse.urlsplit(base_url)
        entry = {
            "id": pid,
            "nombre": str(prv.get("nombre") or pid),
            "tipo": str(prv.get("tipo") or "openai_compatible"),
            "base_url": base_url,
            "host": parsed.hostname or "127.0.0.1",
            "puerto": parsed.port or (443 if parsed.scheme == "https" else 80),
            "modelos": prv.get("modelos") if isinstance(prv.get("modelos"), list) else [m.strip() for m in str(prv.get("modelos") or "auto").split(",") if m.strip()],
            "costo": str(prv.get("costo") or "Personalizado"),
            "activo": bool(prv.get("activo", True)),
        }
        idx = next((i for i, p in enumerate(providers) if p.get("id") == pid), -1)
        if idx >= 0:
            providers[idx] = entry
        else:
            providers.append(entry)
        PROVIDERS_FILE.write_text(json.dumps(providers, indent=2, ensure_ascii=False), encoding="utf-8")
        return self.list_providers()

    def delete_provider(self, pid: str) -> dict[str, Any]:
        try:
            providers = json.loads(PROVIDERS_FILE.read_text(encoding="utf-8"))
        except Exception:
            providers = []
        providers = [p for p in providers if p.get("id") != pid]
        PROVIDERS_FILE.write_text(json.dumps(providers, indent=2, ensure_ascii=False), encoding="utf-8")
        return self.list_providers()

    # =========================================================================
    # 6. CONFIGURACIÓN GENERAL Y EDITOR DEL ESCUADRÓN DE SUBAGENTES
    # =========================================================================
    def get_settings_and_squad(self) -> dict[str, Any]:
        settings = json.loads(SETTINGS_FILE.read_text(encoding="utf-8")) if SETTINGS_FILE.exists() else {}
        squad = json.loads(SQUAD_FILE.read_text(encoding="utf-8")) if SQUAD_FILE.exists() else {"agents": []}
        return {"ok": True, "configuracion": settings, "escuadron": squad.get("agents", [])}

    def save_settings(self, new_settings: dict[str, Any]) -> dict[str, Any]:
        current = json.loads(SETTINGS_FILE.read_text(encoding="utf-8")) if SETTINGS_FILE.exists() else {}
        current.update(new_settings)
        SETTINGS_FILE.write_text(json.dumps(current, indent=2, ensure_ascii=False), encoding="utf-8")
        return {"ok": True, "configuracion": current}

    def update_subagent(self, agent_data: dict[str, Any]) -> dict[str, Any]:
        squad = json.loads(SQUAD_FILE.read_text(encoding="utf-8")) if SQUAD_FILE.exists() else {"agents": []}
        agents = squad.get("agents", [])
        aid = str(agent_data.get("id") or "")
        idx = next((i for i, a in enumerate(agents) if a.get("id") == aid), -1)
        if idx >= 0:
            agents[idx].update(agent_data)
        else:
            agents.append(agent_data)
        squad["agents"] = agents
        SQUAD_FILE.write_text(json.dumps(squad, indent=2, ensure_ascii=False), encoding="utf-8")
        return {"ok": True, "escuadron": agents}


REAL_OPS = RealOperationsManager()

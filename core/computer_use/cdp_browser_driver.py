"""DRIVER NATIVO CDP (CHROME DEVTOOLS PROTOCOL) & AUTOMATIZACIÓN WEB PROFUNDA.
Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog

Inspirado en `grok-bot-cli/src/core/chatgpt-desktop/cdp-dom.ts` y `cdp-session.ts`, pero ampliado
para que Dee-Bot-Agents controle cualquier sitio web o aplicación Electron/Chrome en tiempo real:
1. Descubrimiento e inspección de pestañas CDP activas (`http://127.0.0.1:9222/json/list`).
2. Lanzamiento bajo demanda de Google Chrome con puerto de depuración CDP (`--remote-debugging-port=9222`)
   y perfil persistente local (`data/chrome_profile`).
3. Mapeador de Elementos Interactivos DOM con referencias `@ref` (`@n1`, `@n2`...) para formularios,
   botones, campos de texto y enlaces.
4. Captura visual real de páginas web (`google-chrome --headless --screenshot`) en `<1.5s`.
5. Sesiones HTTP/HTTPS con `CookieJar` persistente para mantener logins y enviar formularios POST.
"""
from __future__ import annotations

import http.cookiejar
import json
import os
import re
import shutil
import subprocess
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

from ..events import BUS

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT_DIR / "data"
COOKIE_FILE = DATA_DIR / "dee_browser_cookies.txt"
CHROME_PROFILE_DIR = DATA_DIR / "chrome_cdp_profile"
WEB_SHOT_PATH = Path("/tmp/dee_web_screenshot.png")


class _InteractiveMapParser(HTMLParser):
    """Extrae todos los elementos interactivos (`a`, `button`, `input`, `select`, `textarea`) con `@ref`."""

    def __init__(self, base_url: str):
        super().__init__()
        self.base_url = base_url
        self.elements: list[dict[str, Any]] = []
        self._counter = 0
        self._active_el: dict[str, Any] | None = None
        self._buf: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        t = tag.lower()
        ad = {k.lower(): (v or "") for k, v in attrs}
        if t in ("a", "button", "input", "select", "textarea"):
            self._counter += 1
            ref = f"@n{self._counter}"
            selector = (
                f"#{ad['id']}"
                if ad.get("id")
                else (
                    f"{t}[name='{ad['name']}']"
                    if ad.get("name")
                    else f"{t}:nth-of-type({self._counter})"
                )
            )
            el = {
                "ref": ref,
                "tag": t,
                "tipo": ad.get("type", t),
                "selector": selector,
                "nombre": ad.get("name") or ad.get("id") or ad.get("aria-label") or "",
                "placeholder": ad.get("placeholder") or "",
                "href": urllib.parse.urljoin(self.base_url, ad["href"]) if ad.get("href") else "",
                "texto": ad.get("value") or ad.get("aria-label") or "",
            }
            if t == "input":
                if len(self.elements) < 60:
                    self.elements.append(el)
            else:
                self._active_el = el
                self._buf = []

    def handle_data(self, data: str) -> None:
        if self._active_el is not None:
            cleaned = " ".join(data.split())
            if cleaned:
                self._buf.append(cleaned)

    def handle_endtag(self, tag: str) -> None:
        if self._active_el is not None and tag.lower() == self._active_el["tag"]:
            txt = " ".join(self._buf).strip()
            if txt:
                self._active_el["texto"] = txt[:90]
            if len(self.elements) < 60 and (self._active_el["texto"] or self._active_el["href"] or self._active_el["nombre"]):
                self.elements.append(self._active_el)
            self._active_el = None
            self._buf = []


class CDPBrowserDriver:
    def __init__(self, cdp_port: int = 9222) -> None:
        self.cdp_port = cdp_port
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.cookie_jar = http.cookiejar.MozillaCookieJar(str(COOKIE_FILE))
        if COOKIE_FILE.exists():
            try:
                self.cookie_jar.load(ignore_discard=True, ignore_expires=True)
            except Exception:
                pass
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookie_jar))
        self.opener.addheaders = [
            (
                "User-Agent",
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) DeeBotAgents/4.0 Chrome/128.0.0.0 Safari/537.36",
            ),
            ("Accept-Language", "es-AR,es;q=0.9,en;q=0.8"),
        ]

    def list_cdp_targets(self) -> dict[str, Any]:
        """Consulta las pestañas abiertas en el puerto CDP (`:9222`)."""
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{self.cdp_port}/json/list", method="GET")
            with urllib.request.urlopen(req, timeout=0.6) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
                tabs = [
                    {
                        "id": t.get("id"),
                        "titulo": t.get("title"),
                        "url": t.get("url"),
                        "tipo": t.get("type"),
                        "ws_debugger": t.get("webSocketDebuggerUrl"),
                    }
                    for t in raw
                    if t.get("type") == "page"
                ]
                return {"ok": True, "cdp_activo": True, "puerto": self.cdp_port, "pestanas": tabs}
        except Exception:
            return {"ok": True, "cdp_activo": False, "puerto": self.cdp_port, "pestanas": []}

    def launch_cdp_browser(self, start_url: str = "https://facucercuetti.online/blog") -> dict[str, Any]:
        """Lanza Google Chrome con `--remote-debugging-port=9222` en el escritorio X11."""
        chrome_bin = shutil.which("google-chrome") or shutil.which("chromium")
        if not chrome_bin:
            return {"ok": False, "error": "No se encontró Google Chrome o Chromium instalado."}
        CHROME_PROFILE_DIR.mkdir(parents=True, exist_ok=True)
        env = os.environ.copy()
        env.setdefault("DISPLAY", ":0")
        proc = subprocess.Popen(
            [
                chrome_bin,
                f"--remote-debugging-port={self.cdp_port}",
                f"--user-data-dir={CHROME_PROFILE_DIR}",
                "--no-first-run",
                "--no-default-browser-check",
                start_url,
            ],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        time.sleep(0.8)
        return {
            "ok": True,
            "pid": proc.pid,
            "puerto_cdp": self.cdp_port,
            "url": start_url,
            "estado": self.list_cdp_targets(),
        }

    def inspect_interactive_map(self, url: str, method: str = "GET", form_data: dict[str, Any] | None = None) -> dict[str, Any]:
        """Carga una URL con persistencia de cookies y devuelve el mapa `@ref` de todos sus controles interactivos."""
        clean_url = (url or "").strip()
        if not clean_url.startswith(("http://", "https://")):
            clean_url = "https://" + clean_url

        t0 = time.time()
        try:
            encoded_data = None
            if method.upper() == "POST" and form_data:
                encoded_data = urllib.parse.urlencode(form_data).encode("utf-8")
            req = urllib.request.Request(clean_url, data=encoded_data, method=method.upper())
            with self.opener.open(req, timeout=10.0) as resp:
                final_url = resp.geturl()
                status_code = resp.status
                raw_html = resp.read(350_000).decode("utf-8", errors="replace")

            try:
                self.cookie_jar.save(ignore_discard=True, ignore_expires=True)
            except Exception:
                pass

            mapper = _InteractiveMapParser(final_url)
            try:
                mapper.feed(raw_html)
            except Exception:
                pass

            title_m = re.search(r"<title[^>]*>(.*?)</title>", raw_html, flags=re.I | re.S)
            title = " ".join(title_m.group(1).split())[:140] if title_m else final_url
            dur_ms = round((time.time() - t0) * 1000.0, 1)

            BUS.publish(
                "terminal_exec_done",
                {
                    "id": f"cdp_map_{int(time.time() * 1000)}",
                    "cmd": f"dee-cdp-driver --read-map {final_url}",
                    "target": "facu",
                    "ok": True,
                    "exit_code": 0,
                    "stdout": f"🌐 Mapa DOM extraído ({dur_ms} ms): {len(mapper.elements)} elementos interactivos (@n1..@n{len(mapper.elements)}) · Cookies en sesión: {len(self.cookie_jar)}",
                    "stderr": "",
                    "duration_ms": dur_ms,
                    "ts": round(time.time(), 2),
                },
            )
            return {
                "ok": True,
                "url": final_url,
                "status_code": status_code,
                "titulo": title,
                "latencia_ms": dur_ms,
                "cookies_activas": len(self.cookie_jar),
                "elementos_interactivos": mapper.elements,
            }
        except Exception as exc:
            return {"ok": False, "url": clean_url, "error": str(exc)}

    def capture_web_screenshot(self, url: str) -> dict[str, Any]:
        """Renderiza una captura PNG real de cualquier sitio web usando Google Chrome Headless."""
        chrome_bin = shutil.which("google-chrome") or shutil.which("chromium")
        if not chrome_bin:
            return {"ok": False, "error": "Google Chrome no disponible para captura headless"}
        clean_url = (url or "").strip()
        if not clean_url.startswith(("http://", "https://")):
            clean_url = "https://" + clean_url
        t0 = time.time()
        try:
            subprocess.run(
                [
                    chrome_bin,
                    "--headless=new",
                    "--no-sandbox",
                    "--disable-gpu",
                    "--window-size=1280,800",
                    f"--screenshot={WEB_SHOT_PATH}",
                    clean_url,
                ],
                timeout=12,
                capture_output=True,
            )
            if WEB_SHOT_PATH.exists():
                return {
                    "ok": True,
                    "url": clean_url,
                    "screenshot_url": f"/api/navegador/screenshot.png?t={int(time.time() * 1000)}",
                    "latencia_ms": round((time.time() - t0) * 1000.0, 1),
                }
            return {"ok": False, "error": "No se generó el archivo de captura"}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}


CDP_DRIVER = CDPBrowserDriver()

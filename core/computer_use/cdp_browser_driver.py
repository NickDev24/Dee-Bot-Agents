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
from .cdp_ws import CDPSession, CDPWebSocketError

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT_DIR / "data"
COOKIE_FILE = DATA_DIR / "dee_browser_cookies.txt"
CHROME_PROFILE_DIR = DATA_DIR / "chrome_cdp_profile"
WEB_SHOT_PATH = Path("/tmp/dee_web_screenshot.png")

# Extracción real por DevTools Protocol: se ejecuta DENTRO de la página ya renderizada,
# así que incluye nodos creados por JavaScript que el HTML crudo no contiene.
CDP_MAP_EXPRESSION = r"""
(() => {
  const toSelector = (el) => {
    const tag = el.tagName.toLowerCase();
    if (el.id) return '#' + el.id;
    if (el.getAttribute('name')) return tag + "[name='" + el.getAttribute('name') + "']";
    let idx = 1;
    let prev = el;
    while ((prev = prev.previousElementSibling)) {
      if (prev.tagName === el.tagName) idx++;
    }
    return tag + ':nth-of-type(' + idx + ')';
  };
  const nodes = Array.from(document.querySelectorAll('a,button,input,select,textarea')).slice(0, 80);
  const elementos = nodes.map((el, i) => ({
    ref: '@n' + (i + 1),
    tag: el.tagName.toLowerCase(),
    tipo: (el.getAttribute('type') || el.tagName).toLowerCase(),
    selector: toSelector(el),
    nombre: el.getAttribute('name') || el.id || el.getAttribute('aria-label') || '',
    placeholder: el.getAttribute('placeholder') || '',
    href: el.href || '',
    texto: (el.innerText || el.value || el.getAttribute('aria-label') || '')
      .replace(/\s+/g, ' ').trim().slice(0, 90),
  }));
  return JSON.stringify({
    titulo: document.title,
    url: location.href,
    readyState: document.readyState,
    elementos,
  });
})()
"""


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
        # Último mapa @ref capturado (para poder actuar sobre un @ref sin re-mapear)
        self._last_map: dict[str, Any] | None = None

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

    def _pick_page_target(self, url: str) -> dict[str, Any] | None:
        """Elige la pestaña CDP a usar: la que ya está en el mismo sitio o la primera disponible."""
        info = self.list_cdp_targets()
        if not info.get("cdp_activo"):
            return None
        tabs = [t for t in (info.get("pestanas") or []) if t.get("ws_debugger")]
        if not tabs:
            return None
        requested = urllib.parse.urlparse(url)
        for tab in tabs:
            tab_url = urllib.parse.urlparse(str(tab.get("url") or ""))
            if tab_url.netloc and tab_url.netloc == requested.netloc:
                return tab
        return tabs[0]

    def map_via_cdp(self, url: str) -> dict[str, Any]:
        """Mapea el DOM renderizado en Chrome real vía WebSocket CDP (incluye nodos creados por JS)."""
        target = self._pick_page_target(url)
        if not target:
            raise CDPWebSocketError("No hay pestaña CDP abierta en :9222")
        session = CDPSession(str(target["ws_debugger"]))
        try:
            current = str(target.get("url") or "")
            needs_nav = not current.startswith(("http://", "https://")) or current.split("#")[0] != url.split("#")[0]
            if needs_nav:
                session.navigate(url, timeout=8.0)
            time.sleep(0.35)  # deja correr el JS diferido de la página antes de mapear
            raw = session.evaluate(CDP_MAP_EXPRESSION)
            payload = json.loads(raw) if isinstance(raw, str) and raw else {}
            return {
                "titulo": payload.get("titulo") or url,
                "url": payload.get("url") or url,
                "elementos": payload.get("elementos") or [],
                "navegada": bool(needs_nav),
            }
        finally:
            session.close()

    def _publicar_mapa(self, url: str, total: int, dur_ms: float, motor: str) -> None:
        BUS.publish(
            "terminal_exec_done",
            {
                "id": f"cdp_map_{int(time.time() * 1000)}",
                "cmd": f"dee-cdp-driver --read-map {url} ({motor})",
                "target": "facu",
                "ok": True,
                "exit_code": 0,
                "stdout": (
                    f"🌐 Mapa DOM extraído vía {motor} ({dur_ms} ms): {total} elementos interactivos "
                    f"(@n1..@n{total}) · Cookies en sesión: {len(self.cookie_jar)}"
                ),
                "stderr": "",
                "duration_ms": dur_ms,
                "ts": round(time.time(), 2),
            },
        )

    def inspect_interactive_map(self, url: str, method: str = "GET", form_data: dict[str, Any] | None = None) -> dict[str, Any]:
        """Devuelve el mapa `@ref` de controles interactivos.

        Camino principal: Chrome real por WebSocket CDP (`Runtime.evaluate` sobre el DOM
        ya renderizado, así entran botones/links creados por JavaScript).
        Respaldo: parseo del HTML crudo vía HTTP si no hay pestaña CDP o falla el socket.
        """
        clean_url = (url or "").strip()
        if not clean_url.startswith(("http://", "https://")):
            clean_url = "https://" + clean_url

        t0 = time.time()
        cdp_error = ""
        try:
            cdp_map = self.map_via_cdp(clean_url)
            dur_ms = round((time.time() - t0) * 1000.0, 1)
            self._publicar_mapa(cdp_map["url"], len(cdp_map["elementos"]), dur_ms, motor="cdp-websocket")
            self._last_map = {"url": cdp_map["url"], "elementos": cdp_map["elementos"]}
            return {
                "ok": True,
                "motor": "cdp-websocket",
                "url": cdp_map["url"],
                "status_code": 200,
                "titulo": cdp_map["titulo"],
                "latencia_ms": dur_ms,
                "cookies_activas": len(self.cookie_jar),
                "elementos_interactivos": cdp_map["elementos"],
                "pestana_cdp": True,
                "navegada": cdp_map.get("navegada", False),
            }
        except Exception as exc:
            cdp_error = str(exc)

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

            self._publicar_mapa(final_url, len(mapper.elements), dur_ms, motor="http-fallback")
            self._last_map = {"url": final_url, "elementos": mapper.elements}
            return {
                "ok": True,
                "motor": "http-fallback",
                "cdp_error": cdp_error,
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


    # ----------------------------------------------------------------------
    # 6. ACCIONES REALES SOBRE LA PÁGINA POR @ref (CDP Input.* / Runtime.*)
    # ----------------------------------------------------------------------
    def _normalizar_ref(self, ref: str) -> str:
        r = str(ref or "").strip()
        if r and not r.startswith("@"):
            r = "@" + r
        return r

    def _resolver_elemento(self, ref: str, url: str | None = None) -> dict[str, Any] | None:
        ref = self._normalizar_ref(ref)
        if self._last_map is None or (url and self._last_map.get("url") != url):
            target_url = url or (self._last_map.get("url") if self._last_map else None)
            if target_url:
                try:
                    self.inspect_interactive_map(target_url)
                except Exception:
                    pass
        if not self._last_map:
            return None
        for el in self._last_map.get("elementos") or []:
            if str(el.get("ref")) == ref:
                return el
        return None

    def _abrir_sesion(self, url: str | None = None) -> tuple[CDPSession, dict[str, Any]]:
        target = None
        if url:
            target = self._pick_page_target(url)
        if target is None and self._last_map and self._last_map.get("url"):
            target = self._pick_page_target(str(self._last_map["url"]))
        if target is None:
            info = self.list_cdp_targets()
            tabs = [t for t in (info.get("pestanas") or []) if t.get("ws_debugger")]
            target = tabs[0] if tabs else None
        if not target or not target.get("ws_debugger"):
            raise CDPWebSocketError("No hay pestaña CDP disponible en :9222")
        return CDPSession(str(target["ws_debugger"]), timeout=6.0), target

    def click_ref(self, ref: str, button: str = "left", clicks: int = 1, url: str | None = None) -> dict[str, Any]:
        """Hace clic real sobre el elemento identificado por @ref usando CDP Input.dispatchMouseEvent."""
        el = self._resolver_elemento(ref, url)
        if not el:
            return {"ok": False, "error": f"No se encontró el elemento {ref} en el último mapa"}
        selector = str(el.get("selector") or "")
        session, target = self._abrir_sesion(url or (self._last_map.get("url") if self._last_map else None))
        try:
            rect_expr = (
                "(() => {"
                "  const el = document.querySelector(" + json.dumps(selector) + ");"
                "  if (!el) return null;"
                "  el.scrollIntoView({block:'center', inline:'center'});"
                "  const r = el.getBoundingClientRect();"
                "  return {found:true, x:r.left, y:r.top, width:r.width, height:r.height, cx:r.left+r.width/2, cy:r.top+r.height/2};"
                "})()"
            )
            rect = session.evaluate(rect_expr, timeout=6.0)
            if not isinstance(rect, dict) or not rect.get("found"):
                return {"ok": False, "ref": self._normalizar_ref(ref), "error": "El selector ya no existe en el DOM"}
            cx = float(rect["cx"])
            cy = float(rect["cy"])
            btn = button if button in ("left", "middle", "right") else "left"
            cdp_button = btn
            for _ in range(max(1, min(int(clicks or 1), 5))):
                session.call("Input.dispatchMouseEvent", {"type": "mousePressed", "x": cx, "y": cy, "button": cdp_button, "clickCount": 1}, timeout=4.0)
                session.call("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": cx, "y": cy, "button": cdp_button, "clickCount": 1}, timeout=4.0)
                time.sleep(0.05)
            return {
                "ok": True,
                "accion": "click_ref",
                "ref": self._normalizar_ref(ref),
                "selector": selector,
                "boton": btn,
                "repeticiones": max(1, min(int(clicks or 1), 5)),
                "x": round(cx, 1),
                "y": round(cy, 1),
                "elemento": {"tag": el.get("tag"), "texto": el.get("texto"), "nombre": el.get("nombre")},
            }
        except Exception as exc:
            return {"ok": False, "ref": self._normalizar_ref(ref), "error": str(exc)}
        finally:
            session.close()

    def type_ref(self, ref: str, text: str, clear: bool = False, url: str | None = None) -> dict[str, Any]:
        """Escribe texto real en el campo identificado por @ref usando CDP Input.insertText."""
        el = self._resolver_elemento(ref, url)
        if not el:
            return {"ok": False, "error": f"No se encontró el elemento {ref} en el último mapa"}
        selector = str(el.get("selector") or "")
        session, target = self._abrir_sesion(url or (self._last_map.get("url") if self._last_map else None))
        try:
            focus_expr = (
                "(() => {"
                "  const el = document.querySelector(" + json.dumps(selector) + ");"
                "  if (!el) return {found:false};"
                "  el.scrollIntoView({block:'center', inline:'center'});"
                "  el.focus();"
                + ("  el.value = '';" if clear else "") +
                "  return {found:true, tag:el.tagName.toLowerCase()};"
                "})()"
            )
            focused = session.evaluate(focus_expr, timeout=6.0)
            if not isinstance(focused, dict) or not focused.get("found"):
                return {"ok": False, "ref": self._normalizar_ref(ref), "error": "El campo ya no existe en el DOM"}
            if text:
                session.call("Input.insertText", {"text": str(text)}, timeout=6.0)
            # Disparar eventos para frameworks reactivos
            session.evaluate(
                "(() => { const el = document.querySelector(" + json.dumps(selector) + ");"
                " if (el) { el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); } })()",
                timeout=4.0,
            )
            return {
                "ok": True,
                "accion": "type_ref",
                "ref": self._normalizar_ref(ref),
                "selector": selector,
                "caracteres": len(str(text or "")),
                "limpio": bool(clear),
            }
        except Exception as exc:
            return {"ok": False, "ref": self._normalizar_ref(ref), "error": str(exc)}
        finally:
            session.close()

    def capture_page_screenshot(self, url: str | None = None) -> dict[str, Any]:
        """Captura PNG real de la pestaña renderizada usando Page.captureScreenshot de CDP."""
        session, target = self._abrir_sesion(url)
        try:
            if url:
                session.navigate(url, timeout=10.0)
                time.sleep(0.4)
            result = session.call("Page.captureScreenshot", {"format": "png"}, timeout=10.0)
            data_b64 = result.get("data") if isinstance(result, dict) else None
            if not data_b64:
                return {"ok": False, "error": "Page.captureScreenshot no devolvió datos"}
            import base64 as _b64
            raw = _b64.b64decode(data_b64)
            WEB_SHOT_PATH.write_bytes(raw)
            return {
                "ok": True,
                "accion": "screenshot_cdp",
                "url": url or (target.get("url") if isinstance(target, dict) else ""),
                "screenshot_url": f"/api/navegador/screenshot.png?t={int(time.time() * 1000)}",
                "bytes": len(raw),
                "latencia_ms": None,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}
        finally:
            session.close()


CDP_DRIVER = CDPBrowserDriver()

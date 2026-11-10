"""TESTS DE PODERES DE INTERACCIÓN CDP (`tests/test_08_cdp_interactions.py`) — DEE.

Cubre los nuevos poderes sobre páginas reales por @ref:
- `click_ref`: clic físico vía `Input.dispatchMouseEvent` sobre el rect del elemento.
- `type_ref`: escritura vía `Input.insertText` en el campo enfocado.
- `capture_page_screenshot`: captura real vía `Page.captureScreenshot`.

No requiere Chrome: usa un servidor CDP inteligente que responde según el método.
"""
from __future__ import annotations

import base64
import hashlib
import json
import socket
import struct
import sys
import threading
import time
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from core.computer_use.cdp_browser_driver import CDPBrowserDriver
from core.computer_use.cdp_ws import CDPSession, CDPWebSocketError

PAGE_HTML = b"<!doctype html><html><head><title>P</title></head><body><button id='btn'>Ok</button><input name='q'></body></html>"

PAYLOAD = {
    "titulo": "Portal de prueba",
    "url": "http://127.0.0.1:0/",
    "readyState": "complete",
    "elementos": [
        {"ref": "@n1", "tag": "button", "tipo": "button", "selector": "#btn", "nombre": "btn", "placeholder": "", "href": "", "texto": "Ok"},
        {"ref": "@n2", "tag": "input", "tipo": "text", "selector": "input[name='q']", "nombre": "q", "placeholder": "", "href": "", "texto": ""},
    ],
}


class _SmartStubCDP:
    """Servidor CDP que acepta varias conexiones y responde según el método."""

    def __init__(self) -> None:
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind(("127.0.0.1", 0))
        self.sock.listen(8)
        self.port = self.sock.getsockname()[1]
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._serve_forever, daemon=True)
        self._thread.start()

    def _serve_forever(self) -> None:
        while not self._stop.is_set():
            try:
                self.sock.settimeout(0.5)
                conn, _ = self.sock.accept()
            except socket.timeout:
                continue
            except OSError:
                break
            threading.Thread(target=self._handle_conn, args=(conn,), daemon=True).start()

    def _handle_conn(self, conn: socket.socket) -> None:
        try:
            conn.settimeout(5.0)
            raw = b""
            while b"\r\n\r\n" not in raw:
                chunk = conn.recv(4096)
                if not chunk:
                    return
                raw += chunk
            key = b""
            for line in raw.split(b"\r\n"):
                if line.lower().startswith(b"sec-websocket-key:"):
                    key = line.split(b":", 1)[1].strip()
            accept = base64.b64encode(
                hashlib.sha1(key + b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest()
            ).decode("ascii")
            conn.sendall(
                (
                    "HTTP/1.1 101 Switching Protocols\r\n"
                    "Upgrade: websocket\r\n"
                    "Connection: Upgrade\r\n"
                    f"Sec-WebSocket-Accept: {accept}\r\n\r\n"
                ).encode("ascii")
            )
            # responder a varios mensajes hasta que se cierre
            while True:
                try:
                    msg = self._read_frame(conn)
                except Exception:
                    break
                if not msg:
                    break
                try:
                    data = json.loads(msg.decode("utf-8"))
                except Exception:
                    break
                method = data.get("method", "")
                mid = data.get("id")
                result = self._respond(method, data.get("params") or {})
                resp = json.dumps({"id": mid, "result": result}).encode("utf-8")
                try:
                    conn.sendall(self._frame(resp))
                except Exception:
                    break
        finally:
            try:
                conn.close()
            except Exception:
                pass

    def _respond(self, method: str, params: dict) -> dict:
        if method == "Page.navigate":
            return {}
        if method == "Page.captureScreenshot":
            return {"data": base64.b64encode(b"PNGDATA").decode("ascii")}
        if method.startswith("Input."):
            return {}
        if method == "Runtime.evaluate":
            expr = (params.get("expression") or "")
            if "getBoundingClientRect" in expr:
                return {"result": {"type": "object", "value": {"found": True, "x": 1.0, "y": 2.0, "width": 10.0, "height": 5.0, "cx": 6.0, "cy": 4.5}}}
            if "focus()" in expr:
                return {"result": {"type": "object", "value": {"found": True, "tag": "input"}}}
            if "document.readyState" in expr and "querySelector" not in expr:
                return {"result": {"type": "string", "value": "complete"}}
            # Por defecto devolver el payload del mapa como string JSON
            return {"result": {"type": "string", "value": json.dumps(PAYLOAD)}}
        return {}

    @staticmethod
    def _read_frame(conn: socket.socket) -> bytes:
        header = conn.recv(2)
        if not header:
            return b""
        length = header[1] & 0x7F
        if length == 126:
            length = struct.unpack("!H", conn.recv(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", conn.recv(8))[0]
        mask = conn.recv(4)
        data = b""
        while len(data) < length:
            chunk = conn.recv(length - len(data))
            if not chunk:
                break
            data += chunk
        if mask and len(mask) == 4:
            data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        return data

    @staticmethod
    def _frame(payload: bytes) -> bytes:
        header = bytearray([0x81])
        if len(payload) < 126:
            header.append(len(payload))
        else:
            header.append(126)
            header += struct.pack("!H", len(payload))
        return bytes(header) + payload

    def stop(self) -> None:
        self._stop.set()
        try:
            self.sock.close()
        except Exception:
            pass


class TestCDPInteractions(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.stub = _SmartStubCDP()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.stub.stop()

    def _driver(self) -> CDPBrowserDriver:
        driver = CDPBrowserDriver(cdp_port=1)
        driver._pick_page_target = lambda url: {"ws_debugger": f"ws://127.0.0.1:{self.stub.port}/devtools/page/TEST", "url": url}  # type: ignore[assignment]
        return driver

    def test_click_ref_dispatches_mouse_events(self) -> None:
        driver = self._driver()
        driver.inspect_interactive_map("http://example.test/")
        res = driver.click_ref("@n1")
        self.assertTrue(res["ok"], res)
        self.assertEqual(res["ref"], "@n1")
        self.assertEqual(res["x"], 6.0)
        self.assertEqual(res["y"], 4.5)

    def test_type_ref_inserts_text(self) -> None:
        driver = self._driver()
        driver.inspect_interactive_map("http://example.test/")
        res = driver.type_ref("@n2", "hola", clear=True)
        self.assertTrue(res["ok"], res)
        self.assertEqual(res["caracteres"], 4)
        self.assertTrue(res["limpio"])

    def test_type_ref_unknown_ref_fails(self) -> None:
        driver = self._driver()
        driver.inspect_interactive_map("http://example.test/")
        res = driver.type_ref("@n99", "x")
        self.assertFalse(res["ok"])

    def test_capture_page_screenshot_writes_file(self) -> None:
        driver = self._driver()
        res = driver.capture_page_screenshot("http://example.test/")
        self.assertTrue(res["ok"], res)
        from pathlib import Path
        self.assertTrue(Path("/tmp/dee_web_screenshot.png").exists())

    def test_click_ref_unknown_ref_fails(self) -> None:
        driver = self._driver()
        driver.inspect_interactive_map("http://example.test/")
        res = driver.click_ref("@n99")
        self.assertFalse(res["ok"])


if __name__ == "__main__":
    unittest.main()

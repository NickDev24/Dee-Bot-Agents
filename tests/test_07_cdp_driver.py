"""TESTS DEL DRIVER CDP REAL (`tests/test_07_cdp_driver.py`) — DEE (Distributed Emergent Engine).
Autor: Facu Cercuetti (@NickDev24)

Cubre:
- Handshake y framing WebSocket de `core.computer_use.cdp_ws` contra un servidor CDP simulado.
- `CDPBrowserDriver.map_via_cdp` devolviendo el mapa `@ref` con `motor="cdp-websocket"`.
- Respaldo HTTP determinista cuando no hay pestaña CDP disponible (`motor="http-fallback"`).

No requiere Chrome: el servidor WebSocket de prueba habla lo mínimo de RFC 6455 y
responde `Runtime.evaluate` con un payload CDP válido.
"""
from __future__ import annotations

import base64
import hashlib
import json
import socket
import struct
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from core.computer_use.cdp_browser_driver import CDPBrowserDriver
from core.computer_use.cdp_ws import CDPSession, CDPWebSocketError

PAGE_HTML = b"""<!doctype html><html><head><title>Portal de prueba</title></head><body>
<form><input name="q" placeholder="Buscar"></form>
<button id="btn-ok">Aceptar</button>
</body></html>"""


class _StubCDPServer:
    """Servidor WebSocket mínimo que responde `Runtime.evaluate` como Chrome."""

    def __init__(self, payload: dict) -> None:
        self.payload = payload
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind(("127.0.0.1", 0))
        self.sock.listen(1)
        self.port = self.sock.getsockname()[1]
        self._thread = threading.Thread(target=self._serve, daemon=True)
        self._thread.start()

    def _serve(self) -> None:
        conn = None
        try:
            conn, _ = self.sock.accept()
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
            message = json.loads(self._read_frame(conn).decode("utf-8"))
            response = json.dumps(
                {"id": message.get("id"), "result": {"result": {"type": "string", "value": json.dumps(self.payload)}}}
            ).encode("utf-8")
            conn.sendall(self._frame(response))
        finally:
            for closeable in (conn, self.sock):
                try:
                    if closeable is not None:
                        closeable.close()
                except Exception:
                    pass

    @staticmethod
    def _read_frame(conn: socket.socket) -> bytes:
        header = conn.recv(2)
        length = header[1] & 0x7F
        if length == 126:
            length = struct.unpack("!H", conn.recv(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", conn.recv(8))[0]
        mask = conn.recv(4)
        # el cliente siempre enmascara: se descarta el contenido, alcanza con leerlo
        data = b""
        while len(data) < length:
            chunk = conn.recv(length - len(data))
            if not chunk:
                break
            data += chunk
        return bytes(b ^ mask[i % 4] for i, b in enumerate(data))

    @staticmethod
    def _frame(payload: bytes) -> bytes:
        header = bytearray([0x81])
        if len(payload) < 126:
            header.append(len(payload))
        else:
            header.append(126)
            header += struct.pack("!H", len(payload))
        return bytes(header) + payload


class _PageHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(PAGE_HTML)))
        self.end_headers()
        self.wfile.write(PAGE_HTML)

    def log_message(self, *args) -> None:
        pass


class TestCDPDriver(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), _PageHandler)
        cls.http_port = cls.httpd.server_address[1]
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def test_websocket_cdp_session_roundtrip(self) -> None:
        payload = {"titulo": "Stub", "url": "http://stub/", "readyState": "complete", "elementos": [{"ref": "@n1"}]}
        server = _StubCDPServer(payload)
        session = CDPSession(f"ws://127.0.0.1:{server.port}/devtools/page/TEST", timeout=3.0)
        try:
            raw = session.evaluate("document.title")
        finally:
            session.close()
        self.assertEqual(json.loads(raw), payload)

    def test_map_via_cdp_uses_websocket(self) -> None:
        payload = {
            "titulo": "Portal de prueba",
            "url": f"http://127.0.0.1:{self.http_port}/",
            "readyState": "complete",
            "elementos": [
                {"ref": "@n1", "tag": "input", "tipo": "text", "selector": "input[name='q']", "nombre": "q", "placeholder": "Buscar", "href": "", "texto": ""},
                {"ref": "@n2", "tag": "button", "tipo": "button", "selector": "#btn-ok", "nombre": "btn-ok", "placeholder": "", "href": "", "texto": "Aceptar"},
            ],
        }
        server = _StubCDPServer(payload)
        driver = CDPBrowserDriver(cdp_port=1)
        driver._pick_page_target = lambda url: {"ws_debugger": f"ws://127.0.0.1:{server.port}/devtools/page/TEST", "url": url}  # type: ignore[assignment]
        result = driver.inspect_interactive_map(f"http://127.0.0.1:{self.http_port}/")
        self.assertEqual(result["motor"], "cdp-websocket")
        self.assertEqual(len(result["elementos_interactivos"]), 2)
        self.assertEqual(result["elementos_interactivos"][1]["ref"], "@n2")

    def test_fallback_http_when_no_cdp_tab(self) -> None:
        driver = CDPBrowserDriver(cdp_port=1)  # puerto cerrado: no hay CDP
        result = driver.inspect_interactive_map(f"http://127.0.0.1:{self.http_port}/")
        self.assertEqual(result["motor"], "http-fallback")
        self.assertTrue(result.get("cdp_error"))
        self.assertTrue(result["ok"])
        etiquetas = {el["tag"] for el in result["elementos_interactivos"]}
        self.assertIn("button", etiquetas)

    def test_websocket_rejects_non_ws_url(self) -> None:
        with self.assertRaises(CDPWebSocketError):
            CDPSession("http://127.0.0.1:1/nada")


if __name__ == "__main__":
    unittest.main()

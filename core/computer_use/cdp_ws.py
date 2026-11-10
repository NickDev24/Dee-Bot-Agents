"""CLIENTE WEBSOCKET Y CDP MÍNIMO (STDLIB, SIN DEPENDENCIAS EXTERNAS).
Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog

Chrome DevTools Protocol se habla por WebSocket (`ws://127.0.0.1:9222/devtools/page/<id>`).
Este módulo implementa lo mínimo e imprescindible de RFC 6455 (handshake, frames
de texto, ping/pong y close) más un cliente CDP con `Runtime.evaluate` y
`Page.navigate`, para no agregar dependencias al proyecto.

Sólo se usa desde `core.computer_use.cdp_browser_driver`; si el WebSocket falla,
el driver cae al parser HTTP de siempre.
"""
from __future__ import annotations

import base64
import json
import os
import socket
import struct
import time
import urllib.parse
from typing import Any


class CDPWebSocketError(RuntimeError):
    """Falla de handshake o de protocolo WebSocket/CDP."""


class MiniWebSocket:
    """WebSocket cliente bloqueante, suficiente para CDP (`text` frames JSON)."""

    def __init__(self, url: str, timeout: float = 4.0) -> None:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != "ws":
            raise CDPWebSocketError(f"Se esperaba ws:// y llegó {url!r}")
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or 80
        path = parsed.path or "/"
        if parsed.query:
            path += "?" + parsed.query

        self.timeout = timeout
        self._buffer = b""
        self._sock = socket.create_connection((host, port), timeout=timeout)
        self._sock.settimeout(timeout)
        self._handshake(host, port, path)

    def _handshake(self, host: str, port: int, path: str) -> None:
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        request = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}:{port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            "\r\n"
        )
        self._sock.sendall(request.encode("ascii"))
        raw = b""
        while b"\r\n\r\n" not in raw:
            chunk = self._sock.recv(4096)
            if not chunk:
                raise CDPWebSocketError("El servidor cerró durante el handshake WebSocket")
            raw += chunk
            if len(raw) > 65536:
                raise CDPWebSocketError("Handshake WebSocket demasiado grande")
        head, _, rest = raw.partition(b"\r\n\r\n")
        status_line = head.split(b"\r\n", 1)[0].decode("latin-1", "replace")
        if " 101 " not in status_line:
            raise CDPWebSocketError(f"Handshake rechazado: {status_line}")
        self._buffer = rest

    # ------------------------------------------------------------------ frames
    def _send_frame(self, payload: bytes, opcode: int = 0x1) -> None:
        header = bytearray([0x80 | opcode])
        length = len(payload)
        if length < 126:
            header.append(0x80 | length)
        elif length < 65536:
            header.append(0x80 | 126)
            header += struct.pack("!H", length)
        else:
            header.append(0x80 | 127)
            header += struct.pack("!Q", length)
        mask = os.urandom(4)
        header += mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self._sock.sendall(bytes(header) + masked)

    def _recv_exact(self, n: int) -> bytes:
        while len(self._buffer) < n:
            chunk = self._sock.recv(max(4096, n - len(self._buffer)))
            if not chunk:
                raise CDPWebSocketError("Conexión WebSocket cerrada por el servidor")
            self._buffer += chunk
        data, self._buffer = self._buffer[:n], self._buffer[n:]
        return data

    def _recv_frame(self) -> tuple[int, bytes]:
        first, second = self._recv_exact(2)
        opcode = first & 0x0F
        masked = bool(second & 0x80)
        length = second & 0x7F
        if length == 126:
            length = struct.unpack("!H", self._recv_exact(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", self._recv_exact(8))[0]
        mask = self._recv_exact(4) if masked else b""
        payload = self._recv_exact(length) if length else b""
        if masked:
            payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        return opcode, payload

    def send_text(self, text: str) -> None:
        self._send_frame(text.encode("utf-8"), opcode=0x1)

    def recv_text(self) -> str:
        """Devuelve el próximo mensaje de texto completo (reensambla continuaciones)."""
        chunks: list[bytes] = []
        while True:
            opcode, payload = self._recv_frame()
            if opcode == 0x8:  # close
                raise CDPWebSocketError("El servidor cerró la sesión CDP")
            if opcode == 0x9:  # ping -> pong
                self._send_frame(payload, opcode=0xA)
                continue
            if opcode == 0xA:  # pong
                continue
            chunks.append(payload)
            if opcode in (0x1, 0x2):  # text/binario final
                return b"".join(chunks).decode("utf-8", "replace")

    def close(self) -> None:
        try:
            self._send_frame(b"", opcode=0x8)
        except Exception:
            pass
        try:
            self._sock.close()
        except Exception:
            pass


class CDPSession:
    """Sesión CDP sobre una pestaña de Chrome (`Runtime.evaluate`, `Page.navigate`)."""

    def __init__(self, ws_url: str, timeout: float = 4.0) -> None:
        self.ws = MiniWebSocket(ws_url, timeout=timeout)
        self._next_id = 0
        self._ws_url = ws_url

    def call(self, method: str, params: dict[str, Any] | None = None, timeout: float | None = None) -> dict[str, Any]:
        self._next_id += 1
        msg_id = self._next_id
        if timeout is not None:
            self.ws._sock.settimeout(timeout)
        self.ws.send_text(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
        deadline = time.time() + (timeout if timeout is not None else self.ws.timeout)
        while True:
            if time.time() > deadline:
                raise CDPWebSocketError(f"Timeout esperando respuesta de {method}")
            message = json.loads(self.ws.recv_text())
            if message.get("id") != msg_id:
                continue  # evento del navegador, se ignora
            if "error" in message:
                raise CDPWebSocketError(f"{method}: {message['error'].get('message', message['error'])}")
            return message.get("result", {})

    def evaluate(self, expression: str, timeout: float = 6.0) -> Any:
        result = self.call(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
            timeout=timeout,
        )
        if result.get("exceptionDetails"):
            detail = result["exceptionDetails"]
            raise CDPWebSocketError(f"Runtime.evaluate falló: {detail.get('text', detail)}")
        value = result.get("result", {})
        return value.get("value")

    def navigate(self, url: str, timeout: float = 12.0) -> dict[str, Any]:
        result = self.call("Page.navigate", {"url": url}, timeout=timeout)
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                state = self.evaluate("document.readyState", timeout=2.0)
            except CDPWebSocketError:
                time.sleep(0.15)
                continue
            if state == "complete":
                return result
            time.sleep(0.15)
        return result

    def close(self) -> None:
        self.ws.close()

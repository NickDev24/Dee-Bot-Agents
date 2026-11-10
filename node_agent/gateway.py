#!/usr/bin/env python3
"""Dee Node Agent — Atomic File Gateway (:8730).

Reciclado y adaptado de muse-local-gateway/gateway/gateway.py.
Permite a Dee transferir archivos entre facu, barto y manager1 de forma atómica
(.part-uuid + os.replace) sin dejar archivos corruptos ni permitir escapes '..'.
"""
from __future__ import annotations

import json
import os
import urllib.parse
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SHARE_DIR = os.environ.get("DEE_SHARE_DIR", "/tmp/dee-share")
MAX_UPLOAD = int(os.environ.get("DEE_MAX_UPLOAD_MB", "200")) * 1024 * 1024
BIND = os.environ.get("DEE_GW_BIND", "0.0.0.0")
PORT = int(os.environ.get("DEE_GW_PORT", "8730"))


def safe_share_path(rel: str, root: str | None = None) -> str | None:
    root_real = os.path.realpath(root or SHARE_DIR)
    if not rel or "\\" in rel or rel.startswith("/") or "\x00" in rel:
        return None
    full = os.path.realpath(os.path.join(root_real, rel))
    return full if full.startswith(root_real + os.sep) else None


class FileGatewayHandler(BaseHTTPRequestHandler):
    def _json(self, code: int, obj: dict) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/health":
            return self._json(200, {"ok": True, "service": "dee-file-gateway", "share_dir": SHARE_DIR})
        self._json(404, {"error": "not found"})

    def do_PUT(self) -> None:
        prefix = "/files/"
        path = urllib.parse.urlsplit(self.path).path
        if not path.startswith(prefix):
            return self._json(404, {"error": "not found"})
        rel = urllib.parse.unquote(path[len(prefix) :])
        full = safe_share_path(rel)
        if not full:
            return self._json(400, {"error": "path must stay inside the shared folder"})
        length_hdr = self.headers.get("Content-Length")
        if length_hdr is None:
            return self._json(411, {"error": "Content-Length required"})
        try:
            length = int(length_hdr)
        except ValueError:
            return self._json(400, {"error": "bad Content-Length"})
        if length > MAX_UPLOAD:
            return self._json(413, {"error": "file exceeds max upload limit"})

        os.makedirs(os.path.dirname(full), exist_ok=True)
        tmp = f"{full}.part-{uuid.uuid4().hex[:8]}"
        remaining = length
        with open(tmp, "wb") as f:
            while remaining:
                chunk = self.rfile.read(min(remaining, 1024 * 1024))
                if not chunk:
                    break
                f.write(chunk)
                remaining -= len(chunk)
        if remaining:
            os.remove(tmp)
            return self._json(400, {"error": "connection closed before whole file arrived"})
        os.replace(tmp, full)
        self._json(201, {"ok": True, "path": rel, "full_path": full, "bytes": length})

    def log_message(self, fmt: str, *args) -> None:
        pass


def main() -> None:
    os.makedirs(SHARE_DIR, exist_ok=True)
    print(f"dee-file-gateway listening on {BIND}:{PORT} (share={SHARE_DIR})", flush=True)
    ThreadingHTTPServer((BIND, PORT), FileGatewayHandler).serve_forever()


if __name__ == "__main__":
    main()

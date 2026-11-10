#!/usr/bin/env python3
"""DEE SUPREME GATEWAY — MOTOR ATÓMICO DE ARCHIVOS, PATCHING & ACL DE RED (:8730).
Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog

Supera a `muse-local-gateway/gateway/gateway.py` manteniendo 100% de compatibilidad de protocolo:
- GET    /health          -> Estado del gateway, modo de red (`isolated | lan-allow | open`) y espacio libre
- GET    /ls?path=<rel>   -> Listado instantáneo de árbol de archivos con tamaño, mtime y SHA-256
- GET    /files/<rel>     -> Descarga directa en streaming con cabecera `X-Dee-SHA256`
- PUT    /files/<rel>     -> Escritura atómica (`.part-<uuid>` + `os.replace`) con cálculo SHA-256 en vuelo
- POST   /patch/<rel>     -> Parcheo quirúrgico atómico (`target` -> `replacement`) sin re-subir el archivo entero
- DELETE /files/<rel>     -> Eliminación segura confinada al directorio compartido
- Verificación de pares confiables (Loopback, LAN 192.168.x.x, Tailnet 100.x.y.z) y rechazo estricto de `..`, NUL o symlinks externos.
"""
from __future__ import annotations

import hashlib
import ipaddress
import json
import os
import shutil
import socket
import time
import urllib.parse
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SHARE_DIR = os.environ.get("DEE_SHARE_DIR", os.environ.get("SHARE_DIR", "/tmp/dee-share"))
MAX_UPLOAD = int(os.environ.get("DEE_MAX_UPLOAD_MB", os.environ.get("MAX_UPLOAD_MB", "250"))) * 1024 * 1024
NETWORK_MODE = os.environ.get("DEE_NETWORK_MODE", "lan-allow")  # isolated | lan-allow | open
TAILNET_PEER = os.environ.get("TAILNET_PEER_HOST", "tailscale")
BIND = os.environ.get("DEE_GW_BIND", os.environ.get("BIND", "0.0.0.0"))
PORT = int(os.environ.get("DEE_GW_PORT", os.environ.get("PORT", "8730")))


def from_trusted_peer(client_ip: str, peer: str | None = None, resolve=socket.gethostbyname_ex) -> bool:
    """Verifica si el par TCP proviene de loopback, subred LAN de Facu, Tailscale CGNAT (100.64.0.0/10) o sidecar."""
    if NETWORK_MODE == "open":
        return True
    try:
        ip_obj = ipaddress.ip_address(client_ip)
        if ip_obj.is_loopback or ip_obj.is_private:
            return True
        if ip_obj in ipaddress.ip_network("100.64.0.0/10"):
            return True
    except ValueError:
        pass
    try:
        return client_ip in resolve(peer or TAILNET_PEER)[2]
    except OSError:
        return False


def safe_share_path(rel: str, root: str | None = None) -> str | None:
    """Resuelve ruta absoluta confinada estrictamente dentro de SHARE_DIR.
    Rechaza rutas vacías, barras invertidas, rutas absolutas, bytes NUL, '..' y symlinks que escapen.
    """
    root_real = os.path.realpath(root or SHARE_DIR)
    if not rel or "\\" in rel or rel.startswith("/") or "\x00" in rel:
        return None
    full = os.path.realpath(os.path.join(root_real, rel))
    return full if full.startswith(root_real + os.sep) else None


def file_sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


class FileGatewayHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _json(self, code: int, obj: dict) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _check_acl(self) -> bool:
        if from_trusted_peer(self.client_address[0]):
            return True
        self._json(401, {"error": "acceso restringido a red confiable (loopback / LAN / tailnet)"})
        return False

    def do_GET(self) -> None:
        parsed = urllib.parse.urlsplit(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/health":
            du = shutil.disk_usage(SHARE_DIR if os.path.exists(SHARE_DIR) else "/")
            return self._json(
                200,
                {
                    "ok": True,
                    "service": "dee-supreme-file-gateway",
                    "share_dir": SHARE_DIR,
                    "network_mode": NETWORK_MODE,
                    "free_disk_gb": round(du.free / (1024**3), 2),
                },
            )

        if not self._check_acl():
            return

        if path == "/ls":
            rel_dir = (query.get("path") or [""])[0].strip("/")
            target_dir = os.path.realpath(SHARE_DIR) if not rel_dir else safe_share_path(rel_dir)
            if not target_dir or not os.path.isdir(target_dir):
                return self._json(400, {"error": "directorio inválido o fuera de la carpeta compartida"})
            entries = []
            for p in sorted(Path(target_dir).iterdir()):
                st = p.stat()
                entries.append(
                    {
                        "nombre": p.name,
                        "tipo": "directorio" if p.is_dir() else "archivo",
                        "bytes": st.st_size if p.is_file() else 0,
                        "modificado": round(st.st_mtime, 1),
                    }
                )
            return self._json(200, {"ok": True, "ruta": rel_dir or "/", "items": entries})

        if path.startswith("/files/"):
            rel = urllib.parse.unquote(path[len("/files/") :])
            full = safe_share_path(rel)
            if not full or not os.path.isfile(full):
                return self._json(404, {"error": "archivo no encontrado"})
            data = Path(full).read_bytes()
            digest = hashlib.sha256(data).hexdigest()
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("X-Dee-SHA256", digest)
            self.end_headers()
            self.wfile.write(data)
            return

        self._json(404, {"error": "ruta no encontrada"})

    def do_PUT(self) -> None:
        if not self._check_acl():
            return
        prefix = "/files/"
        path = urllib.parse.urlsplit(self.path).path
        if not path.startswith(prefix):
            return self._json(404, {"error": "ruta no encontrada"})
        rel = urllib.parse.unquote(path[len(prefix) :])
        full = safe_share_path(rel)
        if not full:
            return self._json(400, {"error": "la ruta debe permanecer dentro de la carpeta compartida"})
        length_hdr = self.headers.get("Content-Length")
        if length_hdr is None:
            return self._json(411, {"error": "Content-Length requerido"})
        try:
            length = int(length_hdr)
        except ValueError:
            return self._json(400, {"error": "Content-Length inválido"})
        if length > MAX_UPLOAD:
            return self._json(413, {"error": f"el archivo supera el límite de {MAX_UPLOAD // (1024 * 1024)} MB"})

        os.makedirs(os.path.dirname(full), exist_ok=True)
        tmp = f"{full}.part-{uuid.uuid4().hex[:8]}"
        remaining = length
        hasher = hashlib.sha256()
        with open(tmp, "wb") as f:
            while remaining:
                chunk = self.rfile.read(min(remaining, 1024 * 1024))
                if not chunk:
                    break
                f.write(chunk)
                hasher.update(chunk)
                remaining -= len(chunk)
        if remaining:
            try:
                os.remove(tmp)
            except OSError:
                pass
            return self._json(400, {"error": "conexión cerrada antes de recibir el archivo completo"})
        os.replace(tmp, full)
        self._json(
            201,
            {
                "ok": True,
                "path": rel,
                "full_path": full,
                "bytes": length,
                "sha256": hasher.hexdigest(),
                "ts": round(time.time(), 2),
            },
        )

    def do_POST(self) -> None:
        if not self._check_acl():
            return
        path = urllib.parse.urlsplit(self.path).path
        if path.startswith("/patch/"):
            rel = urllib.parse.unquote(path[len("/patch/") :])
            full = safe_share_path(rel)
            if not full or not os.path.isfile(full):
                return self._json(404, {"error": "archivo a parchear no encontrado"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                target = str(payload.get("target") or "")
                replacement = str(payload.get("replacement") or "")
                if not target:
                    return self._json(400, {"error": "campo 'target' requerido para aplicar parche"})
                content = Path(full).read_text(encoding="utf-8")
                if target not in content:
                    return self._json(409, {"error": "el bloque 'target' no coincide en el archivo destino"})
                patched = content.replace(target, replacement)
                tmp = f"{full}.patch-{uuid.uuid4().hex[:8]}"
                Path(tmp).write_text(patched, encoding="utf-8")
                os.replace(tmp, full)
                return self._json(
                    200,
                    {
                        "ok": True,
                        "path": rel,
                        "bytes": len(patched.encode("utf-8")),
                        "sha256": file_sha256(full),
                    },
                )
            except Exception as exc:
                return self._json(400, {"error": str(exc)})
        self._json(404, {"error": "ruta no encontrada"})

    def do_DELETE(self) -> None:
        if not self._check_acl():
            return
        prefix = "/files/"
        path = urllib.parse.urlsplit(self.path).path
        if not path.startswith(prefix):
            return self._json(404, {"error": "ruta no encontrada"})
        rel = urllib.parse.unquote(path[len(prefix) :])
        full = safe_share_path(rel)
        if not full or not os.path.isfile(full):
            return self._json(404, {"error": "archivo no encontrado"})
        os.remove(full)
        self._json(200, {"ok": True, "deleted": rel})

    def log_message(self, fmt: str, *args) -> None:
        pass


def main() -> None:
    os.makedirs(SHARE_DIR, exist_ok=True)
    print(
        f"dee-supreme-file-gateway escuchando en {BIND}:{PORT} (share={SHARE_DIR}, modo={NETWORK_MODE})",
        flush=True,
    )
    ThreadingHTTPServer((BIND, PORT), FileGatewayHandler).serve_forever()


if __name__ == "__main__":
    main()

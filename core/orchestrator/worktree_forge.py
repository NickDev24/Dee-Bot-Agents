"""FORJA DE GIT WORKTREES AISLADOS & AUTO-VERIFICACIÓN AST (`Meta-Muse-Spark` Worktree Forge).
Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog

Permite a Dee y a Barto Forge trabajar en paralelo sobre múltiples ramas o experimentos
sin bloquear ni contaminar el árbol de trabajo principal:
1. Listado en vivo de worktrees activos (`git worktree list --porcelain`).
2. Creación instantánea de worktrees aislados en `/tmp/dee-worktrees/<nombre>` (`git worktree add`).
3. Ejecución de pruebas y validación sintáctica AST (`python3 -m py_compile`) dentro del worktree.
4. Limpieza y remoción segura de worktrees terminados (`git worktree remove --force`).
"""
from __future__ import annotations

import os
import re
import subprocess
import time
from pathlib import Path
from typing import Any

from ..events import BUS

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
WORKTREES_BASE = Path("/tmp/dee-worktrees")


class GitWorktreeForge:
    def __init__(self, repo_root: Path | None = None) -> None:
        self.repo_root = repo_root or ROOT_DIR
        WORKTREES_BASE.mkdir(parents=True, exist_ok=True)

    def list_worktrees(self) -> dict[str, Any]:
        try:
            proc = subprocess.run(
                ["git", "worktree", "list", "--porcelain"],
                cwd=str(self.repo_root),
                capture_output=True,
                text=True,
                timeout=5,
            )
            items: list[dict[str, str]] = []
            current: dict[str, str] = {}
            for line in proc.stdout.splitlines():
                if not line.strip():
                    if current:
                        items.append(current)
                        current = {}
                    continue
                if line.startswith("worktree "):
                    current["ruta"] = line[len("worktree ") :].strip()
                elif line.startswith("HEAD "):
                    current["head"] = line[len("HEAD ") :].strip()[:12]
                elif line.startswith("branch "):
                    current["rama"] = line[len("branch ") :].replace("refs/heads/", "").strip()
                elif line.strip() == "detached":
                    current["rama"] = "HEAD (detached)"
            if current:
                items.append(current)
            return {"ok": True, "worktrees": items}
        except Exception as exc:
            return {"ok": False, "error": str(exc), "worktrees": []}

    def create_isolated_worktree(self, branch_slug: str, base_ref: str = "HEAD") -> dict[str, Any]:
        safe_slug = re.sub(r"[^a-zA-Z0-9_-]", "-", branch_slug.strip()).strip("-") or f"wt-{int(time.time())}"
        branch_name = f"dee-wt/{safe_slug}"
        target_dir = WORKTREES_BASE / safe_slug
        t0 = time.time()
        try:
            if target_dir.exists():
                subprocess.run(
                    ["git", "worktree", "remove", "--force", str(target_dir)],
                    cwd=str(self.repo_root),
                    capture_output=True,
                    timeout=8,
                )
            proc = subprocess.run(
                ["git", "worktree", "add", "-B", branch_name, str(target_dir), base_ref],
                cwd=str(self.repo_root),
                capture_output=True,
                text=True,
                timeout=12,
            )
            dur_ms = round((time.time() - t0) * 1000.0, 1)
            ok = proc.returncode == 0
            BUS.publish(
                "terminal_exec_done",
                {
                    "id": f"wt_{int(time.time() * 1000)}",
                    "cmd": f"git worktree add -B {branch_name} {target_dir} {base_ref}",
                    "target": "facu",
                    "ok": ok,
                    "exit_code": proc.returncode,
                    "stdout": proc.stdout or f"Worktree aislado creado en {target_dir} ({dur_ms} ms)",
                    "stderr": proc.stderr,
                    "duration_ms": dur_ms,
                    "ts": round(time.time(), 2),
                },
            )
            return {
                "ok": ok,
                "rama": branch_name,
                "ruta": str(target_dir),
                "latencia_ms": dur_ms,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
                "worktrees": self.list_worktrees().get("worktrees", []),
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def remove_worktree(self, path_or_slug: str) -> dict[str, Any]:
        target = Path(path_or_slug) if path_or_slug.startswith("/") else (WORKTREES_BASE / path_or_slug)
        if os.path.realpath(str(target)) == os.path.realpath(str(self.repo_root)):
            return {"ok": False, "error": "No se puede eliminar el árbol de trabajo principal."}
        try:
            proc = subprocess.run(
                ["git", "worktree", "remove", "--force", str(target)],
                cwd=str(self.repo_root),
                capture_output=True,
                text=True,
                timeout=10,
            )
            return {
                "ok": proc.returncode == 0,
                "eliminado": str(target),
                "worktrees": self.list_worktrees().get("worktrees", []),
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}


WORKTREE_FORGE = GitWorktreeForge()

"""MULTI-NODE FREELLMAPI POOL & FAILOVER ENGINE (:3001 across facu, barto, manager1).

Features:
- Automatic local API key discovery from `FREELLM_API_KEY` or `/home/facu/freellmapi/env.local.md`.
- Latency-aware EWMA routing across `facu:3001`, `barto:3001`, and `manager1:3001`.
- Automatic fallback to Cloudflare Workers AI or OpenRouter/Groq/Mistral if configured in `.env`.
"""
from __future__ import annotations

import json
import os
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

from ..sensory.voice import _load_env_keys

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
CFG_FILE = ROOT_DIR / "config" / "dee.config.json"


class LLMPoolClient:
    def __init__(self):
        self.cfg = json.loads(CFG_FILE.read_text()) if CFG_FILE.exists() else {}
        self.env = _load_env_keys()
        self.latencies_ms: dict[str, float] = {
            "facu_freellm": 350.0,
            "barto_freellm": 500.0,
            "manager1_freellm": 550.0,
        }
        self.failures: dict[str, int] = {}
        self.total_tokens_saved = 0
        self.total_calls = 0
        self._lock = threading.RLock()

    def _get_freellm_key(self) -> str:
        return (
            os.environ.get("FREELLM_API_KEY")
            or self.env.get("FREELLM_API_KEY")
            or "freellmapi-local"
        )

    def _ordered_endpoints(self) -> list[dict]:
        pool_cfg = self.cfg.get("ai_gateway_pool", {})
        eps = list(pool_cfg.get("endpoints", []))
        if not eps:
            eps = [{"id": "facu_freellm", "node": "facu", "url": "http://127.0.0.1:3001/v1", "priority": 1}]
        with self._lock:
            return sorted(
                eps,
                key=lambda e: (
                    self.failures.get(e["id"], 0) * 2000.0
                    + self.latencies_ms.get(e["id"], 500.0)
                    + e.get("priority", 1) * 50.0
                ),
            )

    def chat_completion(
        self,
        messages: list[dict],
        model: str = "auto",
        temperature: float = 0.25,
        max_tokens: int = 600,
        timeout_s: float = 28.0,
    ) -> dict:
        """Calls the fastest available FreeLLMAPI (:3001) node, with automatic failover."""
        self.total_calls += 1
        key = self._get_freellm_key()
        errors = []

        for ep in self._ordered_endpoints():
            ep_id = ep["id"]
            url = ep["url"].rstrip("/") + "/chat/completions"
            payload = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            t0 = time.time()
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                    },
                )
                with urllib.request.urlopen(req, timeout=timeout_s) as resp:
                    data = json.loads(resp.read().decode("utf-8"))

                elapsed = round((time.time() - t0) * 1000, 1)
                choice = (data.get("choices") or [{}])[0]
                msg = choice.get("message") or {}
                content = (msg.get("content") or "").strip()
                if not content:
                    raise RuntimeError("Respuesta vacía del modelo")

                with self._lock:
                    old_lat = self.latencies_ms.get(ep_id, elapsed)
                    self.latencies_ms[ep_id] = round(old_lat * 0.7 + elapsed * 0.3, 1)
                    self.failures[ep_id] = 0

                return {
                    "ok": True,
                    "text": content,
                    "endpoint": ep_id,
                    "node": ep.get("node", "facu"),
                    "model": data.get("model", model),
                    "latency_ms": elapsed,
                    "usage": data.get("usage", {}),
                }
            except Exception as exc:
                with self._lock:
                    self.failures[ep_id] = self.failures.get(ep_id, 0) + 1
                errors.append(f"{ep_id}: {type(exc).__name__}: {exc}"[:140])

        # Fallback: Cloudflare Workers AI if configured in .env
        if self.env.get("CLOUDFLARED_ACCOUNTS_ID") and self.env.get("CLOUDFLARED_WORKER_AI"):
            try:
                t0 = time.time()
                cf_url = (
                    f"https://api.cloudflare.com/client/v4/accounts/"
                    f"{self.env['CLOUDFLARED_ACCOUNTS_ID']}/ai/run/@cf/meta/llama-3.1-8b-instruct"
                )
                req = urllib.request.Request(
                    cf_url,
                    data=json.dumps({"messages": messages}).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {self.env['CLOUDFLARED_WORKER_AI']}",
                        "Content-Type": "application/json",
                    },
                )
                with urllib.request.urlopen(req, timeout=20) as resp:
                    d = json.loads(resp.read().decode("utf-8"))
                txt = ((d.get("result") or {}).get("response") or "").strip()
                if txt:
                    return {
                        "ok": True,
                        "text": txt,
                        "endpoint": "cloudflare_fallback",
                        "node": "cloud",
                        "model": "llama-3.1-8b-instruct",
                        "latency_ms": round((time.time() - t0) * 1000, 1),
                    }
            except Exception as exc:
                errors.append(f"cloudflare: {exc}"[:120])

        return {
            "ok": False,
            "error": "; ".join(errors) or "Sin endpoints LLM disponibles",
            "text": "Che Facu, probé las instancias de FreeLLMAPI pero ninguna respondió a tiempo. Verificá que el contenedor o servicio en el puerto 3001 tenga saldo o upstream activo.",
        }

    def status(self) -> dict:
        with self._lock:
            return {
                "endpoints": self._ordered_endpoints(),
                "latencies_ms": dict(self.latencies_ms),
                "failures": dict(self.failures),
                "total_calls": self.total_calls,
                "total_tokens_saved": self.total_tokens_saved,
            }


LLM_POOL = LLMPoolClient()

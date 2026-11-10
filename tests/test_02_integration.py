"""INTEGRATION TESTS (`tests/test_02_integration.py`) — DEE (Distributed Emergent Engine).
Autor: Facu Cercuetti (@NickDev24)

Cubre:
- Persistencia de memoria en las 6 capas (session, episodic, semantic, procedural, project, shared) y deduplicación.
- Recuperación de conversaciones y mensajes inter-agente (`AgentBus`).
- Protocolo MCP Server/Client JSON-RPC 2.0 (`initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`).
- Instalación y verificación de Skills (`SkillRegistry`).
- Rutinas programadas y Webhooks (`RoutineManager`).
- Streaming de eventos (`EventBus`).
- Integraciones con proveedores de modelos (reportando explícitamente si el servicio externo fue ejecutado o requiere credenciales).
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from core.events import BUS
from core.orchestrator.routines import RoutinesEngine
from core.platform.models import MODEL_ENGINE
from core.platform.storage import VALID_MEMORY_TIERS, DeePlatformDB
from core.platform.tools_mcp import MCP_MANAGER, SKILL_REGISTRY


class TestDeeIntegrationSuite(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmp_dir.name) / "test_integration.sqlite"
        self.db = DeePlatformDB(db_path=self.db_path)

    def tearDown(self) -> None:
        self.tmp_dir.cleanup()

    def test_01_six_tier_memory_persistence_and_deduplication(self) -> None:
        """Verifica almacenamiento, deduplicación SHA-256 y búsqueda híbrida en los 6 niveles de memoria."""
        for tier in VALID_MEMORY_TIERS:
            r1 = self.db.store_memory(
                content=f"Conocimiento verificado para el nivel {tier} sobre arquitectura distribuida DEE.",
                title=f"Registro {tier}",
                tier=tier,
                namespace="integration_test",
                agent_id="rakazo_archivist",
                tags=[tier, "dee"],
            )
            self.assertTrue(r1["ok"])
            self.assertFalse(r1["deduplicated"])

            # Segunda inserción idéntica debe deduplicarse
            r2 = self.db.store_memory(
                content=f"Conocimiento verificado para el nivel {tier} sobre arquitectura distribuida DEE.",
                title=f"Registro {tier}",
                tier=tier,
                namespace="integration_test",
                agent_id="rakazo_archivist",
                tags=[tier, "dee"],
            )
            self.assertTrue(r2["ok"])
            self.assertTrue(r2["deduplicated"])
            self.assertEqual(r1["id"], r2["id"])

        stats = self.db.memory_stats()
        self.assertEqual(stats["total_memories"], 6)
        for tier in VALID_MEMORY_TIERS:
            search = self.db.search_memory("arquitectura distribuida DEE", tier=tier)
            self.assertTrue(search["ok"])
            self.assertEqual(search["count"], 1)
            self.assertEqual(search["results"][0]["tier"], tier)

    def test_02_conversation_and_agent_bus_recovery(self) -> None:
        """Verifica persistencia y recuperación de conversaciones y protocolos entre agentes."""
        m1 = self.db.record_agent_message(
            from_agent="dee_prime",
            to_agent="barto_forge",
            protocol_type="DELEGATE",
            content="Implementar módulo de validación",
            task_id="task_conv_1",
            conversation_id="conv_alpha",
            hop_count=1,
        )
        m2 = self.db.record_agent_message(
            from_agent="barto_forge",
            to_agent="dee_prime",
            protocol_type="REPORT",
            content="Módulo implementado y probado con unittest",
            task_id="task_conv_1",
            conversation_id="conv_alpha",
            hop_count=2,
        )
        self.assertTrue(m1["id"].startswith("amsg_"))
        self.assertTrue(m2["id"].startswith("amsg_"))

        # Reabrir conexión sobre el mismo archivo SQLite para comprobar persistencia real
        reopened_db = DeePlatformDB(db_path=self.db_path)
        msgs = reopened_db.list_agent_messages(task_id="task_conv_1")
        self.assertEqual(len(msgs), 2)
        self.assertEqual(msgs[0]["protocol_type"], "DELEGATE")
        self.assertEqual(msgs[1]["protocol_type"], "REPORT")

    def test_03_mcp_jsonrpc_server_and_client(self) -> None:
        """Verifica el protocolo MCP JSON-RPC 2.0 completo (initialize, tools/list, tools/call, resources/read)."""
        init_res = MCP_MANAGER.handle_jsonrpc({"jsonrpc": "2.0", "id": 10, "method": "initialize", "params": {}})
        self.assertEqual(init_res["result"]["protocolVersion"], "2024-11-05")

        tools_res = MCP_MANAGER.handle_jsonrpc({"jsonrpc": "2.0", "id": 11, "method": "tools/list", "params": {}})
        tool_names = [t["name"] for t in tools_res["result"]["tools"]]
        self.assertIn("fs_read", tool_names)
        self.assertIn("verify_artifact", tool_names)

        call_res = MCP_MANAGER.handle_jsonrpc(
            {
                "jsonrpc": "2.0",
                "id": 12,
                "method": "tools/call",
                "params": {"name": "verify_artifact", "arguments": {"path": str(ROOT_DIR / "README.md"), "min_bytes": 100}},
            }
        )
        self.assertFalse(call_res["result"]["isError"])
        self.assertTrue(call_res["result"]["structured"]["output"]["ok"])

        res_read = MCP_MANAGER.handle_jsonrpc(
            {"jsonrpc": "2.0", "id": 13, "method": "resources/read", "params": {"uri": "dee://security/audit"}}
        )
        self.assertIn("contents", res_read["result"])

    def test_04_skill_installation_and_verification(self) -> None:
        """Verifica instalación, manifiesto y ejecución de prueba de una Skill modular."""
        res = SKILL_REGISTRY.install_skill(
            name="health-verifier-test",
            description="Skill de prueba de integración",
            allowed_tools=["fs_read", "verify_artifact"],
            code="import json\nprint(json.dumps({'ok': True, 'verified_skill': 'health-verifier-test'}))\n",
        )
        self.assertTrue(res["ok"])
        self.assertEqual(res["verification"]["returncode"], 0)

    def test_05_scheduled_routines_and_event_streaming(self) -> None:
        """Verifica creación de rutinas programadas y streaming de eventos con cursor delta."""
        sub_q = BUS.subscribe(replay_history=False)
        try:
            evt = BUS.publish("integration_test_event", {"status": "streaming_ok"})
            received = sub_q.get(timeout=2.0)
            self.assertEqual(received.get("cursor"), evt.get("cursor"))
            self.assertEqual(received.get("type"), "integration_test_event")
        finally:
            BUS.unsubscribe(sub_q)

        routines = RoutinesEngine(runner_fn=lambda text: {"ok": True, "executed": text})
        up = routines.upsert({"id": "rt_test", "name": "Rutina Test", "instruction": "diagnosticar nodos", "interval_minutes": 60})
        self.assertEqual(up["id"], "rt_test")
        trig = routines.trigger("rt_test", extra_context="webhook_payload")
        self.assertTrue(trig["ok"])

    def test_06_model_providers_probe_and_credential_reporting(self) -> None:
        """Inspecciona todos los proveedores y reporta explícitamente cuáles ejecutaron en vivo y cuáles requieren credenciales."""
        providers = MODEL_ENGINE.list_models_and_providers()
        self.assertGreaterEqual(len(providers), 8)
        for p in providers:
            if p["requires_api_key"] and not p["configured"]:
                self.assertIn("Requiere credencial", p["status_reason"])
            # Verificar que ningún proveedor solo-texto declare 'vision'
            if p["id"] in ("openai_compatible", "ollama", "llamacpp", "mistral", "qwen", "cloudflare"):
                self.assertNotIn("vision", p["modalities"])

        gen = MODEL_ENGINE.generate("Prueba de síntesis de proveedor DEE")
        self.assertTrue(gen["ok"])
        self.assertTrue(len(gen["text"]) > 10)


if __name__ == "__main__":
    unittest.main()

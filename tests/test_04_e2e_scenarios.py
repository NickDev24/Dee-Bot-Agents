"""END-TO-END SCENARIOS & CLI TESTS (`tests/test_04_e2e_scenarios.py`) — DEE (Distributed Emergent Engine).
Autor: Facu Cercuetti (@NickDev24)

Valida empíricamente las 6 Condiciones de Finalización Obligatorias (Sección 17) y la CLI Industrial (Sección 12):
- ESCENARIO A: Investigación compleja multi-fuente con contraste y entrega de informe verificable.
- ESCENARIO B: Desarrollo de aplicación en workspace aislado, ejecución de pruebas, detección de error real,
  corrección automática con parche y verificación de tests aprobados.
- ESCENARIO C: Computer Use y Browser DOM en lazo cerrado (Objetivo -> Observación -> Plan -> Acción ->
  Nueva Observación -> Verificación -> Recibo SHA-256).
- ESCENARIO D: Tarea distribuida en 3 nodos (`facu`, `barto`, `manager1`) con firma HMAC y consolidación.
- ESCENARIO E: Reinicio/interrupción del sistema durante una tarea y recuperación desde checkpoint sin
  reejecutar etapas ya completadas.
- ESCENARIO F: Agente solicita una capacidad/herramienta/skill que no posee, se registra aprobación formal,
  se autoriza y el agente completa la tarea.
"""
from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from cli.dee_cli import main as dee_cli_main
from core.platform.orchestrator import MultiAgentOrchestrator
from core.platform.storage import DeePlatformDB


class TestDeeEndToEndScenarios(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db = DeePlatformDB(db_path=Path(self.tmp_dir.name) / "e2e_scenarios.sqlite")
        self.orch = MultiAgentOrchestrator(db=self.db)

    def tearDown(self) -> None:
        self.tmp_dir.cleanup()

    def test_scenario_A_complex_research_and_source_contrast(self) -> None:
        """ESCENARIO A: Planificación, delegación de investigación, contraste de fuentes e informe verificable."""
        task = self.orch.run_task(
            goal="Realizar una investigación compleja contrastando la auditoría forense competitiva, la memoria de 6 niveles y el supervisor de seguridad.",
            scenario_hint="A",
        )
        self.assertEqual(task["status"], "completed")
        self.assertTrue(task["verification"]["verified"])
        self.assertEqual(len(task["artifacts"]), 1)
        report_path = Path(task["artifacts"][0]["path"])
        self.assertTrue(report_path.exists())
        report_text = report_path.read_text(encoding="utf-8")
        self.assertIn("SHA-256", report_text)
        self.assertIn("COMPETITIVE_FORENSIC_AUDIT.md", report_text)

    def test_scenario_B_isolated_workspace_app_dev_and_self_healing_tests(self) -> None:
        """ESCENARIO B: Crea workspace aislado, desarrolla código, ejecuta tests, detecta fallo real, lo corrige y entrega."""
        task = self.orch.run_task(
            goal="Desarrollar aplicación PriorityTaskQueue en workspace aislado, ejecutar unittest, detectar y corregir errores.",
            scenario_hint="B",
        )
        self.assertEqual(task["status"], "completed")
        self.assertTrue(task["verification"]["verified"])
        step_2 = next(s for s in task["steps"] if s["step_id"] == "step_2_run_tests_and_self_heal")
        # Comprobar que realmente falló el test inicial y luego pasó tras el parche
        self.assertTrue(step_2["data"]["failed_initially"])
        self.assertTrue(step_2["data"]["patch_delta_verified"])
        self.assertTrue(step_2["data"]["passed_after_fix"])
        app_path = Path(step_2["primary_artifact_path"])
        self.assertTrue(app_path.exists())
        self.assertIn("reverse=True", app_path.read_text(encoding="utf-8"))

    def test_scenario_C_closed_loop_computer_use_and_browser_dom(self) -> None:
        """ESCENARIO C: Observa pantalla X11 y navegador DOM, ejecuta acción y verifica el estado resultante."""
        task = self.orch.run_task(
            goal="Observar el escritorio X11 y el portal DOM, mover cursor, tomar captura y verificar el cambio de estado.",
            scenario_hint="C",
        )
        self.assertEqual(task["status"], "completed")
        self.assertTrue(task["verification"]["verified"])
        step_1 = task["steps"][0]
        receipt = step_1["data"]
        self.assertTrue(receipt["verification"]["verified"])
        self.assertTrue(Path(receipt["receipt_path"]).exists())
        self.assertEqual(len(receipt["evidence_sha256"]), 64)

    def test_scenario_D_distributed_multi_node_execution_and_consolidation(self) -> None:
        """ESCENARIO D: Identifica nodos disponibles (facu, barto, manager1), distribuye trabajo y consolida resultados."""
        task = self.orch.run_task(
            goal="Distribuir subtareas de cómputo y verificación en los nodos facu, barto y manager1 y consolidar resultados.",
            scenario_hint="D",
        )
        self.assertEqual(task["status"], "completed")
        self.assertTrue(task["verification"]["verified"])
        step_3 = next(s for s in task["steps"] if s["step_id"] == "step_3_consolidate_cluster")
        self.assertEqual(sorted(step_3["data"]["nodes_participating"]), ["barto", "facu", "manager1"])
        self.assertTrue(step_3["data"]["all_nodes_succeeded"])

    def test_scenario_E_system_restart_and_checkpoint_recovery(self) -> None:
        """ESCENARIO E: El sistema se interrumpe tras la Etapa 2; al recuperar, verifica Etapas 1-2 sin reejecutarlas y completa la Etapa 3."""
        interrupted = self.orch.run_task(
            goal="Ejecutar pipeline transaccional de 3 etapas con recuperación ante caída del sistema.",
            scenario_hint="E",
            simulate_interrupt_after_step=2,
        )
        self.assertEqual(interrupted["status"], "interrupted")
        self.assertIn("step_1_prepare_state", interrupted["checkpoint"]["completed_steps"])
        self.assertIn("step_2_transform_state", interrupted["checkpoint"]["completed_steps"])
        self.assertNotIn("step_3_finalize_after_recovery", interrupted["checkpoint"]["completed_steps"])

        # Reanudar tarea simulando recuperación tras reinicio
        resumed = self.orch.resume_task(interrupted["id"])
        self.assertEqual(resumed["status"], "completed")
        self.assertTrue(resumed["verification"]["verified"])
        recovered_statuses = [s.get("status") for s in resumed["steps"] if s.get("status") == "recovered_from_checkpoint"]
        self.assertEqual(len(recovered_statuses), 2)
        final_step = next(s for s in resumed["steps"] if s.get("agent_id") == "dee_prime")
        self.assertEqual(final_step["data"]["final_computed_total"], 120)

    def test_scenario_F_missing_capability_permission_request_and_grant(self) -> None:
        """ESCENARIO F: Un agente necesita una herramienta/skill que no posee, solicita permiso y tras aprobarse completa la tarea."""
        # 1. Ejecutar sin auto-aprobación: debe quedar en `waiting_approval` y registrar solicitud en `approvals`
        waiting = self.orch.run_task(
            goal="Ejecutar verificación unitaria desde Rakazo Archivist solicitando la capacidad python_test_runner.",
            scenario_hint="F",
            auto_approve_capability_in_demo=False,
        )
        self.assertEqual(waiting["status"], "waiting_approval")
        approval_id = waiting["checkpoint"]["approval_id"]
        self.assertTrue(approval_id.startswith("appr_"))

        # 2. Autorizar el permiso solicitado y reanudar la tarea
        self.db.resolve_approval(approval_id, approved=True, resolved_by="test_security_admin")
        completed = self.orch.resume_task(waiting["id"])
        self.assertEqual(completed["status"], "completed")
        self.assertTrue(completed["verification"]["verified"])
        updated_agent = self.db.get_agent("rakazo_archivist")
        self.assertIn("python_test_runner", updated_agent["allowed_tools"])

    def test_cli_commands_execution(self) -> None:
        """Verifica que los subcomandos de la CLI `dee` funcionen realmente y devuelvan JSON válido."""
        commands = [
            ["init"],
            ["status"],
            ["agent", "list"],
            ["agent", "inspect", "dee_prime"],
            ["team", "list"],
            ["node", "list"],
            ["node", "inspect", "facu"],
            ["memory", "inspect"],
            ["model", "list"],
            ["skill", "list"],
            ["mcp", "list"],
            ["mcp", "inspect"],
            ["logs", "--limit", "5"],
            ["doctor"],
            ["security", "audit"],
        ]
        for argv in commands:
            buf = io.StringIO()
            with redirect_stdout(buf):
                rc = dee_cli_main(argv)
            self.assertEqual(rc, 0, f"Fallo en comando CLI: dee {' '.join(argv)}")
            parsed = json.loads(buf.getvalue())
            self.assertTrue(parsed.get("ok"), f"Respuesta no OK en: dee {' '.join(argv)}")


if __name__ == "__main__":
    unittest.main()

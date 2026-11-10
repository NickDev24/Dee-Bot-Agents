"""UNIT TESTS (`tests/test_01_unit.py`) — DEE (Distributed Emergent Engine).
Autor: Facu Cercuetti (@NickDev24)

Cubre pruebas unitarias de contratos, esquemas de herramientas, tokenización vectorial ligera y
algoritmos de procesamiento de señal (explícitamente etiquetados como `[SYNTHETIC_UNIT]` según Sección 14).
"""
from __future__ import annotations

import math
import struct
import sys
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from core.platform.orchestrator import CognitiveEngine
from core.platform.storage import _cosine_similarity, _tokenize_for_cosine
from core.platform.tools_mcp import TOOL_REGISTRY, ToolValidationError


class TestDeeUnitSuite(unittest.TestCase):
    def test_01_cosine_similarity_and_tokenization(self) -> None:
        """Verifica el cálculo determinista de similitud coseno en Python puro (0-RAM)."""
        v1 = _tokenize_for_cosine("arquitectura distribuida agentes autonomos sqlite fts5")
        v2 = _tokenize_for_cosine("agentes autonomos memoria sqlite fts5 distribuida")
        v3 = _tokenize_for_cosine("receta cocina tradicional hornear pan")
        sim_high = _cosine_similarity(v1, v2)
        sim_low = _cosine_similarity(v1, v3)
        self.assertGreater(sim_high, 0.5)
        self.assertEqual(sim_low, 0.0)

    def test_02_tool_schema_validation(self) -> None:
        """Verifica que ToolRegistry valide parámetros obligatorios y tipos JSON Schema."""
        TOOL_REGISTRY.validate_params("fs_read", {"path": "README.md", "max_chars": 500})
        with self.assertRaises(ToolValidationError):
            TOOL_REGISTRY.validate_params("fs_read", {})
        with self.assertRaises(ToolValidationError):
            TOOL_REGISTRY.validate_params("fs_read", {"path": "README.md", "max_chars": "no_es_entero"})

    def test_03_cognitive_goal_classification(self) -> None:
        """Verifica la clasificación de objetivos hacia los Escenarios A-F."""
        cog = CognitiveEngine()
        self.assertEqual(cog.classify_goal("Realizar investigación forense y contrastar fuentes"), "scenario_a_research")
        self.assertEqual(cog.classify_goal("Desarrollar una aplicación y corregir errores de test"), "scenario_b_build_app")
        self.assertEqual(cog.classify_goal("Observar la pantalla X11 y el navegador"), "scenario_c_computer_use")
        self.assertEqual(cog.classify_goal("Distribuir tarea en varios nodos del clúster"), "scenario_d_distributed")
        self.assertEqual(cog.classify_goal("Recuperar tarea tras reinicio desde checkpoint"), "scenario_e_crash_recovery")
        self.assertEqual(cog.classify_goal("Solicitar permiso para una capacidad que no posee"), "scenario_f_capability_request")

    def test_04_synthetic_dsp_and_vision_algorithms(self) -> None:
        """[SYNTHETIC_UNIT] Prueba sintética explícita de DSP de voz y delta PGM 30x30 en memoria."""
        from core.sensory.eyes import diff_pgm_30x30
        from core.sensory.speaker_id import extract_voice_embedding

        sample_rate = 16000
        pcm_samples = [int(12000 * math.sin(2 * math.pi * 220 * (i / sample_rate))) for i in range(sample_rate)]
        raw_pcm = struct.pack(f"<{len(pcm_samples)}h", *pcm_samples)
        emb = extract_voice_embedding(raw_pcm)
        self.assertEqual(len(emb), 12)

        frame_a = bytes([40] * 900)
        frame_b = bytes([180] * 900)
        delta = diff_pgm_30x30(frame_a, frame_b)
        self.assertGreater(delta, 0.4)


if __name__ == "__main__":
    unittest.main()

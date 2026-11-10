"""BENCHMARK SUITE TEST (`tests/test_06_benchmarks.py`) — DEE (Distributed Emergent Engine).
Autor: Facu Cercuetti (@NickDev24)

Ejecuta y verifica los benchmarks empíricos de la Sección 13:
- RAM RSS en reposo y con tareas activas.
- Tiempo de arranque.
- Latencia de herramientas y FTS5 BM25.
- Latencia de coordinación multiagente.
- Latencia de recuperación tras caída.
- Escalabilidad en 3 nodos.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from core.platform.benchmark import run_benchmarks


class TestDeeBenchmarksSuite(unittest.TestCase):
    def test_01_empirical_benchmarks_execution_and_thresholds(self) -> None:
        """Ejecuta la suite de benchmarks reales y comprueba que se persista la evidencia."""
        report = run_benchmarks()
        self.assertTrue(report["ok"])
        metrics = report["metrics"]
        self.assertGreater(metrics["ram_idle_rss_mb"], 5.0)
        # En hardware modesto sin GPU, el proceso Python + SQLite WAL debe mantenerse por debajo de 250 MB RSS
        self.assertLess(metrics["ram_active_rss_mb"], 250.0)
        self.assertGreater(metrics["fts5_query_internal_ms"], 0.0)
        self.assertLess(metrics["fts5_query_internal_ms"], 500.0)
        self.assertTrue(Path(report["artifact_path"]).exists())


if __name__ == "__main__":
    unittest.main()

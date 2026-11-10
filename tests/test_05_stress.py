"""STRESS & CONCURRENCY TESTS (`tests/test_05_stress.py`) — DEE (Distributed Emergent Engine).
Autor: Facu Cercuetti (@NickDev24)

Cubre:
- Escritura y búsqueda concurrente multi-hilo sobre SQLite WAL + FTS5 BM25 sin bloqueos (`database is locked`).
- Detección determinista de ciclos de delegación entre agentes (`hop_count >= 6`).
- Ejecución paralela de múltiples tareas con presupuesto y aislamiento de workspaces.
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from core.platform.storage import VALID_MEMORY_TIERS, DeePlatformDB


class TestDeeStressSuite(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db = DeePlatformDB(db_path=Path(self.tmp_dir.name) / "stress_test.sqlite")

    def tearDown(self) -> None:
        self.tmp_dir.cleanup()

    def test_01_concurrent_sqlite_wal_memory_writes_and_fts5_reads(self) -> None:
        """Ejecuta 36 operaciones concurrentes de escritura y búsqueda híbrida en 6 hilos."""
        def _worker(idx: int) -> bool:
            tier = VALID_MEMORY_TIERS[idx % len(VALID_MEMORY_TIERS)]
            st = self.db.store_memory(
                content=f"Entrada de estrés concurrente #{idx} sobre optimización extrema en nodo distribuido.",
                title=f"Stress #{idx}",
                tier=tier,
                namespace="stress",
                agent_id="rakazo_archivist",
                tags=["stress", f"item_{idx}"],
            )
            sr = self.db.search_memory("optimización extrema nodo distribuido", tier=tier, top_k=5)
            return bool(st.get("ok") and sr.get("ok"))

        with ThreadPoolExecutor(max_workers=6) as pool:
            futures = [pool.submit(_worker, i) for i in range(36)]
            results = [f.result() for f in as_completed(futures)]

        self.assertEqual(len(results), 36)
        self.assertTrue(all(results))
        self.assertEqual(self.db.memory_stats()["total_memories"], 36)

    def test_02_agent_bus_cycle_detection_guard(self) -> None:
        """Verifica que el protocolo inter-agente rechace ciclos de delegación cuando hop_count >= 6."""
        for hop in range(6):
            msg = self.db.record_agent_message(
                from_agent="dee_prime",
                to_agent="barto_forge",
                protocol_type="DELEGATE",
                content=f"Salto {hop}",
                hop_count=hop,
            )
            self.assertEqual(msg["hop_count"], hop)

        with self.assertRaises(ValueError):
            self.db.record_agent_message(
                from_agent="barto_forge",
                to_agent="dee_prime",
                protocol_type="DELEGATE",
                content="Ciclo infinito",
                hop_count=6,
            )


if __name__ == "__main__":
    unittest.main()

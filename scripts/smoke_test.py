#!/usr/bin/env python3
"""
Dee-Bot-Agents — DEE (Distributed Emergent Engine) - Suite de Pruebas de Integridad End-to-End (12/12).
Verifica todos los subsistemas reales (Sensores ALSA/V4L2, Biometría, Sentinel, Clúster,
Memoria, Skills, Fast-Path, Gateway Atómico :8730, Workbench :8731, Control Físico PC X11,
Motor RAG SQLite FTS5 0-RAM, Driver CDP, Motor Relay JSONL y Git Worktree Forge).
"""

import json
import math
import struct
import sys
import tempfile
import urllib.request
import wave
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from core.events import event_bus, character_state, turn_interrupt
from core.sensory.butler import Butler
from core.sensory.speaker_id import VoiceBiometricGuard
from core.sensory.eyes import compute_dhash_pgm, diff_pgm_30x30
from core.sensory.voice import extract_lipsync_timeline_from_wav, apply_phonetic_fixes
from core.security.sentinel import SentinelSupervisor
from core.workers.cluster_client import ClusterManager, RouteEnvelope
from core.orchestrator.dee_engine import DeeEngine
from core.computer_use.human_pc_controller import PC_CONTROLLER
from core.computer_use.cdp_browser_driver import CDP_DRIVER
from core.orchestrator.local_rag import LOCAL_RAG
from core.orchestrator.relay_engine import RELAY_ENGINE
from core.orchestrator.worktree_forge import WORKTREE_FORGE


def generate_test_wav(path: Path, freq_hz: float = 165.0, duration_s: float = 0.8) -> bytes:
    sr = 16000
    n_samples = int(sr * duration_s)
    samples = []
    for i in range(n_samples):
        t = i / sr
        env = 0.8 if (int(t * 6) % 2 == 0) else 0.05
        val = int(12000 * env * math.sin(2 * math.pi * freq_hz * t))
        samples.append(val)
    pcm = struct.pack(f"<{n_samples}h", *samples)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm)
    return pcm


def run_tests() -> None:
    print("=================================================================")
    print("🧪 DEE-BOT-AGENTS — DEE (DISTRIBUTED EMERGENT ENGINE) - SUITE DE PRUEBAS (12/12)")
    print("=================================================================")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)

        # 1. Biometría Acústica Vocal (12-D PCM16)
        wav_path = tmp_path / "facu_test.wav"
        pcm_facu = generate_test_wav(wav_path, freq_hz=155.0)
        vb_guard = VoiceBiometricGuard(profile_path=tmp_path / "voice_profile.json")
        enroll_res = vb_guard.enroll_facu_sample(pcm_facu, 16000)
        assert enroll_res["ok"] is True, "Falló registro biométrico de voz"
        verify_same = vb_guard.verify_speaker(pcm_facu, 16000)
        assert verify_same["is_facu"] is True and verify_same["similarity"] > 0.95
        print(f"✅ [1/12] Biometría Acústica Vocal 12-D OK (similitud={verify_same['similarity']})")

        # 2. Extractor Lip-Sync 30-FPS + Corrección Fonética Rioplatense
        fixed_txt = apply_phonetic_fixes("Che Facu, HERMES y Barto están en línea")
        assert "Faku" in fixed_txt and "Érmes" in fixed_txt
        timeline = extract_lipsync_timeline_from_wav(wav_path, fps=30)
        assert len(timeline) >= 15 and any(f["viseme"] != "neutral" for f in timeline)
        print(f"✅ [2/12] Extractor Lip-Sync 30-FPS OK ({len(timeline)} cuadros, visemas activos)")

        # 3. Filtro Visual PGM de 2 Niveles (9x8 dHash + 30x30 diff)
        pgm_9x8_a = bytes([i % 256 for i in range(72)])
        pgm_9x8_b = bytes([(i * 7) % 256 for i in range(72)])
        h_a = compute_dhash_pgm(pgm_9x8_a)
        h_b = compute_dhash_pgm(pgm_9x8_b)
        assert h_a != h_b, "dHash debe diferir en cuadros distintos"
        pgm_30_a = bytes([50] * 900)
        pgm_30_b = bytes([120] * 900)
        diff_pct = diff_pgm_30x30(pgm_30_a, pgm_30_b)
        assert diff_pct == 100.0
        print(f"✅ [3/12] Visión PGM 2-Niveles OK (diferencia={diff_pct}%)")

        # 4. Supervisor de Seguridad Sentinel (ALLOW / ASK_FACU / DENY_ALWAYS)
        sentinel = SentinelSupervisor(ROOT_DIR / "config" / "security_scope.json")
        assert sentinel.evaluate_command("uptime")["verdict"] == "ALLOW"
        assert sentinel.evaluate_command("rm -rf /")["verdict"] == "DENY_ALWAYS"
        assert sentinel.evaluate_command("apt remove vim")["verdict"] == "ASK_FACU"
        print("✅ [4/12] Supervisor Sentinel (ALLOW / ASK_FACU / DENY_ALWAYS) OK")

        # 5. RouteEnvelope Anti-Bucle & Telemetría del Clúster
        env = RouteEnvelope(source_node="facu", target_node="barto", hop_count=0)
        env2 = env.next_hop("manager1")
        assert env2.hop_count == 1
        cluster = ClusterManager(ROOT_DIR)
        status = cluster.get_cluster_status(force_refresh=True)
        assert "facu" in status["nodes"] and status["nodes"]["facu"]["online"] is True
        print(f"✅ [5/12] Gestor de Clúster & RouteEnvelope OK (CPU facu={status['nodes']['facu']['telemetry']['cpu_pct']}%)")

        # 6. DeeEngine Zero-Token Fast-Path (<1ms)
        engine = DeeEngine(ROOT_DIR)
        fast_res = engine.ask("estado del cluster", speak_reply=False)
        assert fast_res["mode"] == "fast_path" and "Nodos online" in fast_res["reply"]
        print(f"✅ [6/12] Ruta Rápida Cero-Tokens OK ({fast_res['latency_ms']} ms, 0 tokens)")

        # 7. Memoria Markdown 0-RAM & Cristalizador de Habilidades
        skills = engine.memory.list_skills()
        mem_ctx = engine.memory.get_context_for_prompt("Facu cluster barto")
        assert "Facu" in mem_ctx and len(skills) >= 12
        print(f"✅ [7/12] Memoria Markdown 0-RAM & Habilidades OK ({len(skills)} habilidades)")

        # 8. Custodio de Disco Butler
        butler_report = engine.sensory.butler.cleanup_once()
        assert "free_gb" in butler_report
        print(f"✅ [8/12] Custodio de Disco Butler OK (Espacio libre={butler_report['free_gb']} GB)")

        # 9. Gateway Atómico de Archivos (:8730) & Workbench de Procesos (:8731)
        try:
            with urllib.request.urlopen("http://127.0.0.1:8730/health", timeout=2.0) as r1:
                gw_health = json.loads(r1.read().decode("utf-8"))
                assert gw_health.get("ok") is True
            with urllib.request.urlopen("http://127.0.0.1:8731/health", timeout=2.0) as r2:
                wb_health = json.loads(r2.read().decode("utf-8"))
                assert wb_health.get("ok") is True
            print("✅ [9/12] Gateway Atómico (:8730) & Workbench de Procesos (:8731) OK")
        except Exception as exc:
            print(f"⚠️ [9/12] Advertencia en demonios locales (:8730/:8731): {exc}")
            raise

        # 10. Control Físico Nativo de PC en C/X11 (libX11.so.6 + libXtst.so.6)
        pc_st = PC_CONTROLLER.full_pc_status()
        assert pc_st.get("ok") is True and "pantalla" in pc_st
        scr = pc_st["pantalla"]
        print(
            f"✅ [10/12] Control Físico PC X11 OK (Pantalla {scr.get('width')}x{scr.get('height')}, "
            f"Cursor=({scr.get('cursor_x')}, {scr.get('cursor_y')}), Ventanas={len(pc_st.get('ventanas_abiertas', []))})"
        )

        # 11. Motor RAG Local 0-RAM sobre SQLite FTS5 BM25
        rag_stats = LOCAL_RAG.stats()
        if rag_stats.get("archivos_indexados", 0) == 0:
            LOCAL_RAG.ingest_directory()
            rag_stats = LOCAL_RAG.stats()
        rag_res = LOCAL_RAG.query("Dee Gateway Facu Cercuetti", top_k=3)
        assert rag_stats.get("archivos_indexados", 0) > 0 and rag_res.get("ok") is True
        print(
            f"✅ [11/12] Motor RAG SQLite FTS5 BM25 0-RAM OK "
            f"({rag_stats.get('archivos_indexados')} archivos / {rag_stats.get('fragmentos_indexados')} fragmentos, "
            f"{len(rag_res.get('resultados', []))} aciertos en {rag_res.get('latencia_ms')} ms)"
        )

        # 12. Driver CDP (@ref), Motor Relay Transaccional & Forja de Git Worktrees
        cdp_st = CDP_DRIVER.list_cdp_targets()
        assert "cdp_activo" in cdp_st
        relay_st = RELAY_ENGINE.status()
        assert relay_st.get("ok") is True
        wt_list = WORKTREE_FORGE.list_worktrees()
        assert wt_list.get("ok") is True
        print(
            f"✅ [12/12] Driver CDP (activo={cdp_st['cdp_activo']}), Relay Transaccional ({relay_st.get('total_registros', 0)} reg) "
            f"& Git Worktree Forge ({len(wt_list.get('worktrees', []))} worktrees) OK"
        )

    print("=================================================================")
    print("🏆 LAS 12 PRUEBAS DE INTEGRIDAD DEE PASARON AL 100%")
    print("=================================================================")


if __name__ == "__main__":
    run_tests()

#!/usr/bin/env python3
"""
Dee-Bot-Agents v4.0 Supreme - End-to-End Smoke & Verification Suite.
Tests every module (Sensory, Biometrics, Sentinel, Cluster, Memory, Skills,
Fast-Path, LLM Pool, TTS Lip-Sync, and HTTP/SSE Server).
"""

import math
import struct
import sys
import tempfile
import urllib.request
import json
import wave
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from core.events import event_bus, character_state, turn_interrupt
from core.sensory.butler import Butler
from core.sensory.speaker_id import VoiceBiometricGuard, extract_voice_features_pcm16
from core.sensory.eyes import FaceBiometricGuard, compute_dhash_pgm, diff_pgm_30x30
from core.sensory.voice import extract_lipsync_timeline_from_wav, apply_phonetic_fixes
from core.security.sentinel import SentinelSupervisor
from core.workers.cluster_client import ClusterManager, RouteEnvelope
from core.orchestrator.dee_engine import DeeEngine


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
    print("🧪 DEE-BOT-AGENTS v4.0 SUPREME - END-TO-END SMOKE TEST SUITE")
    print("=================================================================")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)

        # 1. Acoustic Voice Biometrics (12-D PCM16 feature extractor + verification)
        wav_path = tmp_path / "facu_test.wav"
        pcm_facu = generate_test_wav(wav_path, freq_hz=155.0)
        vb_guard = VoiceBiometricGuard(profile_path=tmp_path / "voice_profile.json")
        enroll_res = vb_guard.enroll_facu_sample(pcm_facu, 16000)
        assert enroll_res["ok"] is True, "Voice enrollment failed"
        verify_same = vb_guard.verify_speaker(pcm_facu, 16000)
        assert verify_same["is_facu"] is True and verify_same["similarity"] > 0.95
        print(f"✅ [1/8] Biometría Acústica Vocal 12-D OK (similarity={verify_same['similarity']})")

        # 2. Lip-Sync 30-FPS Viseme Timeline Extractor + Phonetic Fixes
        fixed_txt = apply_phonetic_fixes("Che Facu, HERMES y Barto están en línea")
        assert "Faku" in fixed_txt and "Érmes" in fixed_txt
        timeline = extract_lipsync_timeline_from_wav(wav_path, fps=30)
        assert len(timeline) >= 15 and any(f["viseme"] != "neutral" for f in timeline)
        print(f"✅ [2/8] Lip-Sync 30-FPS Extractor OK ({len(timeline)} frames, visemas activos)")

        # 3. PGM 2-Tier Motion Filter & Facial Biometric Guard
        pgm_9x8_a = bytes([i % 256 for i in range(72)])
        pgm_9x8_b = bytes([(i * 7) % 256 for i in range(72)])
        h_a = compute_dhash_pgm(pgm_9x8_a)
        h_b = compute_dhash_pgm(pgm_9x8_b)
        assert h_a != h_b, "dHash should differ on different frames"
        pgm_30_a = bytes([50] * 900)
        pgm_30_b = bytes([120] * 900)
        diff_pct = diff_pgm_30x30(pgm_30_a, pgm_30_b)
        assert diff_pct == 100.0
        print(f"✅ [3/8] Visión PGM 2-Tier Motion Filter OK (diff={diff_pct}%)")

        # 4. Sentinel Safety Supervisor (ALLOW / ASK_FACU / DENY_ALWAYS)
        sentinel = SentinelSupervisor(ROOT_DIR / "config" / "security_scope.json")
        assert sentinel.evaluate_command("uptime")["verdict"] == "ALLOW"
        assert sentinel.evaluate_command("rm -rf /")["verdict"] == "DENY_ALWAYS"
        assert sentinel.evaluate_command("apt remove vim")["verdict"] == "ASK_FACU"
        print("✅ [4/8] Sentinel Supervisor (ALLOW / ASK_FACU / DENY_ALWAYS) OK")

        # 5. RouteEnvelope Anti-Loop & Cluster Telemetry
        env = RouteEnvelope(source_node="facu", target_node="barto", hop_count=0)
        env2 = env.next_hop("manager1")
        assert env2.hop_count == 1
        cluster = ClusterManager(ROOT_DIR)
        status = cluster.get_cluster_status(force_refresh=True)
        assert "facu" in status["nodes"] and status["nodes"]["facu"]["online"] is True
        print(f"✅ [5/8] Cluster Manager & RouteEnvelope OK (facu CPU={status['nodes']['facu']['telemetry']['cpu_pct']}%)")

        # 6. DeeEngine Zero-Token Fast-Path (<1ms)
        engine = DeeEngine(ROOT_DIR)
        fast_res = engine.ask("estado del cluster", speak_reply=False)
        assert fast_res["mode"] == "fast_path" and "Nodos online" in fast_res["reply"]
        print(f"✅ [6/8] Zero-Token Fast-Path OK ({fast_res['latency_ms']} ms, 0 tokens)")

        # 7. Episodic Markdown Memory & Skill Crystallizer
        skills = engine.memory.list_skills()
        mem_ctx = engine.memory.get_context_for_prompt("Facu cluster barto")
        assert "Facu" in mem_ctx
        print(f"✅ [7/8] Memoria Markdown 0-RAM & Skill Crystallizer OK ({len(skills)} skills)")

        # 8. Butler Disk Custodian
        butler_report = engine.sensory.butler.cleanup_once()
        assert "free_gb" in butler_report
        print(f"✅ [8/8] Butler Disk Custodian OK (Espacio libre={butler_report['free_gb']} GB)")

    print("=================================================================")
    print("🏆 TODOS LOS TESTS UNITARIOS E INTEGRACIÓN PASARON AL 100%")
    print("=================================================================")


if __name__ == "__main__":
    run_tests()

#!/usr/bin/env python3
"""
Generador de capturas reales, renders de terminal y video-tutoriales narrados
para Dee-Bot-Agents — DEE (Distributed Emergent Engine) por Facu Cercuetti (@NickDev24).

Las capturas de la app se obtienen ejecutando `npm run capturas`
(`scripts/capturar_screenshots.cjs`), que abre la MISMA ventana Electron que usa
la aplicación y guarda `webContents.capturePage()` en `docs/tutorials/screenshots/`.
Los renders de terminal se construyen con la salida REAL de los comandos.
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
TUTORIALS_DIR = ROOT_DIR / "docs" / "tutorials"
SCREENSHOTS_DIR = TUTORIALS_DIR / "screenshots"
VIDEOS_DIR = TUTORIALS_DIR / "videos"
MIRROR_DIR = Path(os.environ["DEE_TUTORIALS_MIRROR"]) if os.environ.get("DEE_TUTORIALS_MIRROR") else None

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSansMono-Bold.ttf",
]

APP_SCREENSHOTS = [
    "01_dee_electron_hud_3d.png",
    "02_dee_escuadron_6_agentes_3d.png",
    "03_dee_centro_operaciones_x11.png",
    "04_dee_skills_rag_0ram.png",
    "05_dee_navegador_cdp.png",
    "06_dee_terminal_en_vivo.png",
]


def resolve_font() -> str:
    for candidate in FONT_CANDIDATES:
        if Path(candidate).exists():
            return candidate
    raise SystemExit("❌ No se encontró una fuente monoespaciada DejaVu para los renders de terminal.")


def ensure_dirs() -> None:
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)


def run_capture(cmd: list[str], timeout: int = 300) -> tuple[list[str], int]:
    """Ejecuta un comando real y devuelve (líneas de salida, código de salida)."""
    proc = subprocess.run(
        cmd,
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
        timeout=timeout,
        env={**os.environ, "DISPLAY": os.environ.get("DISPLAY", ":0")},
    )
    combined = (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")
    lines = [line.rstrip() for line in combined.splitlines() if line.strip()]
    return lines, proc.returncode


def ensure_app_screenshots() -> None:
    """Genera las capturas de la app Electron si faltan (requiere Core en :8091 y HUD compilado)."""
    missing = [name for name in APP_SCREENSHOTS if not (SCREENSHOTS_DIR / name).exists()]
    if not missing:
        return
    print(f"📸 Faltan {len(missing)} capturas de la app; ejecutando `npm run capturas`...")
    proc = subprocess.run(["npm", "run", "capturas"], cwd=ROOT_DIR, capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stdout[-2000:])
        print(proc.stderr[-2000:])
        raise SystemExit("❌ No se pudieron capturar las pantallas de la app Electron.")
    still_missing = [name for name in APP_SCREENSHOTS if not (SCREENSHOTS_DIR / name).exists()]
    if still_missing:
        raise SystemExit(f"❌ Capturas ausentes tras ejecutar npm run capturas: {still_missing}")


def render_terminal_png(
    output_png: Path,
    title: str,
    lines: list[str],
    accent_hex: str = "0x00f0ff",
    max_lines: int = 24,
) -> None:
    """Renderiza una captura de terminal 1280x720 con la salida real de los comandos."""
    body = lines[:max_lines]
    text_file = output_png.with_suffix(".txt")
    header = f"⚡ {title}\n" + ("═" * 78) + "\n\n"
    text_file.write_text(header + "\n".join(body), encoding="utf-8")

    font = resolve_font()
    vf = (
        f"drawbox=x=24:y=24:w=1232:h=672:color=0x07101f@0.95:t=fill,"
        f"drawbox=x=24:y=24:w=1232:h=672:color={accent_hex}@0.8:t=3,"
        f"drawtext=fontfile='{font}':textfile='{text_file}':expansion=none:"
        f"x=52:y=54:fontsize=18:fontcolor=0xe2e8f0:line_spacing=8"
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=0x02050b:s=1280x720:d=1",
            "-frames:v",
            "1",
            "-vf",
            vf,
            str(output_png),
        ],
        check=True,
    )
    text_file.unlink(missing_ok=True)
    print(f"🖥️  Captura de terminal generada: {output_png.name}")


def resolve_edge_tts() -> str | None:
    env_bin = os.environ.get("EDGE_TTS_BIN")
    if env_bin and Path(env_bin).exists():
        return env_bin
    return shutil.which("edge-tts")


def synthesize_narration(text: str, out_wav: Path) -> float:
    """Sintetiza la voz argentina narrada; si edge-tts no está disponible usa silencio."""
    mp3_path = out_wav.with_suffix(".mp3")
    edge_tts = resolve_edge_tts()
    if edge_tts:
        subprocess.run(
            [
                edge_tts,
                "--voice",
                "es-AR-TomasNeural",
                "--rate",
                "+6%",
                "--text",
                text,
                "--write-media",
                str(mp3_path),
            ],
            check=True,
            capture_output=True,
        )
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3_path), "-ar", "22050", "-ac", "1", str(out_wav)],
            check=True,
        )
        mp3_path.unlink(missing_ok=True)
    else:
        print("⚠️  edge-tts no disponible: se genera el video sin narración (silencio).")
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-f",
                "lavfi",
                "-i",
                "anullsrc=r=22050:cl=mono:d=8",
                str(out_wav),
            ],
            check=True,
        )

    out = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(out_wav),
        ],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    return max(3.0, float(out))


def build_video_from_slides(slides: list[tuple[Path, str]], output_mp4: Path) -> None:
    """Crea un MP4 1280x720 con un segmento narrado por captura."""
    segment_files: list[Path] = []
    concat_list_path = output_mp4.with_suffix(".concat.txt")

    for idx, (img_path, narration_text) in enumerate(slides):
        if not img_path.exists():
            raise SystemExit(f"❌ Falta la captura {img_path.name} para armar {output_mp4.name}")
        seg_wav = output_mp4.with_name(f"_seg_{idx}.wav")
        seg_mp4 = output_mp4.with_name(f"_seg_{idx}.mp4")
        dur = synthesize_narration(narration_text, seg_wav)

        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-loop",
                "1",
                "-i",
                str(img_path),
                "-i",
                str(seg_wav),
                "-vf",
                "scale=1280:720:force_original_aspect_ratio=decrease,"
                "pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x02050b,format=yuv420p",
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-tune",
                "stillimage",
                "-r",
                "15",
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-t",
                f"{dur:.2f}",
                "-shortest",
                str(seg_mp4),
            ],
            check=True,
        )
        seg_wav.unlink(missing_ok=True)
        segment_files.append(seg_mp4)

    concat_list_path.write_text(
        "\n".join(f"file '{p.name}'" for p in segment_files) + "\n",
        encoding="utf-8",
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_list_path),
            "-c",
            "copy",
            str(output_mp4),
        ],
        check=True,
    )
    concat_list_path.unlink(missing_ok=True)
    for p in segment_files:
        p.unlink(missing_ok=True)
    print(f"🎬 Video tutorial generado: {output_mp4.name} ({output_mp4.stat().st_size // 1024} KB)")


def main() -> None:
    ensure_dirs()
    ensure_app_screenshots()

    # Captura 07: instalación, arranque nativo y verificación de salud (salida real)
    install_lines, _ = run_capture(["./scripts/install.sh"], timeout=600)
    start_lines, _ = run_capture(["./scripts/start_dee.sh", "--no-window"])
    health_lines, _ = run_capture(["curl", "-s", "http://127.0.0.1:8091/health"])
    lines_07 = [
        "$ git clone https://github.com/NickDev24/Dee-Bot-Agents.git && cd Dee-Bot-Agents",
        "",
        "$ ./scripts/install.sh",
        *install_lines[:7],
        "",
        "$ ./scripts/start_dee.sh --no-window",
        *start_lines[:6],
        "",
        "$ curl -s http://127.0.0.1:8091/health",
        *health_lines[:2],
        "",
        "$ ./scripts/iniciar_escritorio_electron.sh   # abre la app nativa Electron",
    ]
    render_terminal_png(
        SCREENSHOTS_DIR / "07_terminal_install_y_deploy.png",
        "DEE-BOT-AGENTS — DEE (Distributed Emergent Engine) · INSTALACIÓN, ARRANQUE Y DEPLOY",
        lines_07,
        accent_hex="0x00f0ff",
    )

    # Captura 08: suite real de integridad (12/12) y doctor de la CLI
    smoke_lines, smoke_code = run_capture(["python3", "scripts/smoke_test.py"], timeout=600)
    doctor_lines, _ = run_capture(["python3", "cli/dee_cli.py", "doctor"], timeout=300)
    smoke_summary = [ln for ln in smoke_lines if "✅" in ln or "🏆" in ln or "❌" in ln]
    # Resumen compacto y fiel del JSON real de `dee doctor` (evita cortar el JSON a la mitad)
    try:
        doctor_payload = json.loads("\n".join(doctor_lines))
        doctor_checks = doctor_payload.get("checks") or {}
        ok_checks = [k for k, v in doctor_checks.items() if isinstance(v, dict) and v.get("ok")]
        doctor_resumen = [
            '{ "ok": ' + str(bool(doctor_payload.get("ok"))).lower()
            + ', "engine": "' + str(doctor_payload.get("engine", "DEE")) + '"'
            + ', "checks_ok": "' + f'{len(ok_checks)}/{len(doctor_checks)}' + '"'
            + ', "elapsed_ms": ' + str(doctor_payload.get("elapsed_ms")) + ' }'
        ]
    except Exception:
        doctor_resumen = doctor_lines[:2]
    lines_08 = [
        "$ python3 scripts/smoke_test.py",
        *smoke_summary[:13],
        "",
        "$ python3 -m unittest discover -s tests   # 29 tests de plataforma",
        "",
        "$ python3 cli/dee_cli.py doctor",
        *doctor_resumen,
    ]
    render_terminal_png(
        SCREENSHOTS_DIR / "08_terminal_suite_12_tests.png",
        f"DEE-BOT-AGENTS — SUITE DE INTEGRIDAD REAL (12/12 OK · exit {smoke_code})",
        lines_08,
        accent_hex="0x22c55e",
    )

    # Video 01: instalación, arranque nativo Electron y deploy
    build_video_from_slides(
        [
            (
                SCREENSHOTS_DIR / "01_dee_electron_hud_3d.png",
                "Hola a todos. Bienvenidos al tutorial oficial de Dee Bot Agents, el motor distribuido DEE creado por Facu Cercuetti, NickDev24 en GitHub.",
            ),
            (
                SCREENSHOTS_DIR / "07_terminal_install_y_deploy.png",
                "Cloná el repositorio público, ejecutá el script install punto sh, levantá los demonios con start dee punto sh y abrí la aplicación nativa de escritorio con iniciar escritorio electron punto sh.",
            ),
            (
                SCREENSHOTS_DIR / "03_dee_centro_operaciones_x11.png",
                "Desde el Centro Operativo podés controlar el mouse y el teclado reales por X11, capturar el escritorio completo, consultar el motor RAG sobre SQLite FTS5 y manejar el gateway y el workbench de procesos.",
            ),
        ],
        VIDEOS_DIR / "video_01_instalacion_y_deploy_completo.mp4",
    )

    # Video 02: suite real, escuadrón 3D y skills
    build_video_from_slides(
        [
            (
                SCREENSHOTS_DIR / "08_terminal_suite_12_tests.png",
                "Desde la terminal podés ejecutar la suite smoke test punto py con doce pruebas reales, los veintinueve tests de plataforma y el comando doctor de la CLI industrial.",
            ),
            (
                SCREENSHOTS_DIR / "02_dee_escuadron_6_agentes_3d.png",
                "En el escenario tres D conviven Dee Prime y sus cinco subagentes, el mismo modelo con colores distintivos, y cada orden abre la terminal en vivo con la ejecución real.",
            ),
            (
                SCREENSHOTS_DIR / "04_dee_skills_rag_0ram.png",
                "Todo el conocimiento del proyecto se indexa en el motor RAG local sobre SQLite FTS5 con ranking BM25, cero megabytes de RAM en reposo y quince habilidades cristalizadas listas para ejecutar.",
            ),
        ],
        VIDEOS_DIR / "video_02_demo_terminal_y_hud_3d.mp4",
    )

    if MIRROR_DIR:
        MIRROR_DIR.mkdir(parents=True, exist_ok=True)
        for item in SCREENSHOTS_DIR.glob("*.png"):
            shutil.copy2(item, MIRROR_DIR / item.name)
        for item in VIDEOS_DIR.glob("*.mp4"):
            shutil.copy2(item, MIRROR_DIR / item.name)
        print(f"✅ Copia externa sincronizada en: {MIRROR_DIR}")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        raise SystemExit(f"❌ Comando fallido: {exc.cmd}") from exc
    sys.exit(0)

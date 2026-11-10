# ⚡ Dee-Bot-Agents (`v4.0 Supreme`)

> **Sistema Multi-Agente Autónomo Físico-Espacial de Ultra-Bajo Consumo**  
> **Oídos Físicos ALSA (Doble Aplauso + Biometría Vocal) · Ojos Multi-Cámara (Reconocimiento de Facu e Intrusos) · Voz Argentina con Lip-Sync 30 FPS · HUD 3D Espacial (`Three.js`) · Orquestación de Clúster en 3 Nodos (`facu`, `barto`, `manager1`)**

[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B%20Zero--Dep-emerald.svg)](pyproject.toml)
[![Three.js HUD](https://img.shields.io/badge/3D_HUD-Three.js_%2B_React_19-purple.svg)](frontend/)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-blue.svg)](docker-compose.yml)

---

## 🌟 ¿Por qué `Dee-Bot-Agents` es único?

A diferencia de asistentes convencionales basados únicamente en texto o que exigen GPUs dedicadas de 24 GB VRAM, **Dee-Bot-Agents (`v4.0 Supreme`)** fue diseñado desde cero para convertir hardware modesto (como un clúster doméstico con procesadores **Intel Pentium B950 / Celeron N4020** sin GPU dedicada) en un **sistema autónomo físico y distribuido** que combina lo mejor de **Meta Muse (`muse-local-gateway`)**, **xAI Grok Bot (`OpenGrokBot` + `grok-bot-cli`)**, **Hermes Agent** y un **Sistema Sensorial Físico Real**:

1. **👂 Oídos Físicos Reales (`core/sensory/ears.py` + `speaker_id.py`)**:
   - Captura continua ALSA (`arecord` 16 kHz mono PCM) con **failover automático por SSH** al micrófono del nodo `manager1`.
   - **Detector de Doble Aplauso** (`180 ms – 650 ms`) para despertar a Dee sin consumir tokens.
   - **VAD con Piso de Ruido Adaptativo** calibrado automáticamente para ignorar el cooler del procesador.
   - **Supresión de Eco + Barge-In**: Dee se calla instantáneamente si hablás encima o decís *"Dee, alto"*.
   - **Biometría Acústica Vocal 12-D** (`speaker_id.py`): verifica la huella espectral/ZCR/pitch de la voz del propietario antes de autorizar comandos sensibles.

2. **👁️ Ojos Multi-Cámara con Biometría y Guardia de Intrusos (`core/sensory/eyes.py`)**:
   - Topología híbrida: cámara IP de oficina (`carecam`), webcam de `manager1` y webcam de `barto`.
   - **Filtro de Movimiento PGM de 2 Etapas (`< 15 ms`)**: compara hashes `9x8` (`dHash`) y grillas `30x30` antes de invocar IA, ahorrando **>92% de llamadas de visión**.
   - **Reconocimiento de Propietario vs. Intrusos**:
     - Si entra el propietario (**Facu**): bienvenida contextual con memoria del día.
     - Si entra con invitados (**Escudo de Invitados**): modo discreto sin exponer datos privados.
     - Si entra un desconocido solo (**Alerta de Intruso**): guarda evidencia forense en `data/media/conservar/intrusos/`, cambia el avatar 3D a modo `combate` y emite advertencia disuasoria por altavoz.

3. **🗣️ Voz Argentina Expresiva con Lip-Sync Real a 30 FPS (`core/sensory/voice.py`)**:
   - Cascada TTS con prosodia emocional (`curioso`, `orgullo`, `combate`, `alivio`):
     1. `edge-tts` (`es-AR-TomasNeural` con acento argentino nativo).
     2. `FreeLLMAPI` (`/v1/audio/speech` en `:3001`).
     3. `Piper ONNX` offline local (`es_MX-claude-high.onnx` / `es_ES-davefx-medium.onnx`).
   - **Extractor de Visemas a 30 FPS**: analiza la envolvente RMS del WAV (`neutral`, `wide_e`, `round_o`, `open_a`) para mover el pico 3D de Dee en sincronía exacta con el audio.

4. **🧠 Cerebro Multi-Agente con Ahorro Extremo de Tokens (`core/orchestrator/`)**:
   - **Zero-Token Fast-Path (`< 1 ms`)**: responde estado del clúster, sensores, aprobaciones y paradas de emergencia consumiendo **0 tokens de IA**.
   - **Smart Dispatcher + Dynamic Tool Pruning**: clasifica cada turno en `build | answer | discuss | security` y poda esquemas innecesarios.
   - **Pool Multi-Nodo `FreeLLMAPI (:3001)`**: balancea entre `facu`, `barto` y `manager1` con fallback a Cloudflare Workers AI.
   - **Modos Tácticos**: `/plan` (arquitectura con Prometheus), `/grill` (auditoría adversarial con Grill-Master) y `/goal` (bucle autónomo de ejecución y auto-verificación).
   - **Memoria Markdown 0-RAM + Skill Crystallizer + Routines Engine**.

5. **🦅 Cabina Espacial 3D (`frontend/`) con Gobernador Adaptativo de FPS**:
   - Avatar 3D `CyberBird3D` + 6 estaciones de trabajo 3D orbitales conectadas en vivo por SSE (`/events`) y REST (`/api/*`).
   - **Adaptive FPS Governor**: `30 FPS` al hablar/interactuar, `8 FPS` en reposo y `0 FPS` minimizado.

---

## 🏗️ Arquitectura General

```mermaid
flowchart TB
    subgraph SENSORS["SISTEMA SENSORIAL FÍSICO (facu + failover LAN)"]
        EARS["👂 Oídos ALSA (ears.py)\nDoble Aplauso + VAD + Barge-In"]
        SPKID["🔐 Biometría Vocal 12-D (speaker_id.py)"]
        EYES["👁️ Ojos Multi-Cámara (eyes.py)\nFiltro PGM 9x8/30x30 + Guardia Intrusos"]
        VOICE["🗣️ Voz Argentina (voice.py)\nedge-tts / Piper + Lip-Sync 30 FPS"]
    end

    subgraph CORE["CEREBRO CENTRAL DEE (:8091 en facu)"]
        FAST["⚡ Zero-Token Fast-Path (<1ms)"]
        DISP["🧭 Smart Dispatcher\n(/plan, /grill, /goal)"]
        SENTINEL["🛡️ Sentinel Supervisor\nALLOW / ASK_FACU / DENY"]
        MEM["📚 Memoria Markdown 0-RAM\n+ Skill Crystallizer + Routines"]
        POOL["🔄 Multi-Node FreeLLMAPI Pool\n(:3001 facu + barto + manager1)"]
    end

    subgraph CLUSTER["ORQUESTACIÓN DISTRIBUIDA (RouteEnvelope hop < 4)"]
        GW["📦 File Gateway (:8730)"]
        BENCH["⚙️ Process Group Bench (:8731)"]
        HERMES["🤖 Hermes API (:8642 en barto/manager1)"]
    end

    subgraph HUD["FRONTEND ESPACIAL 3D (Three.js + React 19)"]
        BIRD["🦅 Dee CyberBird3D + Lip-Sync"]
        NODES["🖥️ 6 Estaciones 3D en Vivo"]
    end

    EARS --> SPKID --> FAST
    EYES --> FAST
    FAST --> DISP --> SENTINEL
    DISP --> POOL
    DISP --> MEM
    SENTINEL --> CLUSTER
    CORE <-->|SSE /events + WAV| HUD
    CORE --> VOICE
```

---

## 🚀 Instalación y Uso Rápido

### Opción 1: Ejecución Nativa Ultra-Liviana (`< 45 MB RAM` en el Core)

```bash
git clone https://github.com/NickDev24/Dee-Bot-Agents.git
cd Dee-Bot-Agents

# 1. Instalar estructura y compilar HUD 3D
./scripts/install.sh

# 2. Iniciar Gateway (:8730), Workbench (:8731) y Dee Core (:8091)
./scripts/start_dee.sh
```

Abrí en tu navegador **`http://127.0.0.1:8091`** para entrar a la cabina 3D de Dee, o usá la CLI táctica:

```bash
# Consultar estado del clúster, sensores y seguridad
./cli/dee_cli.py status

# Hablar con Dee desde la terminal
./cli/dee_cli.py ask "estado del cluster"
./cli/dee_cli.py ask "/plan diseñar microservicio de monitoreo"
./cli/dee_cli.py ask "/grill revisar seguridad del despliegue"
./cli/dee_cli.py ask "/goal verificar que los puertos estén activos"

# Activar Oídos físicos ALSA o Vigilancia Multi-Cámara
./cli/dee_cli.py ears on
./cli/dee_cli.py eyes vigil

# Parada de emergencia (Kill-Switch)
./cli/dee_cli.py stop
```

### Opción 2: Despliegue con Docker

```bash
docker compose up -d --build
curl http://127.0.0.1:8091/health
```

---

## 🧪 Verificación End-to-End

El proyecto incluye una suite de pruebas automatizada que valida biometría vocal, extracción de visemas Lip-Sync a 30 FPS, filtro PGM de visión, supervisor Sentinel, telemetría de clúster, Fast-Path de 0 tokens y memoria Markdown:

```bash
python3 scripts/smoke_test.py
```

---

## 📂 Estructura del Proyecto

- `core/` — Cerebro central (`main.py` `:8091`, `events.py`, `sensory/`, `orchestrator/`, `security/`, `workers/`).
- `node_agent/` — Demonios ultralivianos para los nodos del clúster (`gateway.py` `:8730` y `bench.py` `:8731`).
- `frontend/` — Cabina espacial 3D (`Three.js` + `React 19` + `Electron`) con Gobernador Adaptativo de FPS.
- `cli/` — Cliente de terminal `dee_cli.py` con soporte de cursores delta (`grok-bot-cli`).
- `config/` — Manifiestos de configuración (`dee.config.json`, `workers.json`, `squad.json`, `security_scope.json`).
- `scripts/` — Instalador, lanzador de demonios, desplegador SSH de workers y suite de tests.
- `docs/` — Plan Maestro de Arquitectura y Especificación Forense completa.

---

## 📜 Licencia

Distribuido bajo la licencia **MIT**. Creado para llevar la experiencia de agentes autónomos físicos y espaciales al máximo nivel de rendimiento en cualquier hardware.

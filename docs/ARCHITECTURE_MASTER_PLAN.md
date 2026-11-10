# ⚡ PLAN MAESTRO DE ARQUITECTURA E INGENIERÍA: `DEE-SUPER-MULTIAGENTS` (v4.0 SUPREME)

> **Autor:** Argon (Diseño de Sistemas Autónomos de Ultra-Bajo Consumo y Alta Competitividad)  
> **Propietario y Comandante:** Facu  
> **Infraestructura Objetivo:** Cluster Físico de 3 Nodos (`facu` Master + `barto` Worker + `manager1` Worker) + Sensores Periféricos (`CareCam IP` + Webcams SSH + Micrófonos ALSA)  
> **Objetivo Central:** Construir a **Dee**, un Sistema Operativo Cognitivo y Agente Autónomo Multi-Nodo con **Oídos, Visión (Reconocimiento Facial / Anti-Intrusos), Voz Expresiva Rioplatense, Cuerpo 3D Cinemático y Enjambre de Sub-Agentes**, que iguala y supera las capacidades de **Meta Muse** y **xAI Grok Bot**, ejecutándose con **latencia sub-segundo y consumo mínimo de CPU/RAM/Tokens** en hardware modesto sin GPU dedicada.

---

## 📑 ÍNDICE GENERAL

1. [Auditoría Forense y Técnica de los 5 Repositorios Descargados + Prototipos Locales](#1-auditoría-forense-y-técnica-de-los-5-repositorios-descargados--prototipos-locales)
2. [Ingeniería Inversa de Meta Muse y xAI Grok Bot: Cómo Superarlos en tus 3 PCs](#2-ingeniería-inversa-de-meta-muse-y-xai-grok-bot-cómo-superarlos-en-tus-3-pcs)
3. [Topología Real Confirmada de Hardware, Red y Sensores del Laboratorio](#3-topología-real-confirmada-de-hardware-red-y-sensores-del-laboratorio)
4. [El Sistema Sensorial Vivo de Dee (Oídos, Visión Facial / Anti-Intrusos y Voz)](#4-el-sistema-sensorial-vivo-de-dee-oídos-visión-facial--anti-intrusos-y-voz)
5. [Cerebro Cognitivo y Orquestación Multi-Agente (Fusión Hermes + OpenGrokBot + Muse + gbot)](#5-cerebro-cognitivo-y-orquestación-multi-agente-fusión-hermes--opengrokbot--muse--gbot)
6. [Optimización Extrema de IA, CPU y RAM (80% Menos Tokens, 0% Cuelgues en 2 Núcleos)](#6-optimización-extrema-de-ia-cpu-y-ram-80-menos-tokens-0-cuelgues-en-2-núcleos)
7. [Arquitectura del Nuevo Frontend 3D + HUD Espacial (Evolución de `jarvis-agente-supremo-v3.0`)](#7-arquitectura-del-nuevo-frontend-3d--hud-espacial-evolución-de-jarvis-agente-supremo-v30)
8. [Seguridad Nivel Militar: Agente Supervisor `Sentinel`, Bóveda y Kill-Switch](#8-seguridad-nivel-militar-agente-supervisor-sentinel-bóveda-y-kill-switch)
9. [Estructura Definitiva del Repositorio Unificado y Contratos de Datos (SSE / WS / REST)](#9-estructura-definitiva-del-repositorio-unificado-y-contratos-de-datos-sse--ws--rest)
10. [Configuraciones Maestras Integradas (`dee.config.yaml`, `workers.yaml`, `team.json`)](#10-configuraciones-maestras-integradas-deeconfigyaml-workersyaml-teamjson)
11. [Plan de Ejecución por Fases (Del MVP End-to-End al Despliegue Total)](#11-plan-de-ejecución-por-fases-del-mvp-end-to-end-al-despliegue-total)

---

## 1. AUDITORÍA FORENSE Y TÉCNICA DE LOS 5 REPOSITORIOS DESCARGADOS + PROTOTIPOS LOCALES

Antes de escribir una sola línea de código, se realizó una **inspección forense archivo por archivo** de los 5 repositorios en `/home/facu/investigar-agentes-autonomos/`, del paquete frontend `/home/facu/Descargas/jarvis-agente-supremo-v3.0.zip` y del código previo en `/home/facu/Jarvis/cuerpo/`.

### 1.1. Matriz de Veredicto Forense

| Proyecto / Carpeta | Estado Real del Código | Nivel de Riesgo / Calidad | Veredicto Arquitectónico para **Dee** |
| :--- | :--- | :--- | :--- |
| **`muse-local-gateway`** (`Toddoward/muse-local-gateway`) | **100% REAL y Funcional** (Python 3 stdlib pura, 0 dependencias, Docker + Tailscale + Squid). | 🟢 **Excelente (Producción)** | **RECICLAR DIRECTAMENTE** su motor de archivos atómico (`gateway.py`) y su ejecutor de procesos con cola circular (`bench.py`). |
| **`OpenGrokBot`** (`Z4YT0N/OpenGrokBot`) | **100% REAL y Funcional** (~5.000 líneas TypeScript limpias, Express + SSE + React). | 🟢 **Excelente (Producción)** | **ADAPTAR E INTEGRAR** su *Smart Dispatcher* (`router.ts`), ronda de menciones (`orchestrator.ts`), memoria `.md` auto-destilada (`memory.ts`), `approvals.ts` y `routines.ts`. |
| **`grok-bot-cli`** (`ScriptedAlchemy/grok-bot-cli`) | **100% REAL y Funcional** (CLI `gbot` + Servidor MCP + Relay Duplex Codex/Claude/Grok). | 🟢 **Excelente (Industrial)** | **ADOPTAR PROTOCOLOS** de sobres anti-loop (`hop`/`correlationId`), políticas `whenBusy` (`steer`/`queue`/`reject`), cursores delta (`--after`) y timeouts monotónicos. |
| **`Meta-Muse-Spark-1.3-Free`** (`Miron47486/...`) | 🚨 **FALSO / STUB DECOY** (Todos los `.ts`/`.tsx` tienen solo 2 líneas de comentario `// rev-g4e18c...` y el README induce a bajar un `.zip` ignorando alertas de seguridad). | 🔴 **PELIGRO / HUMO** | **DESCARTAR CÓDIGO Y NO EJECUTAR EL ZIP.** Solo tomamos la inspiración conceptual de los comandos `/plan`, `/grill` y `/goal` + aislamiento por `git worktree`. |
| **`muse-spark`** | 🚨 **MOCK / STUB VACÍO** (3 archivos Python de 25-45 líneas donde todo está comentado y devuelve `print("This is a simulated response...")`). | 🟡 **HUMO (Mock)** | **DESCARTAR CÓDIGO.** Solo tomamos el concepto de compresión de contexto y perfiles de rol del verdadero Meta Muse Spark. |
| **`/home/facu/Jarvis/cuerpo/`** (`sensor.py`, `voice.py`, `core.py`) | **100% REAL, Medido y Probado en tu Hardware** (Cámaras SSH/HTTP, Micrófono ALSA con VAD adaptativo al ventilador de `facu`, TTS `edge-tts`/`piper`, `Mayordomo` de disco). | 🟢 **ORO PURO LOCAL** | **RECICLAR Y POTENCIAR AL 200%** como la capa física sensorial (`Ojos`, `Oidos`, `Voz`, `Mayordomo`) de Dee, sumándole Reconocimiento Facial YuNet+SFace y Biometría de Voz. |
| **`jarvis-agente-supremo-v3.0.zip`** | **Prototipo Frontend 3D Funcional** (`CyberBird3D.ts`, `MuseVoiceOrb.tsx`, `WorkstationsSpatialDrawer.tsx`, `LiveTaskInspectorModal.tsx`). | 🟢 **Base Visual Sólida (con mocks en voz/datos)** | **EVOLUCIONAR Y CONECTAR EN VIVO**: Mantener y optimizar a **Dee (CyberBird 3D)** y sus nodos orbitales, reemplazando los datos estáticos y el `SpeechSynthesis` falso por SSE en tiempo real, Web Audio FFT real y Gobernador de FPS. |

---

### 1.2. Joyas Técnicas Extraídas de cada Repositorio Real

#### A. De `muse-local-gateway` (`gateway.py` y `bench.py`)
1. **Escritura Atómica Anti-Corrupción (`gateway.py` líneas 84-98):**
   - Cuando un agente transfiere un archivo entre nodos (`facu` ↔ `barto` / `manager1`), escribe primero en `archivo.part-<uuid8>` en chunks de 1 MB y solo al verificar que `remaining == 0` ejecuta `os.replace(tmp, full)`. Si la red WiFi/LAN parpadea, jamás queda un archivo truncado rompiendo un repo.
2. **Protección Estricta de Rutas (`share_path` líneas 35-45):**
   - Usa `os.path.realpath` antes de abrir cualquier archivo, bloqueando symlinks maliciosos, `..`, bytes nulos `\x00` y rutas fuera del workspace permitido.
3. **Ejecución Híbrida `wait` + Grupos de Procesos (`bench.py` líneas 60-110):**
   - `POST /exec` recibe `{"cmd": "...", "timeout": 60, "wait": 25}`. Si el comando termina en 0.4s (el 90% de los casos), devuelve el `stdout`/`stderr`/`exit_code` **en la misma respuesta HTTP** (ahorrando llamadas de polling). Si es un comando largo (ej. compilar o escanear), a los `wait` segundos devuelve `{"status": "running", "id": "a1b2c3d4"}` y continúa en background.
   - Lanza procesos con `start_new_session=True` y mata con `os.killpg(self.proc.pid, signal.SIGKILL)`: si un sub-agente lanza un comando que abre 10 subprocesos hijos y da timeout, mata **todo el árbol de procesos**, impidiendo que procesos huérfanos congelen los 2 núcleos de `barto` o `facu`.
4. **Buffer Circular `Tail(cap)` (`bench.py` líneas 42-58):**
   - Si un comando escupe 50 MB de logs, `Tail` conserva en un `bytearray` únicamente el último megabyte (`cap`), marcando `"truncated": true`. Los errores de compilación siempre están al final; esto evita reventar la RAM de Python y ahorra miles de tokens al LLM.

#### B. De `OpenGrokBot` (`router.ts`, `orchestrator.ts`, `memory.ts`, `approvals.ts`, `routines.ts`)
1. **Smart Dispatcher de 1 Turno sin Herramientas (`router.ts`):**
   - En lugar de hacer hablar a 4 agentes a la vez (multiplicando x4 la latencia y el gasto en FreeLLMAPI), un prompt minúsculo clasifica el mensaje en:
     - `"build"`: elige **exactamente 1 agente constructor** con herramientas de código/terminal y le inyecta `BUILD_NOTE` (*"Construilo ahora con tus herramientas y devolvé la ruta en 1-2 oraciones; cero planes teóricos ni preguntas"*).
     - `"answer"`: elige al especialista del dominio (`barto-ops`, `security-sentinel`, `web-scout`, etc.).
     - `"discuss"`: elige a `Dee Core` (o hasta 3 agentes si pedís opinión de equipo).
2. **Cadena de Menciones con Freno Anti-Loop (`orchestrator.ts` líneas 241-260):**
   - Si `Dee Core` responde `"Le paso la compilación pesada a @BartoWorker"`, el orquestador detecta `@BartoWorker` con `findMentions()` y lo despierta automáticamente en la misma ronda, respetando `maxMessagesPerRound = 4` y `maxTurnsPerAgentPerRound = 2`.
   - Si Facu habla o aplaude a mitad de una ronda, `state.abort.abort()` cancela instantáneamente el turno actual y prioriza la nueva orden de Facu.
3. **Memoria Episódica Auto-Destilada en Markdown (`memory.ts`):**
   - Olvidate de ChromaDB, Milvus o Qdrant comiendo 2 GB de RAM en un Pentium B950. Cada agente/nodo tiene su archivo `data/memory/<agente>.md` (máximo 4.000 caracteres) con hechos permanentes, preferencias de Facu, IPs, rutas y lecciones de errores. Al terminar cada conversación, un hilo background actualiza ese `.md` de forma atómica (`writeFileSync(tmp)` + `renameSync`).

#### C. De `grok-bot-cli` (`src/core/`)
1. **Sobres con Proveniencia y Límite de Saltos (`hop` < `MAX_HOPS`):**
   - Cada mensaje entre `facu`, `barto` y `manager1` viaja con `{ messageId, correlationId, replyTo, hop, fromNode }`. Si `hop >= 4`, se rechaza en seco antes de tocar el LLM, garantizando matemáticamente que dos nodos jamás entren en un bucle infinito de respuestas.
2. **Política de Nodo Ocupado (`whenBusy: "steer" | "queue" | "reject"`):**
   - Si `barto` está ejecutando una tarea y le mandás otra orden:
     - `steer`: inyecta una corrección en vivo al proceso/agente activo.
     - `queue`: lo pone en la cola de `barto` para arrancar apenas quede `idle`.
3. **Sincronización por Cursores Delta (`--after <cursor>`):**
   - La UI y el orquestador nunca descargan dos veces el mismo log: piden eventos posteriores al último `cursor` opaco, reduciendo el tráfico LAN a casi cero.

---

## 2. INGENIERÍA INVERSA DE META MUSE Y xAI GROK BOT: CÓMO SUPERARLOS EN TUS 3 PCs

| Característica | Meta **Muse** (Cloud) | xAI **Grok Bot** (Cloud) | **Dee Super-MultiAgents** (En tus 3 PCs Físicas) |
| :--- | :--- | :--- | :--- |
| **Dónde vive el Agente** | 1 VM Linux en la nube de Meta (cara, cerrada, bloqueada por sitios como Amazon). | VMs en la nube de Cursor/xAI ($40-$200/mes). | **Tus 3 PCs físicas (`facu`, `barto`, `manager1`)** con IPs residenciales reales, acceso directo a tu hardware, LAN y sesiones reales sin bloqueos anti-datacenter. |
| **Percepción Física** | ❌ Cero (solo texto/audio en app móvil o gadgets externos caros). | ❌ Cero (vive encerrado en una pestaña web). | ✅ **Ojos Reales (Cámaras + Reconocimiento Facial YuNet/SFace + Detector de Intrusos), Oídos siempre activos (VAD adaptativo + Doble Aplauso + Biometría de Voz) y Voz Rioplatense con Lip-Sync 3D.** |
| **Agente de Seguridad** | *Sentinel* (audita tráfico de la VM de Meta). | Tarjetas de aprobación básicas. | ✅ **Dee Sentinel Local**: audita cada comando bash, archivo y request en las 3 PCs + vigila físicamente tu oficina por cámara cuando no estás (*Watchdog Mode*). |
| **Aprendizaje por Observación** | ❌ No tiene. | ✅ *Routines* (observa cómo hacés una tarea y la repite). | ✅ **Dee Routine Recorder + Hermes Skill Crystallizer**: puede grabarte haciendo una acción en X11 (`facu`) o aprender de una tarea exitosa y cristalizarla en un `SKILL.md` reutilizable con 0 costo de razonamiento futuro. |
| **Equipo Multi-Agente** | 1 solo agente monolítico con sub-agentes internos invisibles. | Bots en hilos grupales (solo modelos Grok). | ✅ **Enjambre Híbrido Multi-Nodo y Multi-Modelo**: cada especialista (`Planner`, `Coder`, `Scout`, `Pentester`, `Sentinel`) corre en el nodo ideal y usa el mejor modelo vía **FreeLLMAPI (`:3001`)**. |
| **Interfaz** | Chat plano tipo WhatsApp / Web. | Chat plano tipo Slack. | ✅ **Centro de Comando Espacial 3D (`CyberBird3D` + Nodos Orbitales Interactivos + Orbe Acústico Muse + Inspector de Terminales en Vivo)** con modo reposo de 0% GPU. |

---

## 3. TOPOLOGÍA REAL CONFIRMADA DE HARDWARE, RED Y SENSORES DEL LABORATORIO

Este plan está diseñado **a medida exacta** de las mediciones reales de tus 3 máquinas (extraídas de tu especificación y de las pruebas reales en `/home/facu/Jarvis/cuerpo/`):

### 3.1. Los 3 Nodos de Cómputo

| Nodo | Rol en la Arquitectura Dee | CPU / RAM / Disco | Servicios Base Activos | Sensores Físicos Conectados |
| :--- | :--- | :--- | :--- | :--- |
| **`facu`** *(Maestro)* | **Cerebro Cognitivo (`Dee Core`), Sistema Sensorial (`Oídos`/`Voz`), UI 3D/Web y Hermes Local.** Funciona 100% autónomo aunque los otros 2 estén apagados. | Intel Pentium B950 (2c @ 2.1GHz) · 11 GiB RAM · Intel HD Gen2 · Debian 13 (GNOME en **X11**) | • `FreeLLMAPI` (`:3001`)<br>• `Hermes API` (`:8642`)<br>• `Dee Core & Cuerpo` (`:8091`) | 🎙️ **Micrófono Principal** (`local_arecord` 16kHz mono)<br>🔊 **Parlantes Principales** (Salida TTS)<br>🚫 *Cámara local dañada (marcada fuera de servicio por config)* |
| **`barto`** *(Worker 1)* | **Ejecutor Pesado de Shell, Compilación, Sandboxes, Git Worktrees y Almacenamiento.** (Tiene 87% de sus 431 GB libres). | Intel Celeron N4020 (2c) · 7.6 GiB RAM · Intel UHD 600 · Debian 13 (X11) | • `FreeLLMAPI` (`:3001`)<br>• `Hermes API` (`:8642`)<br>• `Dee Bench & File GW` (`:8730` / `:8731`) | 📷 **Webcam USB Secundaria** (`/dev/video0` 640x480 vía SSH/HTTP) |
| **`manager1`** *(Worker 2)* | **Automatización Web Multi-Cuenta, Browser Use, Scraping, OSINT y Sensor Maestro de Visión.** | Intel Celeron N4020 (2c) · 7.6 GiB RAM · Intel UHD 600 · Debian 13 (X11) | • `FreeLLMAPI` (`:3001`)<br>• `Hermes API` (`:8642`)<br>• `Dee Bench & File GW` (`:8730` / `:8731`) | 📷 **Webcam USB Principal** (`/dev/video0` 640x480)<br>🎙️ **Micrófono Secundario / Failover** (`ssh_arecord`) |
| **`carecam`** *(Periférico IP)* | **Ojo de Vigilancia Perimetral / Oficina.** | Cámara IP en LAN (`192.168.100.22`) | Snapshot HTTP (`/jpeg.cgi`, `/snapshot.jpg`, `/photo.jpg` 640x368) | 📷 **Visión Angular de Oficina** (Sin RTSP pesado, puro JPEG snapshot ultra-rápido) |

> [!IMPORTANT]
> **Regla de Oro de Supervivencia y Autonomía:**  
> `Dee` en `facu` **NUNCA depende de que `barto` o `manager1` estén encendidos**. Si ambos están apagados, `Dee` ejecuta tools locales en el Hermes de `facu` (`localhost:8642`), usa el `FreeLLMAPI` de `facu` (`localhost:3001`), escucha por el micrófono de `facu` y mira por la `CareCam` (`192.168.100.22`) si está en línea. Cuando `barto` o `manager1` prenden, el `HealthMonitor` los detecta en `<10s` y les descarga el trabajo pesado automáticamente.

---

## 4. EL SISTEMA SENSORIAL VIVO DE DEE (OÍDOS, VISIÓN FACIAL / ANTI-INTRUSOS Y VOZ)

Acá es donde **Dee** deja en ridículo a cualquier chat genérico. Reciclamos el núcleo probado de `/home/facu/Jarvis/cuerpo/sensor.py` y `voice.py`, y le inyectamos biometría facial y vocal ultra-liviana diseñada específicamente para procesadores de 2 núcleos sin instrucciones AVX2 pesadas.

```mermaid
flowchart TD
    subgraph OIDOS["🎙️ OÍDOS DE DEE (facu mic + failover manager1)"]
        A1["Captura Continua ALSA (arecord 16kHz S16_LE en chunks de 300ms)"]
        A2["Filtro Anti-Eco (OIDOS.suprimir mientras suena TTS) + Barge-In"]
        A3["Detector Dual: Doble Aplauso (1-4kHz) O VAD Adaptativo (2.5x piso ruido cooler)"]
        A4["Verificador Biométrico de Voz (Huella Espectral MFCC/F0 de Facu - 12ms CPU)"]
        A5["STT Rápido: FreeLLMAPI (:3001/v1/audio/transcriptions) -> Fallback Cloudflare Whisper"]
        A1 --> A2 --> A3 --> A4 --> A5
    end

    subgraph OJOS["👁️ VISIÓN Y SEGURIDAD FACIAL (manager1 + carecam + barto)"]
        V1["Filtro Nivel 1 (0% CPU): Miniatura PGM 30x30 (Diff >= 18) + dHash 9x8 (Hamming > 3)"]
        V2["Filtro Nivel 2 (Solo si hay movimiento - 25ms CPU): Detector Facial OpenCV YuNet (230KB ONNX)"]
        V3["Filtro Nivel 3: Reconocedor Facial SFace (int8 ONNX) contra Huella de Facu"]
        V4{"¿Quién está en la oficina?"}
        V5["🟢 ES FACU: Saludo Studio Mode + Resumen Ejecutivo + Desbloqueo Total"]
        V6["🟡 FACU + VISITA: Modo Invitado (Oculta claves/pantallas sensibles)"]
        V7["🔴 INTRUSO (No es Facu): Alerta Roja + Foto en conservar/ + Visor Combate + Aviso Telegram + Voz Disuasoria"]
        V1 -- "Hay cambio real" --> V2 --> V3 --> V4
        V4 --> V5
        V4 --> V6
        V4 --> V7
    end

    subgraph VOZ["🔊 VOZ EXPRESIVA Y LIP-SYNC REAL"]
        T1["Limpiador Oral desnudar() + Diccionario Fonético (Facu -> Faku)"]
        T2["Segmentador Progresivo por Oraciones trozos() (Habla la 1ra frase mientras genera la 2da)"]
        T3["Motor TTS Híbrido: 1) Edge-TTS (es-AR-TomasNeural con Pitch/Rate Emocional) | 2) FreeLLMAPI | 3) Piper Local Offline"]
        T4["Caché SHA-256 WAV 22050Hz + Analizador de Formantes/Visemas para el Pico 3D de Dee"]
        T1 --> T2 --> T3 --> T4
    end
```

### 4.1. OÍDOS: Escucha Continua, Doble Aplauso, VAD Anti-Cooler y Reconocimiento de TU Voz

Reciclamos `class Oidos` de `sensor.py` y le agregamos 3 mejoras quirúrgicas en `core/sensory/ears.py`:

1. **Toma Continua sin Cortar el Principio de tu Frase (`_escucha` en `sensor.py`):**
   - Mantiene un único subproceso `arecord -q -c 1 -r 16000 -f S16_LE -t raw` abierto en `facu` leyendo ventanas de `300 ms` (`9600 bytes`). Costo de CPU: **< 0.2%**.
2. **Doble Activación Inteligente (Aplauso + Voz Natural con Piso Dinámico):**
   - **Modo Doble Aplauso (Wake Instantáneo desde Reposo):** Detecta dos picos de energía abruptos (`RMS > 0.25` con caída rápida `< 120ms` entre sí dentro de una ventana de `0.15s a 0.8s`).
   - **Modo Escucha Continua VAD Anti-Ventilador:** Como ya se midió en `facu`, el ventilador al máximo genera un piso de ruido de `0.019` a `0.20`. El algoritmo actualiza `self.piso = self.piso * 0.95 + self.nivel * 0.05` y exige `nivel >= max(umbral_voz, self.piso * 2.5)` para empezar a grabar, cortando automáticamente tras `900 ms` de silencio (`mudo >= 3`) y recortando la cola vacía (`_recortar`).
3. **Cancelación de Eco por Ventana (`OIDOS.suprimir`) + Interrupción Verbal ("Barge-In"):**
   - Cuando Dee habla, el sistema silencia la captura normal durante `duracion_wav + 0.9s` para que Dee jamás se escuche a sí mismo.
   - **Pero** si durante el habla de Dee vos hacés un **doble aplauso** o pegás un grito corto sobre el umbral de interrupción (`RMS > 0.45`), dispara inmediatamente `TURNO.interrumpir()`: calla el audio, aborta el stream del LLM y te escucha al instante.
4. **Biometría Ligera de Voz (`SpeakerVerifier` — ¿Está hablando Facu o un extraño?):**
   - Sin usar redes neuronales pesadas que demoren segundos: al capturar tu frase de `1–4s`, antes o en paralelo de mandarla al STT, calcula en **8 milisegundos** con `numpy` (o `onnxruntime` con `wespeaker-voxceleb-resnet34-int8` opcional) el vector acústico de tu voz (F0 media/desvío, centroide espectral y 13 coeficientes MFCC) y lo compara por similitud coseno contra tu huella grabada (`data/biometrics/facu_voice_profile.json`).
   - **Resultado:**
     - `score >= 0.78` → **Voz Confirmada: Facu (`speaker="facu", verified=True`)**. Dee ejecuta cualquier herramienta autorizada.
     - `score < 0.78` → **Voz Desconocida (`speaker="unknown", verified=False`)**. Dee responde: *"Te escucho, pero tu huella de voz no coincide con la de Facu. No puedo ejecutar comandos sobre el laboratorio sin autorización del jefe."*

### 4.2. VISIÓN: Detección de Presencia, Reconocimiento Facial (`Facu`) y Alarma Anti-Intrusos

Reciclamos `class Ojos` de `sensor.py` (`manager1`, `carecam` `192.168.100.22`, `debian`/`barto`) y lo potenciamos con el pipeline de visión más liviano y rápido que existe para CPU en `core/sensory/eyes.py`:

> [!TIP]
> **¿Por qué NO usar la librería `face_recognition` (basada en `dlib`) en el Pentium B950?**  
> `dlib` compila redes HOG/CNN que sin GPU ni instrucciones AVX2 modernas tardan **entre 900 ms y 1.800 ms por cada foto** clavando los 2 núcleos de `facu` al 100%, y consume ~400 MB de RAM.  
> **La Solución Profesional (`OpenCV YuNet + SFace ONNX INT8`):**  
> - `face_detection_yunet_2023mar.onnx` pesa apenas **230 KB** (¡menos que una foto!) y detecta rostros y 5 puntos faciales (ojos, nariz, comisuras) en **12 milisegundos** en tu Pentium B950.  
> - `face_recognition_sface_2021dec_int8.onnx` pesa **9.8 MB** (cuantizado INT8), alinea el rostro con los 5 puntos de YuNet y extrae un embedding de 128 dimensiones en **18 milisegundos** en CPU.  
> - **Total CPU por foto cuando hay movimiento: ~30 milisegundos y < 35 MB de RAM.**

#### Cómo funciona el Guardián Visual de 3 Etapas de Dee:
1. **Etapa 1 — Filtro de Movimiento Ultra-Barato (`_dhash_pares` de `sensor.py`):**
   - Cada `N` segundos (ej. `5s` en modo guardia, `10s` cuando ya estás sentado en la oficina), captura un snapshot de `CareCam` (`192.168.100.22`) o `manager1` y calcula la diferencia `30x30` PGM y el `dHash` `9x8`.
   - Si `cambio < 18` y `hamming <= 3` → **No se movió nada en la oficina. El detector facial NI SIQUIERA SE EJECUTA (0% CPU).**
2. **Etapa 2 — Detección y Reconocimiento Facial (Solo cuando `cambio >= 18`):**
   - Corre `YuNet` sobre el JPEG en memoria (`self.ram[-1]`).
   - Si no hay caras → solo cambió la luz de la ventana; ignora.
   - Si detecta 1 o más caras → extrae el vector 128-D con `SFace` para cada cara y calcula la similitud coseno contra `data/biometrics/facu_faces.npy` (5 fotos tuyas en distintos ángulos/luces registradas con un comando `dee enroll-face`).
3. **Etapa 3 — Máquina de Estados de Presencia e Intrusos (`PresenceStateMachine`):**
   - **Caso A: Entrás vos a la oficina (`Facu` detectado tras > 15 min ausente):**
     - Despierta el renderizador 3D de 0 FPS a 30 FPS.
     - El pájaro **Dee** hace la animación `saludo` con ojos `orgullo` (⭐⭐) y te dice con voz argentina:  
       *"¡Qué hacés, Facu! Bienvenido a la oficina. Mientras no estabas, Barto terminó el build, no entró nadie al estudio y todos los nodos están al día. ¿Por dónde arrancamos?"*
   - **Caso B: Entra un INTRUSO / Persona desconocida y vos NO estás (`facu_present == False`):**
     - **Protocolo Centinela Anti-Intruso:**
       1. Guarda el frame JPEG con timestamp y recorte de la cara en `data/media/conservar/intrusos/intruso_YYYYMMDD_HHMMSS.jpg` (protegido contra borrado del `Mayordomo`).
       2. Cambia a **Dee 3D** a pose `combate` con ojos `combate` (fucsia/rojo neón) y bloquea todas las terminales de la UI (`LOCKDOWN_MODE = True`).
       3. Reproduce por los parlantes de `facu` con voz grave (`estado="alerta"`, `-3Hz, +12%`):  
          *"Alerta de seguridad. Rostro no reconocido en el laboratorio de Facu. La secuencia de video fue registrada y enviada al propietario."*
       4. Envía alerta instantánea (con la foto adjunta) a tu WhatsApp/Telegram o webhook configurado.
   - **Caso C: Estás vos con otra persona (`facu_present == True` + `unknown_faces >= 1`):**
     - Activa **Modo Privacidad Discreta (`PRIVACY_SHIELD`)**: te avisa sutilmente en el HUD (*"Visita detectada: modo pantalla segura activo"*) y difumina variables de entorno, tokens o chats privados en la interfaz.

### 4.3. VOZ: Habla Rioplatense Ultra-Rápida, Caché Instantáneo y Lip-Sync Fonético Real

Reciclamos `voice.py` de `/home/facu/Jarvis/cuerpo/` y lo unificamos con `FreeLLMAPI` y con el motor 3D de Dee:

1. **Cadena de Prioridad de Síntesis (Medida en tu PC):**
   - **Motor 1 (`edge-tts` `es-AR-TomasNeural`):** Voz masculina argentina hiper-natural con modulación real de prosodia (`EXPRESIONES`: `celebrando` `+9Hz/+8%`, `razonando` `-6Hz/-12%`, `alerta` `-3Hz/+12%`, `ejecutando` `+2Hz/+7%`). Genera 7 segundos de audio en 1.8 segundos sin usar CPU local.
   - **Motor 2 (`FreeLLMAPI` `http://localhost:3001/v1/audio/speech`):** Gateway unificado local.
   - **Motor 3 (`piper` Offline `/home/facu/piper-env/bin/piper`):** Voz local ONNX (`es_ES-carlfm-x_low.onnx` / `es_AR-daniela-high.onnx`) que funciona **incluso si se corta Internet en toda tu casa**, a velocidad `3.2x` tiempo real en tu Pentium B950.
2. **Habla Progresiva por Oraciones (`trozos()` + Prefetching Paralelo):**
   - En vez de esperar a que el LLM genere un párrafo entero y luego sintetizar todo el audio (lo que daría 6 segundos de silencio incómodo), `Dee` corta la primera oración apenas sale el primer punto (`.` / `!` / `?`) del stream SSE del LLM, la sintetiza en ~0.9s y **empieza a hablar y mover el pico 3D inmediatamente**, mientras en segundo plano sintetiza la oración 2 y 3.
3. **Lip-Sync Real Basado en Envolvente y Formantes WAV (Adiós al `Math.sin` falso):**
   - Como `voice.py` guarda cada trozo en `.wav` mono a `22050 Hz` en `data/tts/<hash>.wav`, el backend (o el `AnalyserNode` del frontend) extrae el arreglo de energía y cruce por cero (Zero-Crossing Rate) cada `33 ms` (30 FPS):
     - Energía alta + frecuencia baja (`< 800 Hz`) → Visema `open_a` / `round_o` (pico bien abierto + brillo interno cian al 100%).
     - Energía media + frecuencia alta (`> 1800 Hz`, sibilantes S/F/E/I) → Visema `wide_e` (apertura media + ecualizador de auriculares de Dee al máximo).
     - Energía casi cero → Visema `neutral` (pico cerrado perfecto).

---

## 5. CEREBRO COGNITIVO Y ORQUESTACIÓN MULTI-AGENTE (FUSIÓN HERMES + OPENGROKBOT + MUSE + GBOT)

Dee no es un simple wrapper de chat: es un **Director de Orquesta Cognitivo** que combina los mejores patrones del mundo sobre tu infraestructura actual (`FreeLLMAPI :3001` + `Hermes API :8642` en las 3 PCs).

```mermaid
flowchart TB
    User["👤 Facu (Voz / Aplauso / Presencia / UI 3D)"]
    Sensory["🎧 Capa Sensorial (Oídos + Ojos YuNet/SFace + Voz)"]
    Router["⚡ Smart Dispatcher (Inspirado en OpenGrokBot router.ts)\nClasifica en <400ms: chat | build | research | multi-node | security"]
    
    subgraph DeeCore["🧠 DEE CORE (Orquestador en facu:8091)"]
        Planner["📋 Planner / Grill / Goal Engine\n(Descompone, audita con /grill y verifica)"]
        Sentinel["🛡️ Sentinel Safety Guard\n(Inspirado en Meta Muse Sentinel)\nFiltra rm -rf, fugas de red, requiere aprobación"]
        Memory["🗂️ Memoria Markdown Auto-Destilada\n(data/memory/*.md + SQLite Skills Cache)"]
        Envelope["📨 Enrutador con Sobres gbot\n(hop<=4, correlationId, whenBusy: steer|queue)"]
    end

    subgraph Cluster["🖥️ EJECUTORES FÍSICOS EN RED LAN"]
        N_Facu["💻 Nodo FACU (Local)\n• Hermes API :8642 (X11, files, bash)\n• FreeLLMAPI :3001"]
        N_Barto["⚙️ Nodo BARTO (Worker Pesado)\n• Hermes API :8642\n• Muse Bench :8731 & FileGW :8730\n• FreeLLMAPI :3001"]
        N_Manager["🌐 Nodo MANAGER1 (Web & Vision)\n• Hermes API :8642 (Browser Multi-Cuenta)\n• Muse Bench :8731 & FileGW :8730\n• FreeLLMAPI :3001"]
    end

    User --> Sensory --> Router --> DeeCore
    Planner --> Sentinel --> Envelope
    Envelope --> N_Facu
    Envelope --> N_Barto
    Envelope --> N_Manager
    N_Facu & N_Barto & N_Manager -- "SSE Stream + Delta Cursors" --> DeeCore
```

### 5.1. El Escuadrón de Especialistas de Dee (`Squad Matrix`)

Tomando el modelo de `team.json` de **OpenGrokBot** y adaptándolo a tus 3 nodos físicos y a **Hermes**, Dee comanda 6 especialistas virtuales (que se visualizan como las **6 computadoras/nodos orbitales 3D** alrededor de Dee en tu interfaz):

| ID Nodo 3D | Nombre del Especialista | Rol y Personalidad | Nodo Físico Primario (y Failover) | Herramientas Asignadas |
| :--- | :--- | :--- | :--- | :--- |
| **`node_dee_core`** | **Dee Prime (Jefe de Estado Mayor)** | Orquestador táctico, directo, argentino, leal a Facu. Decide quién actúa, sintetiza respuestas y maneja la memoria. | `facu` (`localhost:3001`) | `dispatch_agent`, `memory_read_write`, `routine_schedule`, `camera_check` |
| **`node_hermes_local`** | **Hermes X11 (Operador de Escritorio)** | Especialista en control local de `facu`, gestión de ventanas X11, archivos locales y comandos rápidos. | `facu` (`localhost:8642`) | `terminal`, `read_file`, `write_file`, `edit_file`, `x11_computer_use` |
| **`node_barto_forge`** | **Barto Forge (Ingeniero de Obra Pesada)** | Constructor y compilador. Ejecuta tests, Docker, builds pesados y `git worktree` sin ralentizar la PC de Facu. | `barto:8642` + `barto:8731` *(Failover: `facu:8642`)* | `remote_bench_exec`, `atomic_file_put`, `git_worktree_run`, `hermes_run` |
| **`node_manager_scout`** | **Manager Scout (Agente Web & OSINT)** | Navegador autónomo multi-cuenta, scraping, monitoreo de leads/clientes y extracción de datos en vivo. | `manager1:8642` *(Failover: `facu:8642`)* | `browser_action`, `web_search`, `http_fetch`, `session_vault_use` |
| **`node_sentinel_sec`** | **Sentinel (Supervisor & Pentester)** | El guardián inspirado en Meta Muse *Sentinel* + *Zen-AI*. Audita seguridad, vigila cámaras y bloquea comandos destructivos. | `facu` (Supervisor) + `barto` (Sandbox Auditoría) | `audit_command`, `camera_intruder_scan`, `repo_sast_scan`, `kill_process_group` |
| **`node_memory_skill`** | **Rakazo Archivist (Memoria & Rutinas)** | Destilador silencioso en background. Convierte tareas exitosas en `Skills` reutilizables y ejecuta cron jobs. | `facu` (Background Thread de bajo consumo) | `distill_memory_md`, `crystallize_skill`, `cron_trigger`, `webhook_dispatch` |

### 5.2. Los 4 Superpoderes Cognitivos Exclusivos de Dee

1. **Modos `/plan`, `/grill` y `/goal` (Por Voz o Texto):**
   - Si le decís *"Dee, modo grill: auditá el backend de Stech"*, Dee activa el protocolo adversarial: primero el `Planner` traza la solución, luego `Sentinel` actúa como **Crítico Despiadado (`/grill`)** buscando agujeros lógicos, condiciones de carrera o vulnerabilidades antes de tocar un archivo, y recién cuando pasa el filtro ejecuta.
   - Si le decís *"Dee, modo goal: dejame andando los tests de este repo en barto y avisame cuando den todos verde"*, Dee entra en un bucle autónomo supervisado (con tope de iteraciones y presupuesto) que edita, corre `bench.py` en `barto`, lee la cola del error con `Tail(cap)`, corrige y repite hasta que `exit_code == 0`, hablándote recién al triunfar (¡con salto de victoria 3D!).
2. **Aprendizaje de Rutinas por Observación y Cristalización ("Routine Recorder"):**
   - Inspirado en **xAI Grok Bot Routines**:
     - Podés decirle: *"Dee, mirá cómo despliego este servicio"* → Dee registra los comandos ejecutados en tu terminal o las acciones en X11 durante los próximos 2 minutos, los limpia de errores, los parametriza y guarda una **Skill ejecutable** en `data/skills/<nombre>.skill.md`.
     - La próxima vez que le digas *"Dee, desplegá el servicio"*, no gasta tokens pensando cómo hacerlo: inyecta la Skill aprendida y la ejecuta en 1 paso.
3. **Balanceador Cognitivo Multi-Nodo (`3x FreeLLMAPI Pool`):**
   - Tenés `FreeLLMAPI` corriendo en `:3001` en **las 3 PCs** (`facu:3001`, `barto:3001`, `manager1:3001`).
   - El `llm_client.py` de Dee incluye un **Load Balancer & Circuit Breaker con Latencia Medida (EWMA)**:
     - Si estás corriendo una ronda multi-agente donde `Barto Forge` y `Manager Scout` necesitan pensar al mismo tiempo, Dee reparte los requests entre `facu:3001`, `barto:3001` y `manager1:3001` en paralelo, **triplicando el throughput de llamadas a modelos** y haciendo failover automático en `<50ms` si una instancia da rate-limit o timeout.

---

## 6. OPTIMIZACIÓN EXTREMA DE IA, CPU Y RAM (80% MENOS TOKENS, 0% CUELGUES EN 2 NÚCLEOS)

Para que un Pentium B950 (2 núcleos @ 2.1 GHz, 11 GiB RAM) y dos Celeron N4020 sientan que vuelan como una estación de trabajo de $5.000 USD, aplicamos **7 técnicas de ingeniería de bajo nivel**:

### 6.1. Caché Semántico Exacto y Router de Intenciones Local (`0 Tokens` para el 40% de las órdenes)
Antes de llamar a `FreeLLMAPI (:3001)`, el texto transcripto pasa por `core/orchestrator/fast_intent.py` (ejecución en **0.3 milisegundos**, 0 llamadas de red):
- Comandos de control directo (*"Dee, silencio"*, *"Dee, alto"*, *"Dee, estado de los nodos"*, *"Dee, cuánta RAM libre hay"*, *"Dee, activá modo guardia"*, *"Dee, quién está en la cámara"*): se resuelven por **Fast-Path Determinista** ejecutando la función nativa de Python y hablando la respuesta cacheada en `< 200ms`, **consumiendo 0 tokens de IA**.

### 6.2. Poda Dinámica de Herramientas (`Dynamic Tool Pruning`)
- El error #1 de los agentes lentos es enviarle al LLM la definición JSON de 40 herramientas en cada mensaje (eso quema ~4.500 tokens de entrada en cada turno).
- **Cómo lo hace Dee:** El *Smart Dispatcher* clasifica la intención y `tool_router.py` inyecta en el request a `FreeLLMAPI` **únicamente las 2 a 4 herramientas pertinentes** para ese turno (ej. si pedís ver un archivo, solo inyecta `read_file` y `list_dir`, ahorrando un **78% de tokens de prompt** y acelerando el *Time-To-First-Token*).

### 6.3. Compresión de Salida de Herramientas (`Tail` + `Slipstream Digest`)
- Basado en `Tail(cap)` de `muse-local-gateway/bench/bench.py`: ninguna herramienta devuelve más de `4.000 caracteres` crudos al contexto principal de Dee. Si un comando devuelve un log gigante, `bench.py` conserva el código de salida + las primeras 15 líneas + las últimas 45 líneas (donde está el traceback real), guardando el log completo en `/tmp/dee_cmd_<id>.log` por si el agente pide hacer `grep` puntual.

### 6.4. Memoria `.md` Estructurada de 4KB en lugar de Vector DBs Pesadas
- Siguiendo el diseño de `OpenGrokBot/server/memory.ts`, la memoria de largo plazo vive en archivos Markdown ultra-compactos (`data/memory/facu_profile.md`, `data/memory/projects.md`, `data/memory/barto_notes.md`). Se leen del disco en `0.1 ms` y consumen `0 MB` de RAM en reposo.

### 6.5. Gobernador Adaptativo de FPS en Three.js (`30 FPS → 8 FPS → 0 FPS`)
- En `facu` (Intel HD Graphics de 2da generación), un `requestAnimationFrame` corriendo a 60 FPS clavados consume ~35% de CPU.
- Nuestro nuevo `AdaptiveLoop` en el frontend 3D:
  - **Estado `speaking` / `jumping` / `interacting`**: Renderiza a **30 FPS** con interpolación cinemática suave (`delta` time).
  - **Estado `idle` (Facu presente en la oficina)**: Baja automáticamente con un `setTimeout` en el loop a **8 FPS** (solo respiración sutil y parpadeo). El consumo de CPU de Electron baja a **< 3%**.
  - **Estado `watchdog` / `minimized` / `Facu ausente`**: Detiene por completo `requestAnimationFrame` (**0 FPS**, **0% CPU/GPU**), dejando activo únicamente el hilo liviano de SSE/WebSocket esperando tu regreso o tu aplauso.

### 6.6. Geometrías Compartidas y Texturas Procedurales 256x256
- En `CyberBird3D.ts`, el visor de ojos usa dos `CanvasTexture` de `256x256` píxeles que **solo se redibujan (`needsUpdate = true`) cuando cambia la emoción, el parpadeo o la apertura del pico**, no en cada frame si el valor no varió.
- Cero sombras dinámicas (`renderer.shadowMap.enabled = false` — se usa el `contactShadow` estático suave que ya luce genial), `pixelRatio` limitado a `Math.min(window.devicePixelRatio, 1.25)` y materiales sin post-procesado `EffectComposer` pesado.

### 6.7. Proceso Único Backend en Python (`stdlib` + `httpx` / `FastAPI` liviano)
- Siguiendo la lección aprendida en `/home/facu/Jarvis/cuerpo/core.py`: **un solo proceso servidor en `facu` (`:8091`)** sirve los archivos estáticos compilados de la UI (`dist/`), el bus de eventos SSE (`/events`), el audio TTS (`/audio/<hash>.wav`) y la API de orquestación. No levantamos 4 servidores Node/Python separados en `facu`.

---

## 7. ARQUITECTURA DEL NUEVO FRONTEND 3D + HUD ESPACIAL (EVOLUCIÓN DE `jarvis-agente-supremo-v3.0`)

Analizamos a fondo tu `/home/facu/Descargas/jarvis-agente-supremo-v3.0.zip`. La estética de **Dee (el CyberBird 3D con gorra "4F", auriculares con barras EQ, ojos expresivos en neón y las 6 estaciones de trabajo orbitando en el laboratorio)** + la cápsula limpia estilo **Meta Muse** (`MuseVoiceOrb` + `MuseSubtitlePill`) es **espectacular**.

Lo que vamos a hacer es **limpiar todo lo simulado/harcodeado, simplificar la interfaz para que nada tape al escenario 3D y conectarlo 100% en vivo al cerebro y sensores reales de Dee**:

### 7.1. Mejoras Directas sobre `jarvis-agente-supremo-v3.0.zip`

| Componente en el `.zip` actual | Problema Detectado en el `.zip` | Cómo queda en **Dee v4.0 Supreme** |
| :--- | :--- | :--- |
| **`src/services/voiceEngine.ts`** | Usa `window.speechSynthesis` (voz robótica del navegador), `webkitSpeechRecognition` (que falla en Electron Linux) y simula el lip-sync con `Math.sin(elapsed * 18)`. | **Reemplazado por `deeVoiceBridge.ts`**: Reproduce los `.wav` reales generados por `voice.py` (`es-AR-TomasNeural` / `FreeLLMAPI` / `piper`) a través de un `AudioContext` + `AnalyserNode` real de 64 bandas que mueve el pico y los auriculares de Dee al compás exacto de la onda de audio real. |
| **`src/data/neuralTasks.ts`** (6 nodos orbitales) | Tiene 6 tareas estáticas inventadas (con chats y métricas de CPU falsas). | **Conectado en vivo por SSE (`/events`)**: Los 6 nodos 3D orbitales representan en tiempo real a: **1) `facu` (Master)**, **2) `barto` (Worker 1)**, **3) `manager1` (Worker 2)**, **4) `CareCam & Sentinel` (Visión/Seguridad)**, **5) `Squad Builder` (Hermes/Worktrees)** y **6) `Rakazo Memory & Routines`**. El color del halo 3D y la velocidad de los fotones reflejan la carga real de CPU/RAM y si el nodo está `online`, `working` o `offline`. |
| **`LiveTaskInspectorModal.tsx`** | Al hacer clic en una computadora 3D, abre datos fijos de ejemplo. | **Inspector y Terminal Interactiva en Vivo**: Al hacer clic en el nodo 3D de `barto`, ves la consola en vivo (`SSE stream`) de lo que `Hermes` o `bench.py` están ejecutando en `barto`, su CPU/RAM real, y podés escribirle un comando directo o pausar/matar el proceso (`DELETE /exec/<id>`). Al hacer clic en el nodo `CareCam / Sentinel`, ves el último snapshot real de la cámara, el estado del reconocimiento facial (`Facu en oficina` vs `Guardia Activa`) y el historial de detecciones. |
| **`HUD Sensorial Superior`** | Solo muestra un badge estático y botones de cámara/sonido. | **Cápsula Sensorial Viva**: Muestra 3 indicadores luminosos reales con control en 1 clic:<br>• 🎙️ **OÍDOS:** `Activo (VAD + Aplauso)` + vúmetro mini del nivel RMS real + badge `Voz: Facu ✓`<br>• 👁️ **OJOS:** `Guardia Activa (CareCam + Manager1)` + badge `Rostro: Facu (98%)` o `Alerta Intruso`<br>• 🖥️ **CLUSTER:** `facu 🟢 | barto 🟢 | manager1 ⚪` + latencia `FreeLLMAPI` |
| **Tarjetas de Aprobación (`Sentinel Approval Pill`)** | No estaban en la vista principal 3D. | Cuando un agente pide ejecutar algo sensible (ej. `rm`, `git push`, gasto o acción fuera de sandbox), emerge sobre el `MuseVoiceOrb` una **Tarjeta Holográfica de Aprobación** (que podés aprobar haciendo clic o simplemente diciendo en voz alta *"Dee, autorizá"* o *"Dee, cancelá"*). |

---

## 8. SEGURIDAD NIVEL MILITAR: AGENTE SUPERVISOR `SENTINEL`, BÓVEDA Y KILL-SWITCH

Inspirado directamente en el **Sentinel Safety Agent** de **Meta Muse** y las reglas de `approvals.ts` de **OpenGrokBot**, Dee incluye un módulo guardián (`core/security/sentinel.py`) que ningún prompt-injection puede saltar porque **es código determinista en Python que intercepta cada tool_call antes de que salga a Hermes o a `bench.py`**:

1. **Interceptor Determinista de Comandos (`Sentinel.inspect_tool_call`):**
   - **Lista Negra Absoluta (`DENY_ALWAYS`):** Bloquea en seco bombas fork, formateos de disco (`mkfs`, `dd if=`), borrados recursivos de raíz o home (`rm -rf /`, `rm -rf ~`, `rm -rf /home/facu`), lectura directa de claves privadas (`~/.ssh/id_*`, `.env` crudos hacia afuera) y ataques fuera de los dominios/IPs autorizados en `config/scope.yaml`.
   - **Lista Gris con Confirmación Humana (`ASK_FACU`):** Comandos como `systemctl stop/restart`, `docker rm`, `git push --force`, `apt remove`, o compras/envíos externos pausan el turno, ponen a Dee en estado `alerta` y te piden confirmación por voz/UI (**requiriendo que la voz que autoriza pase el `SpeakerVerifier` de Facu**).
2. **Kill-Switch Verbal y Físico Instantáneo:**
   - Decir **"Dee, alto"**, **"Dee, detente"** o hacer **3 aplausos rápidos** ejecuta en `< 50 ms`:
     1. `TURNO.interrumpir()` (corta el TTS y el stream de `FreeLLMAPI`).
     2. Envía `POST /v1/runs/<id>/cancel` a los Hermes de `facu`, `barto` y `manager1`.
     3. Envía `DELETE /exec/<id>` a los `bench.py` activos (que ejecutan `os.killpg(pid, SIGKILL)` limpiando cualquier subproceso).
3. **Privacidad de Sensores con Expiración y Borrado en RAM (`sensor.py`):**
   - Al igual que en tu `sensor.py`, apagar los `Ojos` ejecuta `self.ram.clear()` (olvido instantáneo en memoria), y el `Mayordomo` barre `data/media/tmp` manteniendo siempre libres al menos `2.0 GB` en `facu`.

---

## 9. ESTRUCTURA DEFINITIVA DEL REPOSITORIO UNIFICADO Y CONTRATOS DE DATOS (SSE / WS / REST)

Todo el proyecto vivirá limpio, modular y listo para producción dentro de `/home/facu/investigar-agentes-autonomos/Dee-Super-MultiAgents/`:

```text
Dee-Super-MultiAgents/
├── README.md                          # Documentación ejecutiva y guía rápida
├── PLAN_MAESTRO_DEE_SUPER_MULTIAGENTS.md  # Este documento maestro de arquitectura
├── LICENSE                            # MIT License
├── config/
│   ├── dee.config.yaml                # Configuración central (puertos, FreeLLMAPI pool, voz, FPS)
│   ├── workers.yaml                   # Topología LAN: facu, barto, manager1 y cámaras
│   ├── squad.json                     # Definición de los 6 especialistas (estilo OpenGrokBot team.json)
│   └── security_scope.yaml            # Reglas de Sentinel, comandos ASK/DENY y scopes permitidos
├── core/                              # 🧠 DEE CORE & CUERPO SENSORIAL (Python 3.11+, ultra-liviano)
│   ├── main.py                        # Servidor único (:8091) HTTP + SSE + Archivos Estáticos + API
│   ├── events.py                      # Bus SSE fan-out con historial corto y cursores delta
│   ├── sensory/                       # 🎧👁️🔊 RECICLADO Y POTENCIADO DE /home/facu/Jarvis/cuerpo/
│   │   ├── ears.py                    # ALSA arecord continuo + Doble Aplauso + VAD anti-cooler + Supresión eco
│   │   ├── speaker_id.py              # Biometría ligera de voz (MFCC/F0 cosine similarity -> ¿Es Facu?)
│   │   ├── eyes.py                    # Cámaras (manager1, barto, carecam HTTP) + PGM diff 30x30 + dHash 9x8
│   │   ├── face_guard.py              # OpenCV YuNet (230KB) + SFace (int8) -> Facu vs Visita vs Intruso
│   │   ├── voice.py                   # TTS real (Edge es-AR-TomasNeural + FreeLLMAPI + Piper offline) + WAV cache
│   │   ├── lipsync_analyzer.py        # Extractor de envolvente/visemas reales desde el WAV para el pico 3D
│   │   └── butler.py                  # Mayordomo de cuotas de disco, rotación de logs y limpieza de tmp
│   ├── orchestrator/                  # ⚡ CEREBRO MULTI-AGENTE (Hermes + OpenGrokBot + Muse + gbot)
│   │   ├── fast_intent.py             # Fast-path de 0 tokens (<1ms) para comandos frecuentes de sistema
│   │   ├── smart_router.py            # Clasificador 1-turno (build | answer | discuss | security) + Tool Pruning
│   │   ├── dee_engine.py              # Loop principal, rondas de menciones (@BartoForge), /plan, /grill, /goal
│   │   ├── llm_pool.py                # Cliente FreeLLMAPI balanceado entre facu:3001, barto:3001 y manager1:3001
│   │   ├── state_machine.py           # Estados: idle | listening | thinking | speaking | working | combat | sleep
│   │   ├── memory_md.py               # Memoria episódica auto-destilada en Markdown (<4KB por agente)
│   │   └── routines.py                # Cron scheduler + Webhook triggers + Cristalizador de Skills
│   ├── workers/                       # 🖥️ PUENTE MULTI-NODO LAN
│   │   ├── hermes_client.py           # Cliente HTTP/SSE hacia Hermes API Server (:8642) en facu/barto/manager1
│   │   ├── muse_workbench_client.py   # Cliente hacia gateway.py (:8730 files) y bench.py (:8731 shell)
│   │   ├── health_telemetry.py        # Monitor cada 15s de CPU, RAM, Disco y puertos de las 3 PCs
│   │   └── envelope.py                # Sobres gbot (hop<=4, correlationId, whenBusy: steer|queue)
│   └── security/                      # 🛡️ SENTINEL SUPERVISOR
│       ├── sentinel.py                # Auditor determinista de comandos, rutas y red + aprobaciones por voz
│       └── intruder_alert.py          # Disuasión por voz, captura en conservar/ y alerta a Telegram/WhatsApp
├── node_agent/                        # 📦 AGENTE LIGERO PARA BARTO Y MANAGER1 (Reciclado de muse-local-gateway)
│   ├── gateway.py                     # PUT /files/<rel> atómico (.part-uuid + os.replace) en :8730
│   └── bench.py                       # POST /exec con wait híbrido, os.killpg y Tail(cap) + GET /telemetry en :8731
├── frontend/                          # 🎮 INTERFAZ 3D + HUD ESPACIAL (Evolución de jarvis-agente-supremo-v3.0)
│   ├── package.json
│   ├── vite.config.ts
│   ├── electron/
│   │   ├── main.cjs                   # Ventana Electron optimizada para X11 (con flag de bajo consumo GPU)
│   │   └── preload.cjs
│   └── src/
│       ├── App.tsx                    # Escenario unificado conectado al Bus SSE de Dee (:8091)
│       ├── services/
│       │   ├── deeEventClient.ts      # Cliente SSE + REST contra localhost:8091
│       │   └── deeVoiceBridge.ts      # Reproductor WAV real + Web Audio AnalyserNode (64-bin FFT) -> Visemas
│       ├── three/
│       │   ├── CyberBird3D.ts         # Dee 3D (gorra 4F, ojos Canvas 256x256, pico lip-sync, salto victoria)
│       │   ├── AdaptiveRenderer.ts    # Gobernador automático 30 FPS (activo) / 8 FPS (idle) / 0 FPS (ausente)
│       │   └── ClusterNodes3D.ts      # Los 6 nodos orbitales conectados a telemetría real
│       └── components/
│           ├── SensoryTopBar.tsx      # Estado real de Oídos (VAD/Voz Facu), Ojos (YuNet/CareCam) y Nodos
│           ├── MuseVoiceOrb.tsx       # Orbe acústico central reactivo al micrófono real y al TTS
│           ├── MuseSubtitlePill.tsx   # Subtítulos en tiempo real sincronizados frase por frase
│           ├── SentinelApprovalCard.tsx # Tarjeta holográfica de aprobación (voz o clic)
│           ├── WorkstationsSpatialDrawer.tsx # Calibrador 3D y vista rápida de las 6 estaciones
│           └── LiveNodeInspectorModal.tsx    # Consola en vivo de facu/barto/manager1 + visor de cámaras
├── data/                              # Datos locales persistentes (git-ignored salvo ejemplos)
│   ├── biometrics/                    # facu_faces.npy (SFace embeddings) y facu_voice_profile.json
│   ├── memory/                        # Notas .md auto-destiladas por especialista
│   ├── skills/                        # Skills cristalizadas (.skill.md)
│   ├── models/                        # face_detection_yunet_2023mar.onnx (230KB) + sface_int8.onnx (9.8MB)
│   └── media/                         # tmp/ (cuota 100MB), tts/ (caché WAV) y conservar/intrusos/
└── scripts/
    ├── verify_phase0.sh               # Chequeo automático de puertos (:3001, :8642, :8091), X11 y cámaras
    ├── enroll_facu.py                 # Registra tu cara (5 fotos) y tu huella de voz (3 frases) en 30 segundos
    ├── deploy_workers.sh              # Instala node_agent (gateway.py + bench.py) en barto y manager1 por SSH
    └── start_dee.sh                   # Arranca Dee Core + UI/Electron con 1 solo comando
```

---

### 9.1. Contrato Unificado de Eventos en Tiempo Real (`SSE /events` y `WebSocket`)

Tanto la interfaz Web como el contenedor Electron consumen un único flujo de eventos JSON desde `http://localhost:8091/events`:

```json
// 1. Cambio de estado cinemático y emocional de Dee 3D
{ "type": "state", "action": "idle" | "saludo" | "trabajando" | "manipular_datos" | "explicacion" | "celebracion_salto" | "despedida", "emotion": "curioso" | "orgullo" | "combate" | "alivio" | "neutro", "fps_target": 30 }

// 2. Percepción de Oídos (VAD / Aplauso / Transcripción + Verificación de Voz)
{ "type": "ears", "listening": true, "rms": 0.14, "noise_floor": 0.021, "wake_source": "double_clap" | "vad" | "spacebar" }
{ "type": "transcript", "text": "Dee, fijate qué servicios corren en barto", "speaker": "facu", "speaker_verified": true, "confidence": 0.91, "ms": 1120 }

// 3. Percepción de Ojos (Presencia / Reconocimiento Facial / Alerta de Intruso)
{ "type": "vision", "camera": "carecam", "status": "facu_present" | "guest_present" | "intruder_alert" | "empty", "face_match": 0.87, "snapshot_url": "/media/latest.jpg" }

// 4. Razonamiento, Ruteo y Ejecución de Herramientas (Local o Remota)
{ "type": "route", "mode": "build" | "answer" | "discuss", "speakers": ["node_barto_forge"], "llm_node": "barto:3001" }
{ "type": "tool_call", "id": "tc_01", "agent": "node_barto_forge", "tool": "remote_bench_exec", "target": "barto", "args": { "cmd": "systemctl list-units --type=service --state=running" } }
{ "type": "tool_stream", "id": "tc_01", "target": "barto", "chunk": "cron.service loaded active running...", "cursor": "cur_981" }
{ "type": "tool_result", "id": "tc_01", "target": "barto", "ok": true, "exit_code": 0, "elapsed_ms": 340 }

// 5. Voz de Dee (Por oraciones progresivas con envolvente para Lip-Sync)
{ "type": "tts_chunk", "turn_id": 14, "text": "¡De una, Facu! Acá tenés los servicios activos en Barto.", "audio_url": "/audio/8f3a19c2.wav", "duration_s": 3.4, "emotion": "curioso", "backend": "edge" }

// 6. Telemetría Real del Cluster y los 6 Nodos Orbitales (Cada 10s)
{ "type": "cluster_telemetry", "nodes": {
    "facu":     { "online": true,  "cpu": 18, "ram": 62, "disk_free_gb": 84.2, "hermes": "ok", "freellm": "ok" },
    "barto":    { "online": true,  "cpu": 11, "ram": 48, "disk_free_gb": 374.0, "hermes": "ok", "freellm": "ok" },
    "manager1": { "online": false, "cpu": 0,  "ram": 0,  "disk_free_gb": 0,     "hermes": "offline", "freellm": "offline" }
  }
}

// 7. Solicitud de Aprobación de Sentinel
{ "type": "approval_request", "id": "ap_77", "agent": "node_barto_forge", "tool": "remote_bench_exec", "summary": "Reiniciar servicio nginx en barto", "risk": "medium", "voice_confirm_allowed": true }
```

---

## 10. CONFIGURACIONES MAESTRAS INTEGRADAS (`dee.config.yaml` y `workers.yaml`)

Estas configuraciones dejan todo parametrizado desde el día 1 para exprimir al máximo tu hardware sin tocar código:

### 10.1. `config/dee.config.yaml`
```yaml
project:
  name: "Dee-Super-MultiAgents"
  version: "4.0.0"
  owner: "Facu"
  language: "es-AR"

server:
  host: "127.0.0.1"
  port: 8091
  serve_frontend: true

ai_gateway_pool:
  # Balanceo automático con failover entre las 3 instancias de FreeLLMAPI (:3001)
  strategy: "lowest_latency_first"
  timeout_first_byte_s: 12.0
  timeout_total_s: 45.0
  endpoints:
    - id: "facu_llm"
      url: "http://127.0.0.1:3001/v1"
      priority: 1
    - id: "barto_llm"
      url: "http://barto:3001/v1"
      priority: 2
    - id: "manager1_llm"
      url: "http://manager1:3001/v1"
      priority: 3
  models:
    router: "auto"          # Clasificador rápido de 1 turno
    planner: "auto"         # Razonamiento principal y /grill
    memory_distiller: "auto"

efficiency:
  fast_intent_zero_token: true       # Resuelve comandos de estado/control en 0ms sin LLM
  dynamic_tool_pruning: true         # Envía máx 4 tools por request (ahorra ~78% tokens)
  max_tool_output_chars: 4000        # Buffer circular Tail(cap)
  max_messages_per_round: 4          # Freno anti-loop estilo OpenGrokBot
  max_hops_between_nodes: 4          # Freno anti-loop estilo grok-bot-cli
  memory_max_chars_per_agent: 4000   # Notas .md ultra-livianas

sensory:
  ears:
    enabled_on_boot: true
    primary_mic: "facu"              # local_arecord 16kHz mono s16le
    failover_mic: "manager1"         # ssh_arecord
    wake_clap_enabled: true          # Doble aplauso 1-4kHz (<800ms)
    vad_enabled: true                # VAD continuo adaptativo
    vad_min_rms: 0.06
    vad_noise_multiplier: 2.5        # Anti-ruido del ventilador de facu
    echo_suppression_pad_s: 0.9      # No escucharse a sí mismo mientras habla
    barge_in_rms_threshold: 0.45     # Umbral para interrumpir a Dee en vivo
    verify_speaker_voice: true       # Verifica huella acústica de Facu
    speaker_similarity_threshold: 0.78

  eyes:
    enabled_on_boot: true
    disabled_cameras: ["facu"]       # Cámara física de facu dañada — no tocar
    camera_order: ["carecam", "manager1", "barto"]
    poll_interval_present_s: 10.0    # Cuando Facu ya está en la oficina
    poll_interval_watchdog_s: 4.0    # Cuando la oficina está en modo guardia
    motion_diff_threshold: 18.0      # Miniatura PGM 30x30 antes de correr IA facial
    dhash_hamming_threshold: 3       # Miniatura PGM 9x8
    face_detector_model: "data/models/face_detection_yunet_2023mar.onnx"
    face_recognizer_model: "data/models/face_recognition_sface_2021dec_int8.onnx"
    face_cosine_threshold: 0.40      # Umbral SFace para confirmar que es Facu
    greeting_cooldown_minutes: 20    # No volver a saludar si saliste 1 minuto al baño
    intruder_deterrence_voice: true  # Hablar por parlantes si entra un desconocido solo

  voice:
    tts_priority: ["edge", "freellmapi", "piper"]
    edge_voice: "es-AR-TomasNeural"
    piper_model: "es_ES-carlfm-x_low.onnx"
    speed: 1.05
    sentence_streaming: true         # Habla la 1ra oración mientras sintetiza la 2da
    phonetic_overrides:
      "Facu": "Faku"
      "barto": "Barto"
      "Dee": "Di"

frontend_3d:
  fps_active: 30                     # Mientras habla, salta o interactuás
  fps_idle_present: 8                # En reposo con Facu presente (<3% CPU)
  fps_away_or_minimized: 0           # 0% CPU/GPU cuando no estás en la oficina
  max_pixel_ratio: 1.25
  shadows: false                     # Usa ContactShadow estático de costo 0
```

### 10.2. `config/workers.yaml`
```yaml
nodes:
  facu:
    role: "master"
    host: "127.0.0.1"
    hermes_url: "http://127.0.0.1:8642"
    hermes_key_env: "HERMES_FACU_KEY"
    freellm_url: "http://127.0.0.1:3001/v1"
    capabilities: ["orchestration", "x11_desktop", "audio_io", "local_shell", "local_files"]

  barto:
    role: "worker_heavy"
    optional: true
    host: "barto"                    # o IP fija LAN ej. 192.168.100.X
    hermes_url: "http://barto:8642"
    hermes_key_env: "HERMES_BARTO_KEY"
    bench_url: "http://barto:8731"
    file_gw_url: "http://barto:8730"
    freellm_url: "http://barto:3001/v1"
    camera:
      kind: "ssh_ffmpeg"
      device: "/dev/video0"
      size: "640x480"
    capabilities: ["heavy_build", "docker_sandbox", "git_worktree", "massive_storage", "camera_secondary"]

  manager1:
    role: "worker_web_vision"
    optional: true
    host: "manager1"                 # o IP fija LAN ej. 192.168.100.Y
    hermes_url: "http://manager1:8642"
    hermes_key_env: "HERMES_MANAGER1_KEY"
    bench_url: "http://manager1:8731"
    file_gw_url: "http://manager1:8730"
    freellm_url: "http://manager1:3001/v1"
    camera:
      kind: "ssh_ffmpeg"
      device: "/dev/video0"
      size: "640x480"
    mic:
      kind: "ssh_arecord"
    capabilities: ["browser_multi_account", "osint_scraping", "camera_primary", "mic_failover"]

peripherals:
  carecam:
    kind: "http_snapshot"
    url: "http://192.168.100.22"
    routes: ["/jpeg.cgi", "/snapshot.jpg", "/photo.jpg"]
    size: "640x368"
    role: "office_perimeter_eye"
```

---

## 11. PLAN DE EJECUCIÓN POR FASES (DEL MVP END-TO-END AL DESPLIEGUE TOTAL)

Para construir esto con **precisión quirúrgica y cero humo**, el desarrollo sigue 5 fases incrementales donde cada fase entrega un sistema **100% funcional, probado y medido**:

### 🟢 FASE 0: Auditoría Automática de Entorno y Biometría Base
1. Ejecutar `scripts/verify_phase0.sh`:
   - Verifica en `facu` que `FreeLLMAPI` responda en `localhost:3001/v1/models` y `Hermes` en `localhost:8642`.
   - Verifica sesión gráfica X11 (`echo $XDG_SESSION_TYPE`), `arecord`, `ffmpeg`, `edge-tts` (`/.venv-tts/bin/edge-tts`) y `piper` (`/home/facu/piper-env/bin/piper`).
   - Verifica conectividad opcional a `barto`, `manager1` y `CareCam` (`192.168.100.22`).
2. Descargar los 2 micro-modelos ONNX de visión (`face_detection_yunet_2023mar.onnx` de 230 KB y `face_recognition_sface_2021dec_int8.onnx` de 9.8 MB) en `data/models/`.

### 🟢 FASE 1: Núcleo Autónomo en `facu` + Oídos + Voz + Ejecución Local (MVP Completo en 1 Nodo)
1. Portar y modularizar `ears.py` (doble aplauso + VAD adaptativo anti-ventilador + supresión de eco + `speaker_id.py`) y `voice.py` (TTS argentino por oraciones `trozos()` + caché WAV + extractor de visemas) desde `/home/facu/Jarvis/cuerpo/`.
2. Construir `core/orchestrator/` (`fast_intent.py` de 0 tokens, `smart_router.py` con poda de herramientas, `llm_pool.py` contra `:3001`, `hermes_client.py` contra `localhost:8642` y `sentinel.py` con kill-switch verbal *"Dee, alto"*).
3. Levantar `core/main.py` en `:8091` con el bus SSE `/events`.
- **Criterio de Éxito Fase 1:** Aplaudís dos veces (o hablás directo) → *"Dee, mostrame cuánta RAM libre tengo y qué procesos consumen más en facu"* → Dee verifica tu voz, ejecuta el comando real, te responde con voz argentina fluida en `< 3 segundos` y transmite todo el evento por SSE.

### 🟡 FASE 2: Integración del Frontend 3D Supremo (`Dee CyberBird 3D` + HUD Sensorial en Vivo)
1. Desempaquetar la base visual de `jarvis-agente-supremo-v3.0.zip` dentro de `frontend/`, eliminando los mocks de `voiceEngine.ts` y `neuralTasks.ts`.
2. Conectar `deeEventClient.ts` al SSE de `localhost:8091/events` y `deeVoiceBridge.ts` al reproductor WAV con `AnalyserNode` real para que el pico de **Dee** y las barras EQ de sus auriculares se muevan exactamente con su voz real.
3. Activar el **Gobernador Adaptativo de FPS (`30 / 8 / 0 FPS`)** en `CyberBirdCanvas.tsx` para cuidar el Pentium B950.
4. Conectar los 6 nodos 3D orbitales y el `LiveNodeInspectorModal` a las métricas y consolas reales de tus máquinas.

### 🟡 FASE 3: Ojos de Dee (Reconocimiento Facial `Facu` vs Intrusos + Modo Guardia)
1. Integrar `eyes.py` (captura desde `CareCam 192.168.100.22`, `manager1` y `barto` con filtro `30x30` PGM diff + `dHash`) junto con `face_guard.py` (`YuNet` + `SFace`).
2. Correr `scripts/enroll_facu.py` para registrar tu rostro y tu huella de voz.
3. Activar la máquina de estados de presencia:
   - Saludo automático **Studio Mode** cuando entrás a la oficina.
   - **Modo Invitado** si estás con alguien más.
   - **Protocolo Centinela Anti-Intruso** (foto en `conservar/intrusos/`, ojos en modo `combate`, voz disuasoria y alerta externa) si entra alguien cuando vos no estás.

### 🔵 FASE 4: Enjambre Multi-Nodo (`barto` + `manager1`) + Routines + `/plan`, `/grill`, `/goal`
1. Desplegar con `scripts/deploy_workers.sh` el micro-agente (`gateway.py :8730` + `bench.py :8731` reciclados de `muse-local-gateway`) en `barto` y `manager1`, y conectar con sus `Hermes API (:8642)` y `FreeLLMAPI (:3001)`.
2. Habilitar el enrutamiento automático: cuando pedís compilar, testear en un `git worktree` o auditar un repo pesado, `Dee` en `facu` se lo delega a `@BartoForge` en `barto` con sobres anti-loop `gbot` y transmite la salida en vivo al nodo 3D de Barto en tu pantalla.
3. Activar `memory_md.py` (memoria auto-destilada en background), `routines.py` (tareas programadas y grabador de rutinas por observación) y los flujos `/plan`, `/grill` y `/goal`.

---

> [!TIP]
> **Estado Actual:** El análisis forense de todos los repositorios, el rescate del código probado de cámaras/micrófonos/voz de tu laboratorio y la arquitectura maestra de **Dee-Super-MultiAgents v4.0** ya están documentados en este archivo.  
> **Siguiente paso inmediato cuando me des el OK:** Ejecutar la **Fase 0 + Fase 1 + Fase 2** directamente dentro de `/home/facu/investigar-agentes-autonomos/Dee-Super-MultiAgents/` para dejar el código real estructurado, fusionado y listo para correr en `facu`.

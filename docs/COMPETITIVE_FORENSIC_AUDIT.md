# 🔍 AUDITORÍA FORENSE COMPETITIVA Y DIAGNÓSTICO DE INGENIERÍA (`FASE 0`)

> **Proyecto**: **DEE — Distributed Emergent Engine** (`https://github.com/NickDev24/Dee-Bot-Agents`)  
> **Autor y Arquitecto**: Facu Cercuetti (`@NickDev24`)  
> **Fecha de Auditoría**: 10 de Noviembre de 2026  
> **Alcance**: Inspección forense de estructura de directorios, código fuente, motores de agentes, memoria, orquestadores, herramientas, ejecución, MCP, Computer Use, seguridad, persistencia, interfaces, pruebas y licencias de los proyectos de referencia locales (`/home/facu/investigar-agentes-autonomos/`, `/home/facu/AnyModelBot`, `/home/facu/.hermes/hermes-agent`, `/home/facu/agent-zero`) y del propio repositorio `Dee-Bot-Agents`.

---

## 1. Hallazgos Forenses sobre los Proyectos de Referencia (Código Real Verificado vs. Promesas)

Antes de diseñar y construir **DEE (Distributed Emergent Engine)**, se auditaron los árboles de código fuente reales en disco para distinguir funcionalidades verificadas de aquellas que solo se anuncian en READMEs.

### 1.1 Alerta Crítica de Procedencia: `Meta-Muse-Spark-1.3-Free` y `muse-spark`
Una inspección forense línea por línea demuestra que ambos repositorios son **cascarones vacíos o prototipos simulados**:

1. **`/home/facu/investigar-agentes-autonomos/Meta-Muse-Spark-1.3-Free/` (Licencia MIT declarada, 0 líneas ejecutables)**:
   - Todos los archivos `.ts` y `.tsx` (`code/executor.ts`, `code/planner.ts`, `code/worktree.ts`, `desk/eventlog.ts`, `desk/storage.ts`, `net/meta.ts`, `net/muse.ts`, `use/useMuseCode.ts`, `use/useMuseSpark.ts`, `view/App.tsx`, `view/ChatInterface.tsx`, `view/MuseCodeAgent.tsx`, `view/PlanGrillGoal.tsx`, `view/SubAgents.tsx`, `view/WorktreePanel.tsx`) contienen **únicamente 2 líneas de comentario** (`// rev-g4e18c-20260907 <archivo>`) y **0 líneas de código**, junto con un binario opaco `net/Spark-Free-Muse-Meta-v2.5-beta.5.zip`.
   - **Veredicto Forense**: **DESCARTADO AL 100%**.

2. **`/home/facu/investigar-agentes-autonomos/muse-spark/` (Prototipo comunitario con mocks)**:
   - `core/rag_manager.py` (41 líneas): tiene comentados todos los imports (`# from langchain...`) y su método `query_context()` devuelve literalmente un string estático: `f"[Context extracted from local files regarding: {user_query}]"`.
   - `core/voice_engine.py`, `core/agent_controller.py`, `core/safety_guard.py`: son esqueletos con `pass` o `print()`.
   - **Veredicto Forense**: **DESCARTADO como implementación**. Confirma por qué DEE prohíbe mocks y dependencias pesadas (LangChain/ChromaDB) en hardware sin GPU dedicada.

---

### 1.2 Auditoría Forense de los Proyectos con Implementaciones Reales Verificadas

1. **`Hermes Agent` (`/home/facu/.hermes/hermes-agent`, Nous Research, Licencia MIT)**:
   - **Estructura e Implementación Verificada**:
     - `cli.py` (82,465 bytes), `batch_runner.py` (49,480 bytes), `hermes_state_dbfile.py` (43,283 bytes), `hermes_state_compression.py` (56,297 bytes), `hermes_state_common.py` (75,253 bytes), `hermes_dir_acl.py` (24,757 bytes), `hermes_startup_watchdog.py`, directorios `agent/`, `gateway/`, `cron/`, `acp_adapter/`, `hermes_cli/`, `evals/`.
     - Persistencia real en `~/.hermes/`: `state.db` (SQLite WAL), `kanban.db`, `projects.db`, `SOUL.md` y `.skills_prompt_snapshot.json`.
   - **Fortalezas Verificadas**:
     - Auto-mejora de skills a partir de la experiencia y compresión de contexto (`hermes_state_compression.py`).
     - Control de listas de acceso a directorios (`hermes_dir_acl.py`) y fijación exacta de versiones (`==X.Y.Z`) en `pyproject.toml` contra ataques de cadena de suministro.
     - Adaptadores multi-proveedor (`agent/anthropic_adapter.py`, `agent_init_ollama.py`, `acp_openai_bridge.py`) y delegación de subagentes (`hermes_state_delegate_children.py`).
   - **Limitaciones Detectadas (Oportunidad para DEE)**:
     - **Archivos monolíticos gigantes**: `cli.py` supera los 82 KB, `hermes_state_common.py` 75 KB y `hermes_constants.py` 67 KB, dificultando el mantenimiento modular.
     - **Acoplamiento de entorno**: su `pyproject.toml` exige pins específicos para Python 3.14 en dependencias centrales.
     - **Carece de Scheduler Distribuido Multi-Máquina**: su `gateway.sock` es local al host; no distribuye subtareas dinámicamente entre múltiples nodos (`facu`, `barto`, `manager1`) midiendo RAM/CPU/latencia.
     - **Sin bucle cerrado nativo C/X11**: no incluye un controlador C/X11 (`libX11`/`libXtst`) sin dependencias que verifique coordenadas de cursor y capturas de pantalla antes/después sin asumir éxito por `returncode == 0`.

2. **Ecosistema `AnyModelBot` / `OpenMausBot` / `Suparagent` / `OpenBots` / `CogineBot` / `Open Super Agent` / `OpenBot` (`/home/facu/AnyModelBot`, Licencia MIT)**:
   - **Estructura e Implementación Verificada**:
     - `src/agent/cua-driver.ts` (419 líneas), `src/agent/computer-use.ts` (186 líneas), `src/core/recovery.ts` (69 líneas), `src/core/outbox.ts`, `src/core/runtime.ts`, `src/tasks/service.ts`, `src/tasks/scheduler.ts`, `src/magpie/supervisor.ts`, sub-bots en `bots/` (`company-research`, `ppt-master`, `printfilm`, `us-stock-research`) y runtime externo `dsh-runtime/`.
   - **Fortalezas Verificadas**:
     - Separación explícita en `cua-driver.ts` entre herramientas de lectura (`CUA_READ_TOOLS`: `list_windows`, `get_desktop_state`, `get_screen_size`, `get_cursor_position`, `verify_state`) y herramientas mutadoras (`CUA_INPUT_TOOLS`: `click`, `type_text`, `press_key`, `drag`, `launch_app`).
     - Recuperación de tareas en vuelo tras caídas (`src/core/recovery.ts` mediante marcadores `inflight:<id>`).
     - Planificador con slots de atención (`src/tasks/scheduler.ts`).
   - **Limitaciones Detectadas (Oportunidad para DEE)**:
     - **Peso excesivo**: más de 290 paquetes en `node_modules` y dependencia de binarios externos (`dsh-runtime`).
     - **Ejecución local a una sola máquina**: no posee federación de nodos ni ejecución remota firmada por HMAC.
     - **Sin memoria jerárquica de 6 niveles con búsqueda híbrida SQLite FTS5 BM25 + Coseno de 0-RAM**.

3. **`OpenGrokBot` (`/home/facu/investigar-agentes-autonomos/OpenGrokBot`, Licencia MIT)**:
   - **Estructura e Implementación Verificada**: `server/orchestrator.ts` (374 líneas), `server/router.ts` (111 líneas), `server/agent.ts`, `server/memory.ts` (92 líneas), `server/approvals.ts`, `server/routines.ts`, `server/cron.ts`, `desktop/main.cjs` (77 líneas), `server/orchestrator.test.ts`.
   - **Fortalezas Verificadas**:
     - Orquestador de rondas conversacionales (`RoundState`) con menciones `@agent`, cola de turnos y límite `maxMessagesPerRound`.
     - `router.ts` clasifica intenciones (`build | answer | discuss`).
     - `memory.ts` guarda un archivo Markdown compacto (`<= 4000` chars) por agente mediante escritura atómica (`.tmp` -> `renameSync`).
     - `approvals.ts` detiene herramientas sensibles hasta recibir aprobación del usuario.
   - **Limitaciones Detectadas (Oportunidad para DEE)**:
     - Es un **chat grupal secuencial**, no un motor cognitivo que descompone objetivos en un DAG ejecutable en paralelo con verificación de artefactos.
     - Su memoria es un único archivo plano de 4 KB por agente (sin niveles episódico/semántico/procedimental/proyecto ni índice FTS5).

4. **`Grok Bot CLI` (`grok-bot-cli`, `/home/facu/investigar-agentes-autonomos/grok-bot-cli`, Licencia MIT)**:
   - **Estructura e Implementación Verificada**: `src/core/relay/engine.js`, `src/core/gateway.js`, `src/core/codex-bridge.js`, `src/core/claude-channel.js`, `src/mcp/claude-channel.ts`.
   - **Fortalezas Verificadas**:
     - Máquina de estados transaccional en el Relay (`prepared -> sending -> pending -> completed | paused | rejected`).
     - Políticas explícitas ante agentes ocupados (`busyPolicy`: `steer`, `queue`, `reject`) y límite anti-ciclos (`hop < 4`).
     - Servidor MCP stdio funcional.
   - **Limitaciones Detectadas (Oportunidad para DEE)**:
     - Es una pasarela de canales/mensajería; carece de planificación cognitiva, workspaces aislados por agente, Computer Use nativo y verificación empírica post-acción.

5. **`Muse Local Gateway` (`muse-local-gateway`, `/home/facu/investigar-agentes-autonomos/muse-local-gateway`, Licencia MIT)**:
   - **Estructura e Implementación Verificada**: `gateway.py` (98 líneas, `:8730`), `bench.py` (112 líneas, `:8731`), `bin/gateway-*.sh`, `tests/test_gateway.py`.
   - **Fortalezas Verificadas**:
     - Demonios HTTP en librería estándar de Python para lectura/escritura de archivos (`:8730`) y ejecución de procesos con `os.setsid` + `os.killpg` (`:8731`).
   - **Limitaciones Detectadas (Oportunidad para DEE)**:
     - Sin firma criptográfica HMAC entre nodos, sin verificación SHA-256 post-escritura y sin reporte de telemetría de hardware (CPU, RAM libre, disco, GPU) hacia un scheduler distribuido.

---

## 2. Matriz Comparativa Obligatoria

| Capacidad | Proyecto de referencia | Implementación de referencia (Verificada en Código) | Oportunidad para **DEE — Distributed Emergent Engine** |
|---|---|---|---|
| **Multiagente** | `OpenGrokBot` / `Hermes Agent` / `OpenBots` | `OpenGrokBot/server/orchestrator.ts`: turnos secuenciales de chat por `@mention`. `Hermes Agent`: `hermes_state_delegate_children.py` para subagentes hijos. | **Orquestador Multiagente Jerárquico y Paralelo (`core/platform/orchestrator.py`)**: Supervisor (`dee_prime`) + Especialistas con workspaces aislados, ejecución paralela (`ThreadPoolExecutor`), colas DAG, manejo de dependencias y resolución de conflictos. |
| **Memoria persistente** | `OpenGrokBot` / `Hermes Agent` / `muse-spark` | `OpenGrokBot/server/memory.ts`: 1 archivo `.md` (`4 KB`). `Hermes Agent`: `state.db` + `SOUL.md`. `muse-spark`: *mock* vacío no funcional. | **Motor de Memoria Persistente de 6 Niveles en SQLite WAL + FTS5 BM25 (`core/platform/storage.py`)**: `session`, `episodic`, `semantic`, `procedural`, `project`, `shared`. Con búsqueda híbrida (BM25 + similitud coseno en Python puro), deduplicación SHA-256 y 0 MB de vectores residentes en RAM. |
| **Computer Use** | `AnyModelBot` (`OpenMausBot` / `Suparagent`) | `src/agent/cua-driver.ts`: separa `CUA_READ_TOOLS` y `CUA_INPUT_TOOLS` invocando un binario externo (`dsh-runtime`). | **Operador en Lazo Cerrado X11/Wayland (`core/platform/computer_loop.py` + `human_pc_controller.py`)**: `ctypes` nativo (`libX11`/`libXtst`) con flujo obligatorio `Objetivo → Observación Previa → Plan → Acción → Nueva Observación → Verificación de Delta → Recibo SHA-256`. |
| **Browser Automation** | `AnyModelBot` / `OpenGrokBot` | Delegado a extensiones externas o ausente en el núcleo. | **Inspector DOM Accesible (`@ref`) + Driver CDP (`core/platform/computer_loop.py` + `cdp_browser_driver.py`)**: extracción verificada de estado HTTP/DOM, enlaces, botones, formularios y hash SHA-256 del DOM antes y después. |
| **Terminal** | `Muse Local Gateway` / `Hermes Agent` | `muse-local-gateway/bench.py`: `subprocess.Popen` con `os.setsid` y `os.killpg`. | **Ejecutor de Terminal Sandboxed con Supervisor Independiente (`shell_exec` + `python_test_runner`)**: bloqueo determinista de comandos destructivos, aislamiento en el `workspace` del agente, redacción de secretos y verificación de artefactos generados. |
| **MCP** | `Grok Bot CLI` / `AnyModelBot` | `grok-bot-cli/src/mcp/claude-channel.ts`: puente MCP sobre stdio. | **Motor Dual MCP Server + MCP Client JSON-RPC 2.0 (`core/platform/tools_mcp.py`)**: implementa `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read` con validación JSON Schema y permisos por agente. |
| **Routines** | `OpenGrokBot` | `server/routines.ts` + `server/cron.ts`: inyecta un texto en el chat grupal. | **Motor de Rutinas Verificables y Webhooks (`core/orchestrator/routines.py` + `core/platform/orchestrator.py`)**: rutinas persistentes sujetas a modos de autonomía (`PLAN_ONLY`, `ASK_BEFORE_ACTION`, `CONTROLLED_AUTONOMY`, `FULL_AUTONOMY`). |
| **Scheduling** | `AnyModelBot` / `Hermes Agent` | `AnyModelBot/src/tasks/scheduler.ts` y `Hermes Agent/cron/`. | **Scheduler Persistente con Checkpoints y Crash Recovery (`core/platform/storage.py` + `orchestrator.py`)**: persiste cada etapa en SQLite WAL y recupera tareas interrumpidas tras reinicios (`Scenario E`) sin reejecutar pasos ya verificados. |
| **Multimodalidad** | `Dee-Bot-Agents` / `Hermes Agent` | Captura ALSA, visión ligera PGM y TTS `edge-tts`/`Piper`. | **Adaptadores Multimodales de Carga Diferida (`core/sensory/`)**: activación bajo demanda sin cargar modelos pesados al arranque; separación explícita entre pruebas sintéticas DSP y captura de hardware real. |
| **Comunicación entre agentes** | `Grok Bot CLI` | `src/core/relay/engine.js`: máquina de estados y límite `hop < 4`. | **Bus Estructurado Inter-Agente (`AgentBus` en `storage.py` y `orchestrator.py`)**: protocolos tipados (`DELEGATE`, `REPORT`, `QUERY`, `CONFLICT_RESOLUTION`, `ESCALATE_PERMISSION`) con detección de ciclos (`hop_count < 6`) y trazabilidad SQLite. |
| **Aislamiento** | `Hermes Agent` / `Meta-Muse-Spark` | `Hermes Agent`: `hermes_dir_acl.py` y `sandboxes/`. `Meta-Muse-Spark`: `worktree.ts` vacío (2 líneas). | **Workspaces Físicos Aislados por Agente y Tarea (`data/workspaces/<agent_id>/` + `WorktreeForge`)**: validación determinista de rutas contra Path Traversal y prohibición de escritura fuera del sandbox. |
| **Distribución entre máquinas** | `Muse Local Gateway` | Scripts `bin/gateway-put.sh` y `gateway-exec.sh` sin autenticación ni scheduler. | **Scheduler Distribuido Basado en Recursos (`core/platform/cluster_scheduler.py`)**: registro de nodos (`facu`, `barto`, `manager1`), heartbeats TCP/HTTP, medición de CPU/RAM/Disco/Latencia, firma HMAC-SHA256 y consolidación multi-nodo (`Scenario D`). |
| **Observabilidad** | `OpenGrokBot` / `Hermes Agent` | `OpenGrokBot/server/usage.ts` y `Hermes Agent/telemetry/`. | **Auditoría Forense Inmutable + Doctor + Suite de Benchmarks Reales**: `audit_logs` en SQLite, recibos criptográficos SHA-256 en `data/evidence/`, `dee doctor`, `dee security audit` y `dee benchmark` con medición real de RAM RSS y latencias. |

---

## 3. Diagnóstico del Repositorio `Dee-Bot-Agents` y Plan de Transformación en DEE

### 3.1 Problemas Detectados en la Base Previa
1. **Agentes compartiendo estado global**: Los agentes definidos en `config/squad.json` compartían el mismo entorno de ejecución sin `workspace` propio, sin lista estricta de herramientas (`allowed_tools`), sin presupuesto de tokens individual y sin protocolo de delegación verificable.
2. **Falta de verificación empírica obligatoria tras las acciones**: Las acciones de sistema o escritorio no guardaban un recibo comparativo `before_state` vs `after_state`.
3. **Pruebas sintéticas mezcladas con pruebas de integración**: `scripts/smoke_test.py` mezclaba pruebas matemáticas en memoria con validación de subsistemas.
4. **CLI incompleta respecto al estándar industrial**: Faltaban los subcomandos estructurados (`dee init`, `dee start`, `dee stop`, `dee status`, `dee agent ...`, `dee team ...`, `dee task ...`, `dee node ...`, `dee memory ...`, `dee model ...`, `dee skill ...`, `dee mcp ...`, `dee logs`, `dee doctor`, `dee benchmark`, `dee security audit`).

### 3.2 Arquitectura Implementada en `DEE — Distributed Emergent Engine`
Para superar de forma comprobable a las 11 alternativas en hardware modesto (Linux sin GPU dedicada), DEE se estructura en módulos desacoplados con contratos explícitos dentro de `core/platform/`:

- **`core/platform/storage.py`**: Persistencia ACID en SQLite (`WAL` + `FTS5 BM25`) para agentes, equipos, tareas con checkpoints por etapa, bus de mensajes inter-agente (`AgentBus`), memoria jerárquica de **6 niveles** (`session`, `episodic`, `semantic`, `procedural`, `project`, `shared`) con búsqueda híbrida BM25 + coseno y deduplicación SHA-256, nodos del clúster, aprobaciones y bitácora de auditoría.
- **`core/platform/security.py`**: Supervisor de seguridad determinista e **independiente del LLM** (`PlatformSecuritySupervisor`). Implementa los 4 modos de autonomía (`PLAN_ONLY`, `ASK_BEFORE_ACTION`, `CONTROLLED_AUTONOMY`, `FULL_AUTONOMY`), bloquea Path Traversal, Command Injection, Prompt Injection y escalamiento de privilegios, y gestiona solicitudes de permisos cuando un agente requiere una herramienta/skill que no posee (`Scenario F`).
- **`core/platform/models.py`**: Motor multi-proveedor (`Ollama`, `llama.cpp`, `OpenAI-compatible :3001`, `Gemini`, `Anthropic`, `Mistral`, `Qwen`, `Cloudflare AI`, más `local_deterministic` offline) con declaración estricta de modalidades (`text`, `code`, `vision`), health checks reales por socket/HTTP, selección automática, fallback y contabilidad de tokens/costes.
- **`core/platform/tools_mcp.py`**: Registro de herramientas con validación de esquemas JSON, gestor de **Skills** instalables y verificables (`SkillRegistry`), y servidor/cliente **MCP (JSON-RPC 2.0)** real (`MCPManager`).
- **`core/platform/computer_loop.py`**: Operador de computadora y navegador en **bucle cerrado** (`Objetivo → Observación Previa → Plan → Acción → Nueva Observación → Verificación de Delta → Recibo SHA-256`) sobre Linux X11/Wayland y DOM HTTP/CDP (`Scenario C`).
- **`core/platform/cluster_scheduler.py`**: Registro de nodos distribuidos (`facu`, `barto`, `manager1`), heartbeats, descubrimiento de capacidades de hardware (CPU, RAM libre, disco, GPU, latencia), firma HMAC-SHA256 y ejecución distribuida con consolidación de resultados (`Scenario D`).
- **`core/platform/orchestrator.py`**: Motor Cognitivo (`CognitiveEngine`), Runtime de Agente (`AgentRuntime`) y Orquestador Multiagente (`MultiAgentOrchestrator`) que ejecuta planes por etapas, delega entre especialistas, desarrolla y corrige código ejecutando pruebas reales en workspaces aislados (`Scenario B`), recupera tareas interrumpidas tras caídas (`Scenario E`) y coordina los **6 Escenarios Obligatorios (A–F)**.

---

## 4. Estado de Verificación de esta Entrega y Limitaciones Declaradas (10/11/2026)

### 4.1 Defectos corregidos en esta pasada
1. **Contrato de rutinas (`core/orchestrator/routines.py`)**: `RoutinesEngine.trigger` invocaba siempre `runner_fn(..., forced_agent_id=...)`, por lo que un callable válido de un solo argumento fallaba con `TypeError` y la rutina quedaba marcada como error. Ahora inspecciona la firma, soporta ambas formas y normaliza resultados no-dict.
2. **Reporte de proveedores (`core/platform/benchmark.py` y `core/platform/models.py`)**: `dee doctor` contaba como “listos” proveedores remotos solo por tener el puerto 443 abierto, aunque no tuvieran credenciales, y marcaba al motor determinista local como inalcanzable. Ahora separa `ready_providers`, `unconfigured_providers` y `unreachable_providers` según configuración y conectividad reales.
3. **`dee stop` (`cli/dee_cli.py`)**: declaraba `ok: true` sin detener nada cuando había un proceso escuchando en `:8091` pero no existía PID file. Ahora verifica el puerto tras la señal, devuelve el estado real y no termina procesos no identificados.
4. **`dee agent run` (`cli/dee_cli.py` + `core/platform/orchestrator.py`)**: instanciaba el runtime del agente pero la tarea quedaba asignada a `dee_prime` y usaba el modo por defecto de la CLI. Ahora valida que el agente exista, usa su `permissions_mode` si no se pasa `--mode` y persiste `assigned_agent_id` correctamente.
5. **`dee task cancel` / `dee task resume`**: devolvían el objeto de tarea crudo, sin el campo `ok` que usan el resto de comandos. Ahora mantienen un contrato JSON consistente y código de salida correcto.

### 4.2 Evidencia ejecutada en esta pasada
| Verificación | Comando | Resultado real |
|---|---|---|
| Suite unitaria, integración, seguridad, E2E, estrés y benchmarks | `python3 -m unittest discover -s tests -v` | **29/29 OK** (≈40 s) |
| Smoke test Dee | `python3 scripts/smoke_test.py` | **12/12 OK** con `DISPLAY=:1` |
| Build de producción del frontend | `cd frontend && npm run build` | **OK** (1612 módulos; chunks separados: `three` 498,42 kB, app 358,11 kB, `iconos` 26,52 kB, `react` 4,21 kB; sin advertencia de chunk >500 kB) |
| Diagnóstico integral | `python3 cli/dee_cli.py doctor` | **OK**; listos: `openai_compatible`, `ollama`, `local_deterministic`; sin credenciales: Gemini, Anthropic, Mistral, Qwen, Cloudflare; inalcanzable: `llamacpp` |
| Benchmarks | `python3 cli/dee_cli.py benchmark` | Artefacto en `data/evidence/latest_benchmark.json` |
| Sintaxis Python | `python3 -m compileall -q core cli node_agent tests skills scripts` | **OK** |
| Sintaxis Node/Electron | `node --check desktop/*.cjs scripts/capturar_screenshots.cjs` | **OK** |
| Captura real de la app Electron | `npm run capturas` sobre Xvfb `:99` | **6/6 capturas** de 1439x899 desde `webContents.capturePage()` con Electron 44.10.2 |
| Ventana Electron en el escritorio físico | `DISPLAY=:1 ./node_modules/.bin/electron .` + `xwininfo`/`ffmpeg x11grab` | Ventana nativa 1366x768 abierta en `:1` (2726x768) mostrando solo el saludo inicial, sin terminal ni voz automática |
| Driver CDP real | Chrome 155 en `:9222` + `POST /api/cdp {accion: map}` | `motor: cdp-websocket`, 80 refs `@n1..@n80` del blog real en 393 ms |
| Sensores | `POST /api/sensory/ears` y `/api/sensory/eyes` con `enabled: true/false` | **4/4 respuestas 200** (`active: true/false`), sin tracebacks |
| Tests del cliente CDP | `python3 -m unittest tests.test_07_cdp_driver` | **4/4 OK** (handshake/framing WebSocket, mapa CDP, fallback HTTP, URL inválida) |
| Suite tras el reintento X11 del Escenario C | `python3 -m unittest discover -s tests` | **29/29 OK** |
| Sintaxis de scripts | `bash -n scripts/*.sh bin/*.sh` | **OK** |
| CLI industrial | `dee init/status/agent/team/task/node/memory/model/skill/mcp/logs/doctor/benchmark/security audit` | Comandos ejecutados; creación/ejecución/cancelación e instalación de skill probadas con datos temporales y limpiadas después |

Medición cruda de la última corrida de benchmark en esta máquina (2 vCPU, sin GPU, `loadavg` 5,72/4,09/3,31; **una sola corrida, no una línea base estable**):

- RAM RSS en reposo: **44,69 MB**; con tareas activas: **44,75 MB** (delta 0,06 MB).
- Inicialización de módulos: **1,952 ms**.
- Búsqueda híbrida FTS5: **133,372 ms** internos (round-trip memoria: 260,237 ms).
- Coordinación multiagente: **3.776,05 ms**.
- Recuperación tras interrupción: **1.929,758 ms**.
- Escenario distribuido de 3 workbenches: **5.853,323 ms**.
- Tokens consumidos por los agentes en la corrida: **108** (sin llamadas a APIs cloud).

### 4.3 Limitaciones honestas (no equivalen a funcionalidad verificada)
1. **Distribución real entre máquinas**: por defecto `barto` y `manager1` apuntan a `127.0.0.1:8731` y `127.0.0.1:8730`. El Escenario D verifica aislamiento por workbench, firma HMAC y consolidación, pero **no prueba tres hosts físicos** salvo que se configuren `DEE_NODE_BARTO_HOST/PORT` y `DEE_NODE_MANAGER1_HOST/PORT` hacia daemons reales.
2. **Proveedores cloud**: Gemini, Anthropic, Mistral, Qwen y Cloudflare no se probaron en vivo porque faltan credenciales. Las pruebas usan `local_deterministic` como fallback; no se afirma generación real en esos servicios.
3. **Computer Use**: el lazo X11 se verificó con `DISPLAY=:1` y la ventana Electron se abrió y capturó en ese mismo escritorio físico. La entrada en Wayland **no** está verificada en esta corrida.
4. **Browser automation**: el driver ahora habla CDP real por WebSocket contra Chrome 155 (`:9222`), verificado con 80 refs `@n1..@n80` sobre el blog en producción. Si no hay Chrome con depuración remota, cae al parser HTTP y lo declara en el campo `motor: "http-fallback"`; en ese caso el smoke sigue reportando `CDP activo=False`.
5. **Pruebas sintéticas**: DSP de voz y visión PGM están etiquetadas explícitamente como `[SYNTHETIC_UNIT]`; no sustituyen captura de hardware real.
6. **`dee stop`**: solo termina el proceso iniciado por `dee start` mediante su PID file; no mata procesos ajenos que ocupen `:8091`.
7. **Frontend**: resuelto con `manualChunks` en `frontend/vite.config.ts` (Three.js, React e iconos separados); el build ya no emite la advertencia de chunk >500 kB.
8. **Ventana Electron en el escritorio real**: la app se verificó abriendo la ventana nativa y capturando su contenido con `webContents.capturePage()` sobre Xvfb (`DISPLAY=:99`), con `--no-zygote --disable-gpu-sandbox` porque este entorno de ejecución bloquea el zygote de Chromium. No se pudo inspeccionar visualmente la ventana sobre el `DISPLAY=:1` físico desde esta sesión; el lanzador y el proceso principal sí se ejecutaron y cargaron el HUD real.

### 4.4 Correcciones de escritorio Electron y HUD en esta pasada
1. **`desktop/launch.cjs`**: eliminó la ruta absoluta ajena `/home/facu/AnyModelBot/...`; ahora resuelve el binario de Electron del propio `node_modules`, limpia `ELECTRON_RUN_AS_NODE`, usa `--ozone-platform-hint=auto` en Linux y falla con un mensaje accionable si falta `npm install`.
2. **`desktop/main.cjs`**: los demonios (`:8091`, `:8730`, `:8731`) escriben su salida en `data/logs/*.log` en lugar de `stdio: 'ignore'`; se agregó instancia única (enfoca la ventana existente), `disable-dev-shm-usage` y una pantalla de error con la ruta del log en vez de cerrar en silencio.
3. **HUD (`frontend/src/App.tsx`)**: se eliminó el contenedor flotante inferior que tapaba al personaje; ahora hay una barra de comando compacta con el arsenal de habilidades plegable. Al abrir, Dee solo saluda (`¿Necesitás ayuda con algo?`): la terminal y la voz del demonio autónomo ya no se despliegan solas hasta que Facu interactúa.
4. **Centro Operativo**: el modal sincroniza la sección pedida desde la barra lateral (antes podía abrir siempre `Escuadrón`).
5. **Capturas y README**: se reemplazaron las capturas viejas (marca `KRONOS`) por 6 capturas reales de la ventana Electron y 2 renders de terminal con salida real; `scripts/generate_tutorials_media.py` ya no copia imágenes `kronos_*` ni usa rutas absolutas ajenas.

### 4.5 Driver CDP real, sensores y dependencias locales (misma pasada)
1. **CDP de verdad (`core/computer_use/cdp_ws.py`, nuevo)**: el “Driver CDP” anterior sólo hacía `urllib` + parseo de HTML crudo, así que no veía nada generado por JavaScript. Se implementó un cliente WebSocket RFC 6455 en stdlib (handshake, frames enmascarados, ping/pong, close) y `CDPSession` con `Runtime.evaluate` y `Page.navigate`. `CDPBrowserDriver.inspect_interactive_map` ahora usa CDP como camino principal, devuelve `motor: "cdp-websocket"` y cae a `http-fallback` (declarando el error) sólo si no hay pestaña CDP.
   - Verificación real: Chrome 155 con `--remote-debugging-port=9222`; el blog en producción devolvió 80 refs `@n1..@n80` en 393 ms, incluyendo enlaces del header generados por la app.
   - Verificación de JavaScript: una página local con un `<button>` agregado por `setTimeout` apareció como `@n4` por CDP (`4` elementos) mientras el fallback HTTP devolvió `3`. Ese es exactamente el caso que antes se perdía.
2. **HUD**: el panel del mapa ahora muestra un badge con el motor real (`CDP EN VIVO` / `RESPALDO HTTP`) y la latencia medida.
3. **Sensores (`core/main.py`)**: `/api/sensory/eyes` con `enabled: true` fallaba con `TypeError: DeeEyes.authorize() got an unexpected keyword argument 'continuous'`, y apagar los sensores llamaba a `EYES.revoke()` / `EARS.revoke()`, métodos inexistentes. Corregido a `watchdog=` y `shutdown()`; las cuatro combinaciones (oídos/ojos, on/off) responden `200` y sin tracebacks.
4. **Dependencia oculta**: `Dee-Bot-Agents/node_modules` era un symlink a `/home/facu/AnyModelBot/node_modules`, por lo que la ventana se abría con un Electron ajeno al proyecto. Se reemplazó por una instalación local real (`npm install` → Electron 44.10.2) y se agregó `package-lock.json`; `readlink -f node_modules/.bin/electron` ahora apunta dentro del repositorio.
5. **Ventana en el escritorio físico**: `DISPLAY=:1 ./node_modules/.bin/electron .` abrió la ventana nativa 1366x768 en la pantalla real de 2726x768, mostrando únicamente el saludo `¡Hola Facu! ¿Necesitás ayuda con algo?`, con el panel de terminal cerrado.
6. **Tests nuevos (`tests/test_07_cdp_driver.py`)**: 4 pruebas deterministas que levantan un servidor WebSocket CDP simulado y un portal HTTP local para cubrir handshake/framing, mapeo por CDP, fallback HTTP y rechazo de URL no-`ws`.

/**
 * DEE-BOT-AGENTS — DEE (DISTRIBUTED EMERGENT ENGINE) — PROCESO PRINCIPAL DE ELECTRON (`desktop/main.cjs`)
 * Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog
 *
 * Aplicación nativa de escritorio Electron:
 * - Inicia y supervisa los demonios reales (:8091 Core, :8730 Gateway, :8731 Workbench)
 *   escribiendo sus logs en `data/logs/` para que un fallo sea diagnosticable.
 * - Ventana nativa sin bordes (`frame: false`) con barra arrastrable en el HUD.
 * - Puente IPC (`ipcMain`) para control de ventana, comandos del sistema y rutas locales.
 * - Instancia única: si se relanza, enfoca la ventana existente en vez de duplicarla.
 */
const { app, BrowserWindow, shell, ipcMain } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');

const PORT = Number(process.env.DEE_PORT ?? 8091);
const URL = `http://127.0.0.1:${PORT}/`;
const ROOT_DIR = path.resolve(__dirname, '..');
const LOG_DIR = path.join(ROOT_DIR, 'data', 'logs');

let mainWindow = null;

app.setName('Dee-Bot-Agents');

// Aceleración gráfica para WebGL / Three.js en Linux X11
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-webgl');
// Contenedores y algunas distros limitan /dev/shm; Chromium necesita este flag ahí.
app.commandLine.appendSwitch('disable-dev-shm-usage');
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
}

function checkPortAlive(port, pathUrl = '/health') {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}${pathUrl}`, (res) => {
      res.resume();
      resolve(Boolean(res.statusCode && res.statusCode < 500));
    });
    req.on('error', () => resolve(false));
    req.setTimeout(600, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function spawnDaemon(args, logName, extraEnv = {}) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const logPath = path.join(LOG_DIR, logName);
  const out = fs.openSync(logPath, 'a');
  const child = spawn('python3', args, {
    cwd: ROOT_DIR,
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', out, out],
    detached: true,
  });
  child.unref();
  return child;
}

async function ensureBackendDaemons() {
  const isGatewayUp = await checkPortAlive(8730, '/health');
  const isBenchUp = await checkPortAlive(8731, '/health');
  const isCoreUp = await checkPortAlive(PORT, '/health');

  if (!isGatewayUp) {
    spawnDaemon([path.join(ROOT_DIR, 'node_agent', 'gateway.py')], 'gateway.log');
  }
  if (!isBenchUp) {
    spawnDaemon([path.join(ROOT_DIR, 'node_agent', 'bench.py')], 'bench.log');
  }
  if (!isCoreUp) {
    spawnDaemon(['-m', 'core.main'], 'dee_core.log', { DEE_PORT: String(PORT) });
  }
}

function waitForCoreServer(retries = 80) {
  return new Promise((resolve, reject) => {
    const tryOnce = (left) => {
      const req = http.get(`${URL}health`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve(true);
        else retry(left);
      });
      req.on('error', () => retry(left));
      req.setTimeout(800, () => req.destroy(new Error('timeout')));

      function retry(remaining) {
        if (remaining <= 0) {
          reject(new Error(`El servidor maestro de Dee (:${PORT}) no respondió a tiempo.`));
        } else {
          setTimeout(() => tryOnce(remaining - 1), 250);
        }
      }
    };
    tryOnce(retries);
  });
}

function errorPage(message) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
  <title>Dee-Bot-Agents — Error de arranque</title>
  <style>
    body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
      background:#02050b;color:#e2e8f0;font-family:system-ui,sans-serif}
    .box{max-width:720px;padding:32px;border:1px solid #1e293b;border-radius:18px;background:#050914}
    h1{margin:0 0 12px;font-size:20px;color:#f43f5e}
    code{color:#22d3ee;background:#0b1424;padding:2px 6px;border-radius:6px}
    p{line-height:1.6;font-size:14px;color:#94a3b8}
  </style></head><body><div class="box">
  <h1>No se pudo abrir el HUD de DEE</h1>
  <p>${String(message).replace(/[<>&]/g, '')}</p>
  <p>Revisá <code>data/logs/dee_core.log</code> e iniciá los servicios con
  <code>./scripts/start_dee.sh --no-window</code>.</p>
  </div></body></html>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

async function createDesktopWindow() {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#02050b',
    title: 'Dee-Bot-Agents — DEE (Distributed Emergent Engine) — Escritorio Electron Nativo',
    frame: false,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  try {
    await waitForCoreServer();
    await mainWindow.loadURL(URL);
  } catch (err) {
    console.error('[Dee Electron] Arranque fallido:', err.message);
    await mainWindow.loadURL(errorPage(err.message));
  }
}

// ============================================================================
// PUENTE IPC NATIVO DE ELECTRON (Ventana, Sistema Operativo y Ejecución Real)
// ============================================================================
ipcMain.handle('dee:ventana-minimizar', () => {
  if (mainWindow) mainWindow.minimize();
  return { ok: true };
});

ipcMain.handle('dee:ventana-maximizar', () => {
  if (!mainWindow) return { ok: false, maximizada: false };
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return { ok: true, maximizada: false };
  }
  mainWindow.maximize();
  return { ok: true, maximizada: true };
});

ipcMain.handle('dee:ventana-siempre-encima', () => {
  if (!mainWindow) return { ok: false, siempreEncima: false };
  const next = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(next);
  return { ok: true, siempreEncima: next };
});

ipcMain.handle('dee:ventana-cerrar', () => {
  if (mainWindow) mainWindow.close();
  return { ok: true };
});

ipcMain.handle('dee:info-electron', () => {
  return {
    ok: true,
    esElectron: true,
    pid: process.pid,
    plataforma: process.platform,
    electronVersion: process.versions.electron || '',
    chromeVersion: process.versions.chrome || '',
    nodeVersion: process.versions.node || '',
    siempreEncima: mainWindow ? mainWindow.isAlwaysOnTop() : false,
    maximizada: mainWindow ? mainWindow.isMaximized() : false,
    backend: URL,
  };
});

ipcMain.handle('dee:abrir-externo', async (_evt, targetUrl) => {
  if (targetUrl) {
    await shell.openExternal(String(targetUrl));
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle('dee:abrir-ruta', async (_evt, filePath) => {
  if (filePath) {
    const err = await shell.openPath(String(filePath));
    return { ok: !err, error: err || null };
  }
  return { ok: false };
});

ipcMain.handle('dee:ejecutar-nativo', async (_evt, comando) => {
  return new Promise((resolve) => {
    require('node:child_process').exec(
      String(comando || 'uptime'),
      { cwd: ROOT_DIR, timeout: 25000 },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          exit_code: err && typeof err.code === 'number' ? err.code : 0,
          stdout: stdout || '',
          stderr: stderr || (err ? err.message : ''),
        });
      }
    );
  });
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    await ensureBackendDaemons();
    await createDesktopWindow();
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}

/**
 * DEE-BOT-AGENTS — DEE (DISTRIBUTED EMERGENT ENGINE) — PROCESO PRINCIPAL DE ELECTRON (`desktop/main.cjs`)
 * Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog
 *
 * Aplicación nativa de escritorio Electron (estilo OpenGrokBot superado):
 * - Inicia y supervisa automáticamente los demonios reales (:8091 Core, :8730 Gateway, :8731 Workbench).
 * - Ventana nativa sin bordes de navegador (`frame: false`) con barra de título arrastrable (`-webkit-app-region: drag`).
 * - Puente IPC nativo (`ipcMain`) para control de ventana (Minimizar, Maximizar, Siempre Encima, Cerrar),
 *   ejecución de comandos del sistema operativo y apertura de programas locales.
 */
const { app, BrowserWindow, shell, ipcMain } = require('electron');
const { spawn, exec } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');

const PORT = Number(process.env.DEE_PORT ?? 8091);
const URL = `http://127.0.0.1:${PORT}/`;
const ROOT_DIR = path.resolve(__dirname, '..');

let mainWindow = null;
let coreProcess = null;
let gatewayProcess = null;
let benchProcess = null;

// Optimización de aceleración gráfica WebGL / Three.js en Linux X11
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('no-sandbox');

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

async function ensureBackendDaemons() {
  const isGatewayUp = await checkPortAlive(8730, '/health');
  const isBenchUp = await checkPortAlive(8731, '/health');
  const isCoreUp = await checkPortAlive(PORT, '/health');

  if (!isGatewayUp) {
    gatewayProcess = spawn('python3', [path.join(ROOT_DIR, 'node_agent', 'gateway.py')], {
      cwd: ROOT_DIR,
      stdio: 'ignore',
      detached: true,
    });
    gatewayProcess.unref();
  }
  if (!isBenchUp) {
    benchProcess = spawn('python3', [path.join(ROOT_DIR, 'node_agent', 'bench.py')], {
      cwd: ROOT_DIR,
      stdio: 'ignore',
      detached: true,
    });
    benchProcess.unref();
  }
  if (!isCoreUp) {
    coreProcess = spawn('python3', ['-m', 'core.main'], {
      cwd: ROOT_DIR,
      env: { ...process.env, DEE_PORT: String(PORT) },
      stdio: 'ignore',
      detached: true,
    });
    coreProcess.unref();
  }
}

function waitForCoreServer(retries = 60) {
  return new Promise((resolve, reject) => {
    const tryOnce = (left) => {
      const req = http.get(`${URL}health`, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (left <= 0) reject(new Error('El servidor maestro de Dee (:8091) no respondió a tiempo.'));
        else setTimeout(() => tryOnce(left - 1), 250);
      });
    };
    tryOnce(retries);
  });
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

  await waitForCoreServer();
  await mainWindow.loadURL(URL);
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
    electronVersion: process.versions.electron || '38.8.6',
    chromeVersion: process.versions.chrome || '',
    nodeVersion: process.versions.node || '',
    siempreEncima: mainWindow ? mainWindow.isAlwaysOnTop() : false,
    maximizada: mainWindow ? mainWindow.isMaximized() : false,
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
    exec(String(comando || 'uptime'), { cwd: ROOT_DIR, timeout: 25000 }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        exit_code: err && typeof err.code === 'number' ? err.code : 0,
        stdout: stdout || '',
        stderr: stderr || (err ? err.message : ''),
      });
    });
  });
});

app.whenReady().then(async () => {
  await ensureBackendDaemons();
  try {
    await createDesktopWindow();
  } catch (err) {
    console.error('[Dee Electron Error]:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

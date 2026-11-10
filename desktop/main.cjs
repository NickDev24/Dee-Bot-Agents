/**
 * DEE-BOT-AGENTS v4.0 SUPREME — APLICACIÓN NATIVA DE ESCRITORIO ELECTRON
 * Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog
 *
 * Inicia automáticamente los demonios reales del sistema (:8091 Core, :8730 Archivos, :8731 Workbench)
 * y despliega el Centro de Comando 3D + Multi-Agente estilo Grok-Bot / Meta-Muse en una ventana
 * nativa de escritorio con soporte de ejecución de programas locales, navegador embebido y terminales reales.
 */
const { app, BrowserWindow, shell, ipcMain } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');

const PORT = Number(process.env.DEE_PORT ?? 8091);
const URL = `http://127.0.0.1:${PORT}/`;
const ROOT_DIR = path.resolve(__dirname, '..');

let coreProcess = null;
let gatewayProcess = null;
let benchProcess = null;

// Optimización WebGL en procesadores Intel HD Graphics / Linux X11
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-webgl');

function checkPortAlive(port, pathUrl = '/health') {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}${pathUrl}`, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(600, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureBackendDaemons() {
  const isCoreUp = await checkPortAlive(PORT, '/health');
  const isGatewayUp = await checkPortAlive(8730, '/health');
  const isBenchUp = await checkPortAlive(8731, '/health');

  if (!isGatewayUp) {
    gatewayProcess = spawn('python3', [path.join(ROOT_DIR, 'node_agent', 'gateway.py')], {
      cwd: ROOT_DIR,
      stdio: 'ignore',
    });
  }
  if (!isBenchUp) {
    benchProcess = spawn('python3', [path.join(ROOT_DIR, 'node_agent', 'bench.py')], {
      cwd: ROOT_DIR,
      stdio: 'ignore',
    });
  }
  if (!isCoreUp) {
    coreProcess = spawn('python3', ['-m', 'core.main'], {
      cwd: ROOT_DIR,
      env: { ...process.env, DEE_PORT: String(PORT) },
      stdio: 'inherit',
    });
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
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#02050b',
    title: 'Dee-Bot-Agents v4.0 Supreme — por Facu Cercuetti (@NickDev24)',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#050914',
      symbolColor: '#38bdf8',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  await waitForCoreServer();
  await win.loadURL(URL);
}

// IPC Nativo para abrir enlaces, rutas o programas del sistema
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
  if (coreProcess) coreProcess.kill();
  if (gatewayProcess) gatewayProcess.kill();
  if (benchProcess) benchProcess.kill();
  app.quit();
});

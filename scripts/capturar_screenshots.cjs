#!/usr/bin/env node
/**
 * CAPTURADOR REAL DE PANTALLAS DEL ESCRITORIO ELECTRON (`scripts/capturar_screenshots.cjs`)
 * Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog
 *
 * Abre la MISMA ventana Electron que usa la aplicación (`desktop/preload.cjs`,
 * `frame: false`) contra el Core real en :8091 y guarda capturas con
 * `webContents.capturePage()` en `docs/tutorials/screenshots/`.
 *
 * Uso:
 *   npm run capturas                 # requiere Core (:8091) y HUD compilado
 *   DISPLAY=:99 npm run capturas     # sobre un Xvfb / pantalla virtual
 *   DEE_URL=http://127.0.0.1:8091/ npm run capturas
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT_DIR, 'docs', 'tutorials', 'screenshots');
const URL = process.env.DEE_URL || `http://127.0.0.1:${process.env.DEE_PORT || 8091}/`;
const WIDTH = Number(process.env.DEE_CAPTURE_WIDTH || 1440);
const HEIGHT = Number(process.env.DEE_CAPTURE_HEIGHT || 900);
const BOOT_MS = Number(process.env.DEE_CAPTURE_BOOT_MS || 9000);
const SETTLE_MS = Number(process.env.DEE_CAPTURE_SETTLE_MS || 2200);

app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('disable-dev-shm-usage');
// Necesario en contenedores/entornos con zygote restringido; sin esto el
// compositor devuelve UnknownVizError y la captura sale vacía.
app.commandLine.appendSwitch('no-zygote');
app.commandLine.appendSwitch('disable-gpu-sandbox');
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
}
if (process.env.DEE_NO_SANDBOX === '1' || (process.getuid && process.getuid() === 0)) {
  app.commandLine.appendSwitch('no-sandbox');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function waitForServer(retries = 80) {
  return new Promise((resolve, reject) => {
    const tryOnce = (left) => {
      const req = http.get(`${URL}health`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) return resolve(true);
        retry(left);
      });
      req.on('error', () => retry(left));
      req.setTimeout(800, () => req.destroy(new Error('timeout')));

      function retry(remaining) {
        if (remaining <= 0) reject(new Error(`Core de Dee no disponible en ${URL}`));
        else setTimeout(() => tryOnce(remaining - 1), 250);
      }
    };
    tryOnce(retries);
  });
}

async function clickByText(win, text) {
  const clicked = await win.webContents.executeJavaScript(
    `(() => {
      const target = [...document.querySelectorAll('button')].find((b) =>
        (b.textContent || '').replace(/\\s+/g, ' ').includes(${JSON.stringify(text)})
      );
      if (!target) return false;
      target.click();
      return true;
    })()`
  );
  if (!clicked) console.warn(`⚠️  No se encontró el botón "${text}"`);
  return clicked;
}

async function waitForText(win, text, timeoutMs = 9000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const found = await win.webContents.executeJavaScript(
      `document.body.innerText.includes(${JSON.stringify(text)})`
    );
    if (found) return true;
    await sleep(300);
  }
  console.warn(`⚠️  No apareció en pantalla: "${text}"`);
  return false;
}

async function capture(win, fileName) {
  await sleep(SETTLE_MS);
  const image = await win.webContents.capturePage();
  const size = image.getSize();
  if (!size.width || !size.height) throw new Error(`Captura vacía: ${fileName}`);
  const file = path.join(OUT_DIR, fileName);
  fs.writeFileSync(file, image.toPNG());
  console.log(`📸 ${fileName} — ${size.width}x${size.height}, ${Math.round(fs.statSync(file).size / 1024)} KB`);
}

async function reload(win) {
  await win.loadURL(URL);
  await sleep(BOOT_MS);
}

// Réplica de los handlers IPC de `desktop/main.cjs` para que el HUD muestre la
// versión real de Electron y sus botones de ventana respondan durante la captura.
ipcMain.handle('dee:info-electron', () => ({
  ok: true,
  esElectron: true,
  plataforma: process.platform,
  electronVersion: process.versions.electron,
  chromeVersion: process.versions.chrome,
  nodeVersion: process.versions.node,
  siempreEncima: false,
  maximizada: false,
}));
for (const canal of [
  'dee:ventana-minimizar',
  'dee:ventana-maximizar',
  'dee:ventana-siempre-encima',
  'dee:ventana-cerrar',
]) {
  ipcMain.handle(canal, () => ({ ok: true }));
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await waitForServer();

  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    useContentSize: true,
    frame: false,
    show: true,
    backgroundColor: '#02050b',
    title: 'Dee-Bot-Agents — capturas reales',
    webPreferences: {
      preload: path.join(ROOT_DIR, 'desktop', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) console.warn('[HUD]', message);
  });

  await reload(win);
  await capture(win, '01_dee_electron_hud_3d.png');

  await clickByText(win, 'Formación 6 Agentes 3D');
  await capture(win, '02_dee_escuadron_6_agentes_3d.png');

  await reload(win);
  await clickByText(win, 'Control Físico PC (X11)');
  await waitForText(win, 'Control Físico PC (X11)');
  await capture(win, '03_dee_centro_operaciones_x11.png');

  await reload(win);
  await clickByText(win, 'Skills & Motor RAG 0-RAM');
  await waitForText(win, 'Skills & Motor RAG 0-RAM');
  await capture(win, '04_dee_skills_rag_0ram.png');

  await reload(win);
  await clickByText(win, 'Navegador & Driver CDP');
  await waitForText(win, 'Navegador Real & Driver CDP');
  // Extrae el DOM por CDP real para que la captura muestre refs @n1.. y el motor usado.
  await clickByText(win, 'Ir & Extraer DOM (@ref)');
  await waitForText(win, '@n1', 15000);
  await capture(win, '05_dee_navegador_cdp.png');

  await reload(win);
  await clickByText(win, 'Terminal en Vivo');
  await capture(win, '06_dee_terminal_en_vivo.png');

  console.log(`✅ Capturas reales guardadas en ${OUT_DIR}`);
  app.exit(0);
}).catch((err) => {
  console.error('❌ Error al capturar pantallas:', err.message);
  app.exit(1);
});

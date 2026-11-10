const { app, BrowserWindow } = require('electron');
const path = require('path');

// Force X11 and enable WebGL on Intel HD 2000 (Sandy Bridge) on Debian 13
app.commandLine.appendSwitch('ozone-platform', 'x11');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    title: 'Dee-Bot-Agents // v4.0 Supreme',
    backgroundColor: '#02050b',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const targetUrl = process.env.DEE_HUD_URL || 'http://127.0.0.1:8091';
  win.loadURL(targetUrl).catch(() => {
    const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
    win.loadFile(distIndex);
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/**
 * PRELOAD NATIVO DE ELECTRON — DEE-BOT-AGENTS — DEE (DISTRIBUTED EMERGENT ENGINE)
 * Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog
 *
 * Expone el puente IPC nativo `window.deeElectron` dentro de la ventana de escritorio Electron.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deeElectron', {
  esElectron: true,
  plataforma: process.platform,
  versiones: {
    electron: process.versions.electron || '38.x',
    chrome: process.versions.chrome || '',
    node: process.versions.node || '',
  },
  minimizarVentana: () => ipcRenderer.invoke('dee:ventana-minimizar'),
  maximizarVentana: () => ipcRenderer.invoke('dee:ventana-maximizar'),
  cerrarVentana: () => ipcRenderer.invoke('dee:ventana-cerrar'),
  alternarSiempreEncima: () => ipcRenderer.invoke('dee:ventana-siempre-encima'),
  obtenerInfoElectron: () => ipcRenderer.invoke('dee:info-electron'),
  abrirExterno: (url) => ipcRenderer.invoke('dee:abrir-externo', url),
  abrirRuta: (ruta) => ipcRenderer.invoke('dee:abrir-ruta', ruta),
  ejecutarComandoNativo: (cmd) => ipcRenderer.invoke('dee:ejecutar-nativo', cmd),
});

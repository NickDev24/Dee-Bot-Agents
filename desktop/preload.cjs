/**
 * Preload seguro para Dee-Bot-Agents Desktop (Electron)
 * Autor: Facu Cercuetti (@NickDev24)
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deeElectron', {
  esElectron: true,
  plataforma: process.platform,
  abrirExterno: (url) => ipcRenderer.invoke('dee:abrir-externo', url),
  abrirRuta: (ruta) => ipcRenderer.invoke('dee:abrir-ruta', ruta),
});

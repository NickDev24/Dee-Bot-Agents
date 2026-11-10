const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('deeDesktop', {
  version: '4.0.0-supreme',
  platform: process.platform,
});

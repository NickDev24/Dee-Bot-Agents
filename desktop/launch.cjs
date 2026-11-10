#!/usr/bin/env node
/**
 * LANZADOR NATIVO ELECTRON DE DEE-BOT-AGENTS (`desktop/launch.cjs`)
 * Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog
 *
 * Resuelve el binario de Electron instalado en el propio proyecto (sin rutas
 * absolutas ajenas al repositorio), limpia `ELECTRON_RUN_AS_NODE` —necesario
 * cuando se invoca desde VS Code, Cursor, Antigravity o NodeTerm— y abre la
 * aplicación de escritorio nativa.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const ROOT_DIR = path.resolve(__dirname, '..');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

if (process.platform === 'linux' && !env.DISPLAY && !env.WAYLAND_DISPLAY) {
  env.DISPLAY = ':0';
}

function resolveElectronBinary() {
  const localBin = path.join(
    ROOT_DIR,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'electron.cmd' : 'electron'
  );
  if (fs.existsSync(localBin)) return localBin;

  try {
    // El paquete `electron` exporta la ruta del binario descargado.
    const binary = require(path.join(ROOT_DIR, 'node_modules', 'electron'));
    if (typeof binary === 'string' && fs.existsSync(binary)) return binary;
  } catch {
    // sigue abajo con el error explícito
  }
  return null;
}

const electronBin = resolveElectronBinary();
if (!electronBin) {
  console.error(
    '❌ No se encontró Electron en node_modules.\n' +
      '   Instalalo con: npm install\n' +
      '   Luego reintentá: npm start   (o ./scripts/iniciar_escritorio_electron.sh)'
  );
  process.exit(1);
}

const args = [path.join(__dirname, 'main.cjs')];
if (process.platform === 'linux') args.push('--ozone-platform-hint=auto');
if (process.getuid && process.getuid() === 0) args.push('--no-sandbox');
args.push(...process.argv.slice(2));

const child = spawn(electronBin, args, {
  cwd: ROOT_DIR,
  stdio: 'inherit',
  env,
});

child.on('error', (err) => {
  console.error('❌ No se pudo iniciar Electron:', err.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});

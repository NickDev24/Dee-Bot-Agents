#!/usr/bin/env node
/**
 * LANZADOR NATIVO ELECTRON DE DEE-BOT-AGENTS (`desktop/launch.cjs`)
 * Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog
 *
 * Limpia `ELECTRON_RUN_AS_NODE` del entorno (necesario cuando se invoca desde VS Code,
 * Cursor, Antigravity o NodeTerm) e inicia la aplicación nativa Electron v44.7.0.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const ROOT_DIR = path.resolve(__dirname, '..');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
if (!env.DISPLAY) {
  env.DISPLAY = ':1';
}

function resolveElectronBinary() {
  const candidates = [
    path.join(ROOT_DIR, 'node_modules', '.bin', 'electron'),
    '/home/facu/AnyModelBot/node_modules/.bin/electron',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    const pkg = require('electron');
    if (typeof pkg === 'string') return pkg;
  } catch {
    // ignore
  }
  return 'electron';
}

const electronBin = resolveElectronBinary();
const child = spawn(
  electronBin,
  [path.join(__dirname, 'main.cjs'), '--no-sandbox', ...process.argv.slice(2)],
  {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env,
  }
);

child.on('exit', (code) => process.exit(code ?? 0));

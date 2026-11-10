#!/usr/bin/env node
/**
 * Lanzador de Escritorio Electron para Dee-Bot-Agents (estilo OpenGrokBot)
 * Limpia ELECTRON_RUN_AS_NODE del entorno para que Electron inicie en modo GUI nativo.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

let electronBin;
try {
  electronBin = require('electron');
} catch {
  electronBin = 'electron';
}

const child = spawn(electronBin, [path.join(__dirname, 'main.cjs'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code) => process.exit(code ?? 0));

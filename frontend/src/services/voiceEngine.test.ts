import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceEngine } from './voiceEngine';
import { JarvisAction, JarvisEmotion } from '../types/jarvis';

test('voiceEngine.parseCommands detects jump and celebration commands', () => {
  let detectedAction: JarvisAction | null = null;
  let detectedEmotion: JarvisEmotion | null = null;
  let replyText: string | null = null;

  voiceEngine.parseCommands('¡JARVIS salta de alegría y celebremos!', (act, emo, reply) => {
    detectedAction = act;
    detectedEmotion = emo;
    replyText = reply;
  });

  assert.equal(detectedAction, 'celebracion_salto');
  assert.equal(detectedEmotion, 'orgullo');
  assert.ok(replyText !== null && (replyText as string).includes('Facu'));
});

test('voiceEngine.parseCommands detects greeting commands', () => {
  let detectedAction: JarvisAction | null = null;
  let detectedEmotion: JarvisEmotion | null = null;

  voiceEngine.parseCommands('Hola JARVIS, buenas tardes', (act, emo) => {
    detectedAction = act;
    detectedEmotion = emo;
  });

  assert.equal(detectedAction, 'saludo');
  assert.equal(detectedEmotion, 'curioso');
});

test('voiceEngine.parseCommands detects work and holographic screens command', () => {
  let detectedAction: JarvisAction | null = null;

  voiceEngine.parseCommands('ponte a trabajar en el código de Electron', (act) => {
    detectedAction = act;
  });

  assert.equal(detectedAction, 'trabajando');
});

test('voiceEngine.parseCommands detects data manipulation command', () => {
  let detectedAction: JarvisAction | null = null;

  voiceEngine.parseCommands('analiza los datos del sistema', (act) => {
    detectedAction = act;
  });

  assert.equal(detectedAction, 'manipular_datos');
});

test('voiceEngine.parseCommands detects goodbye / sleep command', () => {
  let detectedAction: JarvisAction | null = null;
  let detectedEmotion: JarvisEmotion | null = null;

  voiceEngine.parseCommands('hasta luego chau descansa', (act, emo) => {
    detectedAction = act;
    detectedEmotion = emo;
  });

  assert.equal(detectedAction, 'despedida');
  assert.equal(detectedEmotion, 'alivio');
});

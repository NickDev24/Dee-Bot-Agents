import React, { useState } from 'react';
import { 
  X, 
  Terminal, 
  Layers, 
  Cpu, 
  Download, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  Workflow, 
  Laptop 
} from 'lucide-react';

interface Img2ThreejsElectronGuideProps {
  onClose: () => void;
}

export const Img2ThreejsElectronGuide: React.FC<Img2ThreejsElectronGuideProps> = ({ onClose }) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const electronMainCode = `// electron/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  // Ventana transparente para que JARVIS flote en el escritorio
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: false, // Puedes alternar a true para modo compañero
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // En desarrollo carga Vite; en producción el build dist/index.html
  const startUrl = process.env.ELECTRON_START_URL || \`file://\${path.join(__dirname, '../dist/index.html')}\`;
  win.loadURL(startUrl);

  // Permitir mover la ventana desde la barra superior
  ipcMain.handle('window-minimize', () => win.minimize());
  ipcMain.handle('window-close', () => win.close());
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});`;

  const pipelineCode = `# 1. Clonar img2threejs y generar el modelo 3D desde las hojas de referencia
git clone https://github.com/img2threejs/img2threejs.git
cd img2threejs
pip install -r requirements.txt

# 2. Ejecutar la conversión de las imágenes que subiste:
# - Avatar_JARVIS_en_sala_de_control_neon.png
# - Hoja_referencia_animacion_v1.1.jpeg
python convert.py \\
  --input ./assets/Avatar_JARVIS.png \\
  --output ./public/models/jarvis_avatar.glb \\
  --generate-mesh --texture-resolution 2048

# 3. En Three.js se carga mediante GLTFLoader:
# import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
# const loader = new GLTFLoader();
# loader.load('/models/jarvis_avatar.glb', (gltf) => {
#   scene.add(gltf.scene);
#   setupRigAndVisor(gltf);
# });`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 pointer-events-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-fuchsia-500/40 shadow-[0_0_50px_rgba(236,72,153,0.25)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-fuchsia-900/40 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-fuchsia-500/10 border border-fuchsia-400/30 text-fuchsia-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                ARQUITECTURA ELECTRON + IMG2THREEJS
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30">
                  GUÍA TÉCNICA
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Cómo compilar el agente JARVIS en Electron con animación 3D, img2threejs y lipsync.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-300 font-mono">
          {/* Question Answer Summary */}
          <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-2">
            <div className="flex items-center gap-2 text-cyan-300 font-bold text-base">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Respuesta a tu consulta sobre img2threejs + Electron:</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              <strong>¡Sí, totalmente viable!</strong> Puedes usar <a href="https://github.com/img2threejs/img2threejs" target="_blank" rel="noreferrer" className="text-cyan-400 underline inline-flex items-center gap-0.5">img2threejs <ExternalLink className="w-3 h-3" /></a> para transformar las hojas de arte conceptual 2D que subiste en mallas tridimensionales con mapas de textura UV y profundidad, e integrarlas dentro de una aplicación de escritorio basada en <strong>Electron + Three.js</strong>.
            </p>
          </div>

          {/* 4 Pillars of the Architecture */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-xs font-bold text-cyan-400 flex items-center gap-2 mb-1.5">
                <Workflow className="w-4 h-4" /> 1. Conversión con img2threejs
              </span>
              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                Toma la vista frontal y lateral del avatar (imágenes 01, 02 y 08) para estimar mallas poligonales limpias en formato <code>.glb</code> / <code>.gltf</code> con normales y mapas emisivos de neón.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-xs font-bold text-fuchsia-400 flex items-center gap-2 mb-1.5">
                <Cpu className="w-4 h-4" /> 2. Rigging Cinemático & Salto
              </span>
              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                El esqueleto jerárquico (cadera, columna, hombros, codos, rodillas) permite ejecutar la trayectoria parabólica del salto de alegría, el puño en alto de victoria ("4F" en la manga) y las pantallas holográficas del modo trabajo.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-2 mb-1.5">
                <Sparkles className="w-4 h-4" /> 3. Visor Dinámico & Sincronización Labial
              </span>
              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                El rostro no es estático: utiliza un <code>CanvasTexture</code> en Three.js que cambia proceduralmente de ojos (⭐ Orgullo, ◉ Curioso, ⚔️ Combate, ✖✖ Melancolía) y modula las barras LED de la boca en tiempo real al compás de la voz (Web Audio API / TTS).
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-2 mb-1.5">
                <Laptop className="w-4 h-4" /> 4. Runtime en Electron
              </span>
              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                Permite crear una ventana de escritorio con transparencia o ventana flotante que convive con tus programas, con acceso directo al micrófono del sistema y conectores locales para <strong>Ollama / Llama.cpp</strong> o nube (Gemini, Mistral).
              </p>
            </div>
          </div>

          {/* Pipeline Code Snippet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-fuchsia-400 uppercase tracking-wider font-bold">
                Paso 1: Pipeline de conversión con img2threejs
              </span>
              <button
                onClick={() => copyToClipboard(pipelineCode, 'pipeline')}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                {copiedSection === 'pipeline' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copiar comando</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-black border border-slate-800 text-xs text-emerald-400 overflow-x-auto">
              <code>{pipelineCode}</code>
            </pre>
          </div>

          {/* Electron Main Code Snippet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-cyan-400 uppercase tracking-wider font-bold">
                Paso 2: Archivo main.js de Electron (Ventana Transparente)
              </span>
              <button
                onClick={() => copyToClipboard(electronMainCode, 'electron')}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                {copiedSection === 'electron' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copiar código</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-black border border-slate-800 text-xs text-cyan-300 overflow-x-auto">
              <code>{electronMainCode}</code>
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-fuchsia-900/40 bg-slate-950/90 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Este prototipo web ya implementa toda la lógica cinemática y de shaders lista para empaquetar.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-fuchsia-600 text-white font-bold hover:bg-fuchsia-500 transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

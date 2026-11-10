import React, { useRef, useEffect, useState } from 'react';
import { JarvisAction, JarvisEmotion, VoiceLipSyncData } from '../types/jarvis';

interface CyberCockpitStageProps {
  currentAction: JarvisAction;
  currentEmotion: JarvisEmotion;
  lipSyncData: VoiceLipSyncData;
  cameraPreset: 'default' | 'closeup' | 'overview' | 'fullbody';
}

export const CyberCockpitStage: React.FC<CyberCockpitStageProps> = ({
  currentAction,
  currentEmotion,
  lipSyncData,
  cameraPreset,
}) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const visorCanvasRef = useRef<HTMLCanvasElement>(null);

  // Periodic natural blinking
  useEffect(() => {
    const interval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 160);
    }, 3800);
    return () => clearInterval(interval);
  }, []);

  // Parallax mouse movement handler
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  // Render high-res glowing LED visor canvas (Expressions + Lip-Sync)
  useEffect(() => {
    const canvas = visorCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Dark cyber visor plate with scanlines
    ctx.fillStyle = 'rgba(5, 10, 20, 0.94)';
    ctx.fillRect(0, 0, w, h);

    // Scanline grid
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Determine color based on emotion
    let eyeColor = '#00ffff';
    let eyeGlow = 'rgba(0, 255, 255, 0.9)';
    if (currentEmotion === 'orgullo') {
      eyeColor = '#4ade80';
      eyeGlow = 'rgba(74, 222, 128, 0.95)';
    } else if (currentEmotion === 'combate') {
      eyeColor = '#ff00aa';
      eyeGlow = 'rgba(255, 0, 170, 0.95)';
    } else if (currentEmotion === 'melancolia') {
      eyeColor = '#ec4899';
      eyeGlow = 'rgba(236, 72, 153, 0.9)';
    } else if (currentEmotion === 'alivio') {
      eyeColor = '#2dd4bf';
      eyeGlow = 'rgba(45, 212, 191, 0.9)';
    } else if (currentEmotion === 'desden') {
      eyeColor = '#f43f5e';
      eyeGlow = 'rgba(244, 63, 94, 0.9)';
    }

    ctx.shadowBlur = 14;
    ctx.shadowColor = eyeGlow;
    ctx.fillStyle = eyeColor;
    ctx.strokeStyle = eyeColor;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';

    const lx = 80;
    const rx = 176;
    const ey = 55;

    if (blink) {
      // Horizontal blink line
      ctx.beginPath();
      ctx.moveTo(lx - 25, ey);
      ctx.lineTo(lx + 25, ey);
      ctx.moveTo(rx - 25, ey);
      ctx.lineTo(rx + 25, ey);
      ctx.stroke();
    } else {
      switch (currentEmotion) {
        case 'orgullo': {
          // STAR EYES ⭐⭐ (Hoja de Referencia V1.1)
          const drawStar = (cx: number, cy: number) => {
            const spikes = 5;
            const outer = 22;
            const inner = 10;
            let rot = Math.PI / 2 * 3;
            const step = Math.PI / spikes;
            ctx.beginPath();
            ctx.moveTo(cx, cy - outer);
            for (let i = 0; i < spikes; i++) {
              let x = cx + Math.cos(rot) * outer;
              let y = cy + Math.sin(rot) * outer;
              ctx.lineTo(x, y);
              rot += step;
              x = cx + Math.cos(rot) * inner;
              y = cy + Math.sin(rot) * inner;
              ctx.lineTo(x, y);
              rot += step;
            }
            ctx.lineTo(cx, cy - outer);
            ctx.closePath();
            ctx.fill();
          };
          drawStar(lx, ey);
          drawStar(rx, ey);
          break;
        }

        case 'combate': {
          // COMBATE FEROZ: \ / (Angry sharp diagonal neon glow)
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(lx - 26, ey - 12);
          ctx.lineTo(lx + 24, ey + 10);
          ctx.moveTo(rx + 26, ey - 12);
          ctx.lineTo(rx - 24, ey + 10);
          ctx.stroke();
          break;
        }

        case 'melancolia': {
          // NOSTALGIA: ✖ ✖ + TEARS
          const s = 18;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(lx - s, ey - s);
          ctx.lineTo(lx + s, ey + s);
          ctx.moveTo(lx + s, ey - s);
          ctx.lineTo(lx - s, ey + s);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(rx - s, ey - s);
          ctx.lineTo(rx + s, ey + s);
          ctx.moveTo(rx + s, ey - s);
          ctx.lineTo(rx - s, ey + s);
          ctx.stroke();

          // Tear drop trails
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#38bdf8';
          ctx.beginPath();
          ctx.moveTo(lx, ey + s + 3);
          ctx.lineTo(lx, ey + s + 16);
          ctx.moveTo(rx, ey + s + 3);
          ctx.lineTo(rx, ey + s + 16);
          ctx.stroke();
          break;
        }

        case 'alivio': {
          // ALIVIO: ◠ ◠ (Gentle smiling closed curves)
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(lx, ey + 8, 20, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(rx, ey + 8, 20, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
          break;
        }

        case 'desden': {
          // DESDÉN SUTIL: ━ ━ (Narrow squint)
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(lx - 22, ey);
          ctx.lineTo(lx + 22, ey + 3);
          ctx.moveTo(rx - 22, ey + 3);
          ctx.lineTo(rx + 22, ey);
          ctx.stroke();
          break;
        }

        case 'neutro': {
          // SLEEK HORIZONTAL SLITS
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.moveTo(lx - 24, ey);
          ctx.lineTo(lx + 24, ey);
          ctx.moveTo(rx - 24, ey);
          ctx.lineTo(rx + 24, ey);
          ctx.stroke();
          break;
        }

        case 'curioso':
        default: {
          // CURIOSIDAD GENUINA: Wide glowing round scan eyes
          ctx.beginPath();
          ctx.arc(lx, ey, 20, 0, Math.PI * 2);
          ctx.arc(rx, ey, 20, 0, Math.PI * 2);
          ctx.fill();
          // Inner pupil
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#050a14';
          ctx.beginPath();
          ctx.arc(lx - 5, ey - 5, 6, 0, Math.PI * 2);
          ctx.arc(rx - 5, ey - 5, 6, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
    }

    // -------------------------------------------------------------
    // REAL-TIME LIP-SYNC EQUALIZER MOUTH ARRAY
    // Modulated by voice volume and phonemes
    // -------------------------------------------------------------
    const my = 108;
    const mc = 128;
    const barCount = 11;
    const barSpacing = 10;
    const half = Math.floor(barCount / 2);

    ctx.shadowBlur = 10;
    ctx.shadowColor = eyeColor;
    ctx.fillStyle = eyeColor;

    for (let i = 0; i < barCount; i++) {
      const dist = Math.abs(i - half);
      const factor = 1 - dist / (half + 1);
      const wave = Math.sin(Date.now() / 80 + i * 0.9) * 0.35 + 0.65;
      const barH = 4 + lipSyncData.volume * 36 * factor * wave;
      const bx = mc + (i - half) * barSpacing - 2.5;
      const by = my - barH / 2;
      ctx.fillRect(bx, by, 5, barH);
    }
  }, [currentEmotion, lipSyncData, blink]);

  // Camera scale and zoom presets
  const getCameraStyle = () => {
    switch (cameraPreset) {
      case 'closeup': return 'scale-125 translate-y-6';
      case 'overview': return 'scale-95 -translate-y-2';
      case 'fullbody': return 'scale-100 translate-y-2';
      case 'default':
      default: return 'scale-105 translate-y-0';
    }
  };

  const camClass = getCameraStyle();

  return (
    <div
      onMouseMove={handleMouseMove}
      className="absolute inset-0 w-full h-full overflow-hidden select-none bg-black"
    >
      {/* 1. LAYER 1: Cockpit Control Room Background Image with 3D Parallax */}
      <div
        className={`absolute inset-0 w-full h-full transition-transform duration-300 ease-out origin-center ${camClass}`}
        style={{
          transform: `translate3d(${mousePos.x * -16}px, ${mousePos.y * -12}px, 0)`,
        }}
      >
        <img
          src="/assets/aistudio/Avatar_JARVIS_en_sala_de_control_neon_79427a9f.png"
          alt="JARVIS en Sala de Control Cyberpunk"
          className="w-full h-full object-cover object-center filter brightness-95 contrast-105"
        />

        {/* Ambient Neon Atmosphere glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-cyan-950/20 pointer-events-none" />
      </div>

      {/* 2. LAYER 2: DYNAMIC AVATAR POSES (Action Transitions) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* ACTION 1: SALTAR DE ALEGRÍA / CELEBRACIÓN DE VICTORIA */}
        {currentAction === 'celebracion_salto' && (
          <div className="relative z-30 flex flex-col items-center animate-bounce">
            {/* Glowing Victory Banner */}
            <div className="mb-4 px-6 py-2 rounded-full bg-emerald-500/25 border-2 border-emerald-400 text-emerald-300 font-mono font-bold tracking-widest text-sm shadow-[0_0_30px_rgba(74,222,128,0.7)] flex items-center gap-2">
              <span>⭐ ¡VICTORIA CONFIRMADA! ⭐</span>
            </div>

            {/* Celebration Pose Cutout from Sheet V1.1 */}
            <div className="relative max-w-md rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-[0_0_50px_rgba(74,222,128,0.5)] bg-slate-950/90 p-2">
              <img
                src="/assets/aistudio/Gemini_Generated_Image_dwf0a7dwf0a7dwf0_feca4c05.jpeg"
                alt="Celebración de Victoria (Salto con puño en alto)"
                className="w-full object-cover rounded-xl"
                style={{ objectPosition: '10% 85%', height: '420px', width: '340px' }}
              />
              <div className="absolute bottom-4 left-4 right-4 bg-slate-950/95 border border-emerald-500 px-3 py-1.5 rounded-lg text-center text-xs font-mono text-emerald-300 font-bold">
                GESTO: PUÑO EN ALTO // "4F" VISIBLE
              </div>
            </div>
          </div>
        )}

        {/* ACTION 2: TRABAJANDO (PUNTO DE VISTA TÉCNICO // 3 PANTALLAS HOLOGRÁFICAS) */}
        {currentAction === 'trabajando' && (
          <div className="relative z-30 flex flex-col items-center">
            {/* Floating Holographic Triple Terminals */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-52 p-3 rounded-xl bg-slate-950/90 border border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.3)] font-mono text-[10px] text-cyan-300 transform -rotate-2">
                <div className="text-slate-400 border-b border-cyan-900/50 pb-1 mb-1 font-bold">
                  HERMES_AGENT::REASONING
                </div>
                <p>&gt; &lt;think&gt; Analizando dependencias</p>
                <p>&gt; Evaluando loop autónomo</p>
                <p className="text-emerald-400">&gt; Estado: OPTIMIZADO (0ms)</p>
              </div>

              <div className="w-60 p-3 rounded-xl bg-slate-950/95 border-2 border-emerald-400 shadow-[0_0_25px_rgba(74,222,128,0.4)] font-mono text-[10px] text-emerald-300">
                <div className="text-emerald-400 border-b border-emerald-900/50 pb-1 mb-1 font-bold flex items-center justify-between">
                  <span>COMPILACIÓN DE KERNEL</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p>&gt; electron.build() --target=desktop</p>
                <p>&gt; img2threejs.mesh_extract() OK</p>
                <p>&gt; vector_store: 100% sincronizado</p>
              </div>

              <div className="w-52 p-3 rounded-xl bg-slate-950/90 border border-fuchsia-400/50 shadow-[0_0_20px_rgba(236,72,153,0.3)] font-mono text-[10px] text-fuchsia-300 transform rotate-2">
                <div className="text-slate-400 border-b border-fuchsia-900/50 pb-1 mb-1 font-bold">
                  OPENGROK_TEAM::FABRIC
                </div>
                <p>&gt; Nodo Ollama: 3.2ms</p>
                <p>&gt; Sub-agentes activos: 4</p>
                <p className="text-cyan-300">&gt; Conexión Fabric: OK</p>
              </div>
            </div>

            {/* Working Pose Image from User's sheet */}
            <div className="relative rounded-2xl overflow-hidden border border-cyan-400/50 shadow-[0_0_35px_rgba(6,182,212,0.3)] bg-slate-950/80 p-2">
              <img
                src="/assets/aistudio/preview_sample_8c7eef17.png"
                alt="Punto de vista técnico trabajando en múltiples consolas"
                className="object-cover rounded-xl"
                style={{ objectPosition: '4% 18%', height: '360px', width: '380px' }}
              />
              <div className="absolute bottom-4 left-4 right-4 bg-slate-950/90 border border-cyan-500/50 px-3 py-1.5 rounded-lg text-center text-xs font-mono text-cyan-300 font-bold">
                MODO TÉCNICO // TECLEO HOLOGRÁFICO ACTIVO
              </div>
            </div>
          </div>
        )}

        {/* ACTION 3: MANIPULAR DATOS COMPLEJOS */}
        {currentAction === 'manipular_datos' && (
          <div className="relative z-30 flex flex-col items-center">
            <div className="relative mb-3 flex items-center justify-center">
              <div className="w-40 h-40 rounded-full border-2 border-dashed border-cyan-400/60 shadow-[0_0_25px_rgba(6,182,212,0.4)] flex items-center justify-center animate-spin">
                <div className="w-24 h-24 rounded-full border border-fuchsia-400/70 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-lg bg-cyan-500/20 border border-cyan-300 flex items-center justify-center text-xs font-mono text-cyan-300 font-bold shadow-[0_0_15px_#00ffff]">
                    DATA
                  </div>
                </div>
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-cyan-400/50 shadow-[0_0_35px_rgba(6,182,212,0.3)] bg-slate-950/80 p-2">
              <img
                src="/assets/aistudio/Gemini_Generated_Image_dwf0a7dwf0a7dwf0_feca4c05.jpeg"
                alt="Manipulación Táctica de Datos Complejos"
                className="object-cover rounded-xl"
                style={{ objectPosition: '42% 85%', height: '360px', width: '380px' }}
              />
              <div className="absolute bottom-4 left-4 right-4 bg-slate-950/90 border border-cyan-500/50 px-3 py-1.5 rounded-lg text-center text-xs font-mono text-cyan-300 font-bold">
                MANIPULACIÓN TÁCTICA DE DATOS COMPLEJOS
              </div>
            </div>
          </div>
        )}

        {/* ACTION 4: GESTO SALUDO ABIERTO (PALMA LED) */}
        {currentAction === 'saludo' && (
          <div className="relative z-30 flex flex-col items-center">
            <div className="relative rounded-2xl overflow-hidden border-2 border-cyan-400 shadow-[0_0_40px_rgba(6,182,212,0.5)] bg-slate-950/80 p-2">
              <img
                src="/assets/aistudio/preview_sample_8c7eef17.png"
                alt="Gesto de Saludo Abierto con LED de Palma"
                className="object-cover rounded-xl"
                style={{ objectPosition: '8% 68%', height: '360px', width: '360px' }}
              />
              <div className="absolute bottom-4 left-4 right-4 bg-slate-950/95 border border-cyan-400 px-3 py-1.5 rounded-lg text-center text-xs font-mono text-cyan-300 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                GESTO DE SALUDO ABIERTO // ¡HOLA FACU!
              </div>
            </div>
          </div>
        )}

        {/* ACTION 5: EXPLICACIÓN DETALLADA */}
        {currentAction === 'explicacion' && (
          <div className="relative z-30 flex flex-col items-center">
            <div className="relative rounded-2xl overflow-hidden border border-fuchsia-400/50 shadow-[0_0_35px_rgba(236,72,153,0.3)] bg-slate-950/80 p-2">
              <img
                src="/assets/aistudio/Gemini_Generated_Image_dwf0a7dwf0a7dwf0_feca4c05.jpeg"
                alt="Explicación Detallada (Pose de Diálogo Dinámico)"
                className="object-cover rounded-xl"
                style={{ objectPosition: '70% 85%', height: '360px', width: '380px' }}
              />
              <div className="absolute bottom-4 left-4 right-4 bg-slate-950/90 border border-fuchsia-500/50 px-3 py-1.5 rounded-lg text-center text-xs font-mono text-fuchsia-300 font-bold">
                EXPLICACIÓN DETALLADA // ARQUITECTURA HÍBRIDA
              </div>
            </div>
          </div>
        )}

        {/* ACTION 6: DESPEDIDA / MODO REPOSO */}
        {currentAction === 'despedida' && (
          <div className="relative z-30 flex flex-col items-center">
            <div className="relative rounded-2xl overflow-hidden border border-rose-500/50 shadow-[0_0_35px_rgba(244,63,94,0.3)] bg-slate-950/80 p-2">
              <img
                src="/assets/aistudio/preview_sample_8c7eef17.png"
                alt="Modo Despedida y Reposo"
                className="object-cover rounded-xl filter brightness-75"
                style={{ objectPosition: '60% 18%', height: '360px', width: '360px' }}
              />
              <div className="absolute bottom-4 left-4 right-4 bg-slate-950/95 border border-rose-500/50 px-3 py-1.5 rounded-lg text-center text-xs font-mono text-rose-300 font-bold">
                MODO REPOSO Y VIGILANCIA PASIVA
              </div>
            </div>
          </div>
        )}

        {/* DEFAULT IDLE STATE: Real High-Res Cockpit Face Overlay */}
        {currentAction === 'idle' && (
          <div className="relative z-20 flex flex-col items-center">
            {/* Dynamic Interactive Visor Screen mounted on the face */}
            <div 
              className="relative w-64 h-32 rounded-2xl overflow-hidden border-2 border-cyan-400/80 shadow-[0_0_35px_rgba(6,182,212,0.6)] bg-slate-950/95 pointer-events-auto transition-transform duration-300"
              style={{ transform: 'translateY(-86px)' }}
            >
              <canvas
                ref={visorCanvasRef}
                width={256}
                height={128}
                className="w-full h-full object-contain"
              />

              {/* Subtle top visor badge */}
              <div className="absolute top-1 left-3 text-[9px] font-mono text-cyan-400/80 tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>NEURAL_VISOR // {currentEmotion.toUpperCase()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. LAYER 3: Interactive Parallax Ambient Lighting */}
      <div
        className="absolute inset-0 pointer-events-none transition-transform duration-300 ease-out bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.06)_0%,transparent_70%)]"
        style={{
          transform: `translate3d(${mousePos.x * 20}px, ${mousePos.y * 16}px, 0)`,
        }}
      />
    </div>
  );
};

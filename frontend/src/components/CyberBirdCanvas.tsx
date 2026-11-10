import React, { useRef, useEffect } from 'react';
import { JarvisScene } from '../three/JarvisScene';
import { JarvisAction, JarvisEmotion, VoiceLipSyncData } from '../types/jarvis';

interface CyberBirdCanvasProps {
  currentAction: JarvisAction;
  currentEmotion: JarvisEmotion;
  lipSyncData: VoiceLipSyncData;
  cameraPreset?: 'default' | 'closeup' | 'overview' | 'fullbody';
  agentColor?: string;
  showSquadFormation?: boolean;
  onSelectTask?: (taskId: string) => void;
  nodeScale?: number;
  orbitRadius?: number;
  orbitPaused?: boolean;
  orbitAngleOffset?: number;
}

export const CyberBirdCanvas: React.FC<CyberBirdCanvasProps> = ({
  currentAction,
  currentEmotion,
  lipSyncData,
  cameraPreset = 'default',
  agentColor = '#00f0ff',
  showSquadFormation = false,
  onSelectTask,
  nodeScale = 1.0,
  orbitRadius = 2.4,
  orbitPaused = false,
  orbitAngleOffset = 0,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<JarvisScene | null>(null);

  // Initialize Three.js scene once
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new JarvisScene(mountRef.current);
    if (onSelectTask) {
      scene.setOnSelectTask(onSelectTask);
    }
    sceneRef.current = scene;

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current && onSelectTask) {
      sceneRef.current.setOnSelectTask(onSelectTask);
    }
  }, [onSelectTask]);

  // Update Action
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setAction(currentAction);
    }
  }, [currentAction]);

  // Update Emotion
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setEmotion(currentEmotion);
    }
  }, [currentEmotion]);

  // Update LipSync Data
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setLipSync(lipSyncData);
    }
  }, [lipSyncData]);

  // Update Camera Preset
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setCameraPreset(cameraPreset);
    }
  }, [cameraPreset]);

  // Update Node Scale
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setNodeScale(nodeScale);
    }
  }, [nodeScale]);

  // Update Orbit Radius
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setOrbitRadius(orbitRadius);
    }
  }, [orbitRadius]);

  // Update Orbit Paused
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setOrbitPaused(orbitPaused);
    }
  }, [orbitPaused]);

  // Update Orbit Angle Offset
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setOrbitAngle(orbitAngleOffset);
    }
  }, [orbitAngleOffset]);

  // Update Active Agent Color Theme
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setAgentColor(agentColor);
    }
  }, [agentColor]);

  // Update 3D Squad Formation (Dee + 5 Subagentes Iguales de Distinto Color)
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setShowSquadFormation(showSquadFormation);
    }
  }, [showSquadFormation]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#02050b]">
      {/* 1. Escenario WebGL 3D en Tiempo Real */}
      <div 
        ref={mountRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing" 
      />

      {/* 2. Píldora Informativa en Español */}
      <div className="absolute bottom-36 right-6 pointer-events-none hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/75 border border-cyan-500/30 font-mono text-[10px] text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        <span>MOTOR 3D EN TIEMPO REAL · ARRASTRÁ PARA ORBITAR LA CÁMARA</span>
      </div>
    </div>
  );
};

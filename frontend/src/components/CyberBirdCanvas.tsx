import React, { useRef, useEffect } from 'react';
import { JarvisScene } from '../three/JarvisScene';
import { JarvisAction, JarvisEmotion, VoiceLipSyncData } from '../types/jarvis';

interface CyberBirdCanvasProps {
  currentAction: JarvisAction;
  currentEmotion: JarvisEmotion;
  lipSyncData: VoiceLipSyncData;
  cameraPreset?: 'default' | 'closeup' | 'overview' | 'fullbody';
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

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#02050b]">
      {/* 1. Real-time Three.js WebGL Canvas Container */}
      <div 
        ref={mountRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing" 
      />

      {/* 2. Interactive Hint Pill */}
      <div className="absolute top-20 right-6 pointer-events-none hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/70 border border-cyan-500/30 font-mono text-[10px] text-cyan-400/80 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        <span>THREE.JS 3D MESH REAL · ARRASTRA PARA ORBITAR</span>
      </div>
    </div>
  );
};

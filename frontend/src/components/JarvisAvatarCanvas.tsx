import React, { useEffect, useRef } from 'react';
import { JarvisScene } from '../three/JarvisScene';
import { JarvisAction, JarvisEmotion, VoiceLipSyncData } from '../types/jarvis';

interface JarvisAvatarCanvasProps {
  currentAction: JarvisAction;
  currentEmotion: JarvisEmotion;
  lipSyncData: VoiceLipSyncData;
  cameraPreset: 'default' | 'closeup' | 'overview' | 'fullbody';
}

export const JarvisAvatarCanvas: React.FC<JarvisAvatarCanvasProps> = ({
  currentAction,
  currentEmotion,
  lipSyncData,
  cameraPreset,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<JarvisScene | null>(null);

  // Initialize Three.js scene once
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new JarvisScene(mountRef.current);
    sceneRef.current = scene;

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Update Emotion
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setEmotion(currentEmotion);
    }
  }, [currentEmotion]);

  // Update Action
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setAction(currentAction);
    }
  }, [currentAction]);

  // Update Lip-sync
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

  return (
    <div 
      ref={mountRef} 
      className="absolute inset-0 w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing"
      title="Usa el mouse para que JARVIS te siga con la mirada. Mantén Shift + Arrastrar para rotar la cámara 360°"
    />
  );
};

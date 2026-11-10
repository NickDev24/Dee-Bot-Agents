import { JarvisAction, JarvisEmotion, VoiceLipSyncData } from '../types/jarvis';

type SpeechCallback = (text: string) => void;
type LipSyncCallback = (data: VoiceLipSyncData) => void;
type ActionCallback = (action: JarvisAction, emotion: JarvisEmotion, replyText: string) => void;

export interface BackendLipSyncFrame {
  t: number;
  volume: number;
  viseme: VoiceLipSyncData['viseme'];
}

export interface BackendTTSChunk {
  text: string;
  emotion?: JarvisEmotion;
  audio_url?: string | null;
  engine?: string;
  duration_s?: number;
  lip_sync?: BackendLipSyncFrame[];
}

class VoiceEngine {
  private synth: SpeechSynthesis | null = null;
  private recognition: any = null;
  private isListening = false;
  private lipSyncCallback: LipSyncCallback | null = null;
  private animFrameId: number | null = null;
  private isSpeaking = false;
  private currentVolume = 0;
  private activeAudio: HTMLAudioElement | null = null;
  private backendBaseUrl = '';

  constructor() {
    if (typeof window !== 'undefined') {
      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
      }
      // If running on port 3000 (Vite dev), talk to 8091; otherwise same origin
      const loc = window.location;
      this.backendBaseUrl = loc.port === '3000' ? `http://${loc.hostname}:8091` : '';
    }
  }

  public getBackendBaseUrl(): string {
    return this.backendBaseUrl;
  }

  public setLipSyncCallback(cb: LipSyncCallback) {
    this.lipSyncCallback = cb;
  }

  /**
   * Play a real WAV audio chunk synthesized by Dee's backend (edge-tts / piper / melotts)
   * along with its exact 30-FPS viseme timeline!
   */
  public playBackendChunk(chunk: BackendTTSChunk, onEnd?: () => void) {
    this.stopSpeaking();

    if (!chunk.audio_url) {
      this.speakBrowserFallback(chunk.text, chunk.emotion || 'curioso', onEnd);
      return;
    }

    const fullUrl = chunk.audio_url.startsWith('http')
      ? chunk.audio_url
      : `${this.backendBaseUrl}${chunk.audio_url}`;

    const audio = new Audio(fullUrl);
    this.activeAudio = audio;
    this.isSpeaking = true;

    const timeline = chunk.lip_sync && chunk.lip_sync.length > 0 ? chunk.lip_sync : null;
    const startTime = performance.now();

    const updateLipSync = () => {
      if (!this.isSpeaking) {
        this.emitNeutralLipSync();
        return;
      }

      const elapsedS = this.activeAudio && !this.activeAudio.paused
        ? this.activeAudio.currentTime
        : (performance.now() - startTime) / 1000;

      if (timeline) {
        const frameIdx = Math.min(timeline.length - 1, Math.max(0, Math.floor(elapsedS * 30)));
        const frame = timeline[frameIdx];
        if (frame && this.lipSyncCallback) {
          this.lipSyncCallback({
            volume: frame.volume,
            frequency: 120 + frame.volume * 310,
            viseme: frame.viseme || 'neutral',
          });
        }
      } else {
        this.runProceduralLipSyncFrame(elapsedS);
      }

      this.animFrameId = requestAnimationFrame(updateLipSync);
    };

    audio.onplay = () => {
      updateLipSync();
    };

    audio.onended = () => {
      this.isSpeaking = false;
      this.activeAudio = null;
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
      this.emitNeutralLipSync();
      if (onEnd) onEnd();
    };

    audio.onerror = () => {
      this.activeAudio = null;
      // Fallback to browser TTS if audio element fails or autoplay blocked
      this.speakBrowserFallback(chunk.text, chunk.emotion || 'curioso', onEnd);
    };

    audio.play().catch(() => {
      // If audio playback is blocked or handled by native aplay on facu, still animate lip-sync!
      const durMs = Math.max(1200, (chunk.duration_s || 2.5) * 1000);
      updateLipSync();
      setTimeout(() => {
        this.isSpeaking = false;
        if (this.animFrameId) {
          cancelAnimationFrame(this.animFrameId);
          this.animFrameId = null;
        }
        this.emitNeutralLipSync();
        if (onEnd) onEnd();
      }, durMs);
    });
  }

  public async speak(
    text: string,
    emotion: JarvisEmotion = 'curioso',
    onEnd?: () => void
  ) {
    // First try Dee's backend neural TTS (/api/tts) for Argentine voice + real WAV lip-sync
    try {
      const resp = await fetch(`${this.backendBaseUrl}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, emotion, play_local: false }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.audio_url) {
          this.playBackendChunk(
            {
              text,
              emotion,
              audio_url: data.audio_url,
              engine: data.engine,
              duration_s: data.duration_s,
              lip_sync: data.lip_sync,
            },
            onEnd
          );
          return;
        }
      }
    } catch {
      // Backend offline or unreachable, fall back to browser synth
    }

    this.speakBrowserFallback(text, emotion, onEnd);
  }

  private runProceduralLipSyncFrame(elapsed: number) {
    const wave1 = Math.sin(elapsed * 18);
    const wave2 = Math.sin(elapsed * 27 + 1.2);
    const rawVol = Math.max(0, wave1 * 0.6 + wave2 * 0.4);
    const pauseMod = Math.sin(elapsed * 3.5);
    const activeVol = pauseMod > -0.3 ? rawVol : 0;
    this.currentVolume = this.currentVolume * 0.7 + activeVol * 0.3;

    let viseme: VoiceLipSyncData['viseme'] = 'neutral';
    if (this.currentVolume > 0.6) viseme = 'open_a';
    else if (this.currentVolume > 0.35) viseme = 'round_o';
    else if (this.currentVolume > 0.15) viseme = 'wide_e';

    if (this.lipSyncCallback) {
      this.lipSyncCallback({
        volume: this.currentVolume,
        frequency: 120 + this.currentVolume * 300,
        viseme,
      });
    }
  }

  private emitNeutralLipSync() {
    if (this.lipSyncCallback) {
      this.lipSyncCallback({ volume: 0, frequency: 0, viseme: 'neutral' });
    }
  }

  public speakBrowserFallback(
    text: string,
    emotion?: JarvisEmotion,
    onEnd?: () => void
  ) {
    if (!this.synth) {
      if (onEnd) onEnd();
      return;
    }

    this.synth.cancel();
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-AR';
    utterance.rate = 1.08;
    utterance.pitch = emotion === 'combate' ? 0.9 : emotion === 'orgullo' ? 1.15 : 1.0;

    const voices = this.synth.getVoices();
    const esVoice = voices.find(
      (v) =>
        v.lang === 'es-AR' ||
        v.lang.startsWith('es') ||
        v.name.includes('Tomas') ||
        v.name.includes('Spanish')
    );
    if (esVoice) {
      utterance.voice = esVoice;
    }

    this.isSpeaking = true;
    let startTime = performance.now();

    const runLipSync = () => {
      if (!this.isSpeaking) {
        this.emitNeutralLipSync();
        return;
      }
      const elapsed = (performance.now() - startTime) / 1000;
      this.runProceduralLipSyncFrame(elapsed);
      this.animFrameId = requestAnimationFrame(runLipSync);
    };

    utterance.onstart = () => {
      startTime = performance.now();
      runLipSync();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
      this.emitNeutralLipSync();
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.emitNeutralLipSync();
      if (onEnd) onEnd();
    };

    this.synth.speak(utterance);
  }

  public stopSpeaking() {
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio = null;
    }
    if (this.synth) {
      this.synth.cancel();
    }
    this.isSpeaking = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.emitNeutralLipSync();
  }

  public startListening(
    onResult: SpeechCallback,
    onActionDetected?: ActionCallback,
    onError?: (err: any) => void
  ) {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      if (onError) onError('Usando oído físico ALSA de Dee en segundo plano');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'es-AR';
      this.recognition.continuous = false;
      this.recognition.interimResults = false;

      this.recognition.onstart = () => {
        this.isListening = true;
      };

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
        this.parseCommands(transcript, onActionDetected);
      };

      this.recognition.onerror = (event: any) => {
        this.isListening = false;
        if (onError) onError(event.error);
      };

      this.recognition.onend = () => {
        this.isListening = false;
      };

      this.recognition.start();
    } catch (e) {
      this.isListening = false;
      if (onError) onError(e);
    }
  }

  public stopListening() {
    if (this.recognition) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  public parseCommands(text: string, onActionDetected?: ActionCallback) {
    if (!onActionDetected) return;

    const lower = text.toLowerCase();

    if (lower.includes('salta') || lower.includes('alegr') || lower.includes('celebra')) {
      onActionDetected('celebracion_salto', 'orgullo', '¡Toma ya, Facu! ¡Mirá qué joyita te armó Dee! Compilado al toque y con cero warnings.');
    } else if (lower.includes('combate') || lower.includes('alerta') || lower.includes('intruso')) {
      onActionDetected('explicacion', 'combate', '¡Ojo al piojo! Ceño fruncido en ángulo de combate, Sentinel activo y cámaras vigilando.');
    }
  }

  public getIsSpeaking() {
    return this.isSpeaking;
  }

  public getIsListening() {
    return this.isListening;
  }
}

export const voiceEngine = new VoiceEngine();

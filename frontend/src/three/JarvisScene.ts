import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CyberBird3D } from './CyberBird3D';
import { JarvisAction, JarvisEmotion, VoiceLipSyncData } from '../types/jarvis';

export class JarvisScene {
  private container: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;
  private avatar: CyberBird3D;
  private subAvatarsGroup: THREE.Group;
  private subAvatars: { id: string; color: string; avatar: CyberBird3D }[] = [];
  private activeAgentColorHex = '#00f0ff';
  private frameId = 0;
  private isSoftwareGl = false;

  // Adaptive FPS Governor for Pentium B950 / Intel HD 2000 (30 FPS active / 8 FPS idle / 0 FPS hidden)
  private lastActivityTime = performance.now();
  private lastRenderTime = 0;
  private isDocumentHidden = false;
  private currentFpsTarget = 30;
  private currentActionState: JarvisAction = 'idle';

  // Raycasting & Interaction
  private raycaster = new THREE.Raycaster();
  private mouseNorm = { x: 0, y: 0 };
  private cameraTarget = new THREE.Vector3(0, 0.05, 0);
  private cameraPosTarget = new THREE.Vector3(0, 0.15, 4.6);
  private lipSyncState: VoiceLipSyncData = { volume: 0, frequency: 0, viseme: 'neutral' };

  // Orbit / Manual Drag mode
  private isOrbiting = false;
  private orbitAngles = { phi: 0, theta: 0 };
  private lastPointer = { x: 0, y: 0 };
  private pointerDownPos = { x: 0, y: 0 };
  private onSelectTaskCallback?: (taskId: string) => void;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.clock = new THREE.Clock();

    // 1. Detect Software WebGL or Low-Power GPU
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render|Sandybridge|Intel\(R\) HD Graphics 2000/i.test(gpu);
    })();

    // 2. Setup WebGLRenderer (tuned for low GPU memory)
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // 3. Scene & Horizon Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02050b);
    this.scene.fog = new THREE.FogExp2(0x02050b, 0.05);

    // 4. Camera
    this.camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      50
    );
    this.camera.position.set(0, 0.15, 4.6);

    // 5. Studio Environment Map (PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 6. Lighting Rig
    this.setupLighting();

    // 7. Environment & Stage Elements
    this.setupRoomEnvironment();

    // 8. Add CyberBird3D Avatar System (Dee Prime + 5 Identical Color-Coded Sub-Agents)
    this.avatar = new CyberBird3D();
    this.scene.add(this.avatar.group);

    this.subAvatarsGroup = new THREE.Group();
    this.subAvatarsGroup.visible = false;
    const subSpecs = [
      { id: 'hermes_local', color: '#ec4899', x: -2.55, z: -1.35, rotY: 0.35 },
      { id: 'barto_forge', color: '#10b981', x: -1.35, z: -2.05, rotY: 0.2 },
      { id: 'manager_scout', color: '#f59e0b', x: 0, z: -2.35, rotY: 0 },
      { id: 'sentinel_sec', color: '#f43f5e', x: 1.35, z: -2.05, rotY: -0.2 },
      { id: 'rakazo_memory', color: '#a855f7', x: 2.55, z: -1.35, rotY: -0.35 },
    ];
    subSpecs.forEach((sp) => {
      const sub = new CyberBird3D();
      sub.setAgentColorTheme(sp.color);
      sub.group.scale.set(0.58, 0.58, 0.58);
      sub.group.position.set(sp.x, -0.66, sp.z);
      sub.group.rotation.y = sp.rotY;

      // Sub-agent glowing floor ring
      const sRingGeo = new THREE.RingGeometry(0.75, 0.8, 36);
      const sRingMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(sp.color),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      });
      const sRing = new THREE.Mesh(sRingGeo, sRingMat);
      sRing.rotation.x = -Math.PI / 2;
      sRing.position.set(sp.x, -1.55, sp.z);
      this.subAvatarsGroup.add(sRing);
      this.subAvatarsGroup.add(sub.group);
      this.subAvatars.push({ id: sp.id, color: sp.color, avatar: sub });
    });
    this.scene.add(this.subAvatarsGroup);

    // 9. Event Listeners
    this.bindEvents();

    // 10. Start Loop
    this.startLoop();
  }

  private markActive() {
    this.lastActivityTime = performance.now();
  }

  private setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0x00ffff, 0x050814, 0.7);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
    keyLight.position.set(2, 4, 3);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xff00bb, 3.2);
    rimLight.position.set(-3, 2, -2.5);
    this.scene.add(rimLight);

    const frontFill = new THREE.PointLight(0x00ffff, 1.4, 8);
    frontFill.position.set(0, 0.5, 2.8);
    this.scene.add(frontFill);
  }

  private outerFloorRing: THREE.Mesh | null = null;
  private innerFloorRing: THREE.Mesh | null = null;
  private pulseFloorRing: THREE.Mesh | null = null;

  private setupRoomEnvironment() {
    // Minimalist Grok-Bot + Meta-Muse Dark Studio Floor (Character-Only Focus)
    const floorGeo = new THREE.PlaneGeometry(36, 36);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x03060d,
      roughness: 0.22,
      metalness: 0.88,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -1.62;
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = !this.isSoftwareGl;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(22, 22, 0x0ea5e9, 0x0f172a);
    grid.position.y = -1.61;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.28;
    this.scene.add(grid);

    // Sleek Grok/Muse Quantum Pedestal solely for Dee
    const pedestalGeo = new THREE.CylinderGeometry(1.35, 1.55, 0.06, 48);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x070d19,
      roughness: 0.2,
      metalness: 0.95,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.set(0, -1.6, 0);
    this.scene.add(pedestal);

    // Concentric Task-Reactive Energy Rings under Dee
    const outerRingGeo = new THREE.RingGeometry(1.42, 1.47, 64);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    this.outerFloorRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    this.outerFloorRing.rotation.x = -Math.PI / 2;
    this.outerFloorRing.position.set(0, -1.56, 0);
    this.scene.add(this.outerFloorRing);

    const innerRingGeo = new THREE.RingGeometry(1.05, 1.09, 48, 1, 0, Math.PI * 1.65);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    this.innerFloorRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    this.innerFloorRing.rotation.x = -Math.PI / 2;
    this.innerFloorRing.position.set(0, -1.555, 0);
    this.scene.add(this.innerFloorRing);

    const pulseRingGeo = new THREE.RingGeometry(1.65, 1.67, 64);
    const pulseRingMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    this.pulseFloorRing = new THREE.Mesh(pulseRingGeo, pulseRingMat);
    this.pulseFloorRing.rotation.x = -Math.PI / 2;
    this.pulseFloorRing.position.set(0, -1.565, 0);
    this.scene.add(this.pulseFloorRing);

    // Subtle floating quantum dust around Dee
    const particleGeo = new THREE.BufferGeometry();
    const count = 42;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      pos[i] = (Math.random() - 0.5) * 8;
      pos[i + 1] = Math.random() * 4 - 1.2;
      pos[i + 2] = (Math.random() - 0.5) * 6;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.038,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });
    const dust = new THREE.Points(particleGeo, particleMat);
    this.scene.add(dust);
  }

  private onVisibilityChange = () => {
    this.isDocumentHidden = document.hidden;
    if (!this.isDocumentHidden) {
      this.clock.getDelta();
      this.markActive();
    }
  };

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    const updateMouseNorm = (clientX: number, clientY: number) => {
      if (!this.container) return;
      const rect = this.container.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, ((clientX - rect.left) / rect.width) * 2 - 1));
      const y = Math.max(-1, Math.min(1, -(((clientY - rect.top) / rect.height) * 2 - 1)));
      this.mouseNorm.x = x;
      this.mouseNorm.y = y;
    };

    window.addEventListener('pointermove', (e) => {
      this.markActive();
      updateMouseNorm(e.clientX, e.clientY);

      if (this.isOrbiting) {
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        this.orbitAngles.theta += dx * 0.005;
        this.orbitAngles.phi = Math.max(-0.4, Math.min(0.6, this.orbitAngles.phi + dy * 0.005));
        this.lastPointer = { x: e.clientX, y: e.clientY };
      }
    });

    this.container.addEventListener('pointerdown', (e) => {
      this.markActive();
      if (e.button === 0) {
        this.isOrbiting = true;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        this.pointerDownPos = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('pointerup', (e) => {
      this.isOrbiting = false;
      this.markActive();

      const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (dist < 6 && this.container) {
        const rect = this.container.getBoundingClientRect();
        const pointer = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -(((e.clientY - rect.top) / rect.height) * 2 - 1)
        );
        this.raycaster.setFromCamera(pointer, this.camera);
        const intersects = this.raycaster.intersectObjects(this.avatar.interactiveMeshes, true);
        if (intersects.length > 0) {
          let hitObj: THREE.Object3D | null = intersects[0].object;
          while (hitObj && !hitObj.userData?.taskId && hitObj.parent) {
            hitObj = hitObj.parent;
          }
          if (hitObj?.userData?.taskId && this.onSelectTaskCallback) {
            this.onSelectTaskCallback(hitObj.userData.taskId);
          }
        }
      }
    });
  }

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.markActive();
  };

  private startLoop() {
    const tick = (now = performance.now()) => {
      // Adaptive FPS Governor:
      // - Document hidden -> 0 FPS (pause rendering)
      // - Speaking, non-idle action, or user moved mouse within last 6s -> 30 FPS (33ms interval)
      // - Idle for > 6s -> 8 FPS (125ms interval) to save CPU/GPU on Pentium B950
      if (this.isDocumentHidden) {
        this.frameId = window.setTimeout(() => tick(performance.now()), 500);
        return;
      }

      const isActive =
        this.lipSyncState.volume > 0.02 ||
        this.currentActionState !== 'idle' ||
        this.isOrbiting ||
        now - this.lastActivityTime < 6000;

      this.currentFpsTarget = isActive ? 30 : 8;
      const minIntervalMs = 1000 / this.currentFpsTarget;

      if (now - this.lastRenderTime < minIntervalMs) {
        this.frameId = requestAnimationFrame(tick);
        return;
      }
      this.lastRenderTime = now;

      const delta = Math.min(0.12, this.clock.getDelta());

      this.avatar.update(delta, this.mouseNorm, this.lipSyncState);
      if (this.subAvatarsGroup.visible) {
        for (let i = 0; i < this.subAvatars.length; i++) {
          this.subAvatars[i].avatar.update(delta, this.mouseNorm, {
            volume: 0,
            frequency: 0,
            viseme: 'neutral',
          });
        }
      }

      const t = this.clock.getElapsedTime();
      if (this.outerFloorRing && this.innerFloorRing && this.pulseFloorRing) {
        const outerMat = this.outerFloorRing.material as THREE.MeshBasicMaterial;
        const innerMat = this.innerFloorRing.material as THREE.MeshBasicMaterial;
        const pulseMat = this.pulseFloorRing.material as THREE.MeshBasicMaterial;

        if (this.currentActionState === 'trabajando') {
          outerMat.color.setHex(0x10b981);
          innerMat.color.setHex(0x00f0ff);
          pulseMat.color.setHex(0x34d399);
          this.innerFloorRing.rotation.z += delta * 2.4;
          const s = 1 + Math.sin(t * 7) * 0.08;
          this.pulseFloorRing.scale.set(s, s, 1);
          pulseMat.opacity = 0.65;
        } else if (this.currentActionState === 'manipular_datos') {
          outerMat.color.setHex(0xa855f7);
          innerMat.color.setHex(0x38bdf8);
          pulseMat.color.setHex(0xc084fc);
          this.innerFloorRing.rotation.z -= delta * 2.0;
          const s = 1 + Math.sin(t * 5) * 0.06;
          this.pulseFloorRing.scale.set(s, s, 1);
          pulseMat.opacity = 0.55;
        } else if (this.currentActionState === 'explicacion') {
          outerMat.color.setHex(0xf43f5e);
          innerMat.color.setHex(0xfb7185);
          pulseMat.color.setHex(0xe11d48);
          this.innerFloorRing.rotation.z += delta * 3.0;
          const s = 1 + Math.abs(Math.sin(t * 6)) * 0.1;
          this.pulseFloorRing.scale.set(s, s, 1);
          pulseMat.opacity = 0.7;
        } else if (this.currentActionState === 'celebracion_salto') {
          outerMat.color.setHex(0xf59e0b);
          innerMat.color.setHex(0x10b981);
          pulseMat.color.setHex(0xfbbf24);
          this.innerFloorRing.rotation.z += delta * 3.5;
          const s = 1 + Math.sin(t * 9) * 0.12;
          this.pulseFloorRing.scale.set(s, s, 1);
          pulseMat.opacity = 0.8;
        } else {
          outerMat.color.set(this.activeAgentColorHex);
          innerMat.color.set(this.activeAgentColorHex);
          pulseMat.color.set(this.activeAgentColorHex);
          this.innerFloorRing.rotation.z += delta * 0.55;
          const s = 1 + Math.sin(t * 2.2) * 0.03;
          this.pulseFloorRing.scale.set(s, s, 1);
          pulseMat.opacity = 0.3;
        }
      }

      const radius = 4.6;
      const camX = this.cameraPosTarget.x + Math.sin(this.orbitAngles.theta) * radius * 0.7;
      const camY = this.cameraPosTarget.y + this.orbitAngles.phi * 2.0;
      const camZ = this.cameraPosTarget.z * Math.cos(this.orbitAngles.theta);

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camX, 6, delta);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, camY, 6, delta);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, camZ, 6, delta);

      this.camera.lookAt(this.cameraTarget);

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(() => tick(performance.now()));
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || !gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 33);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, this.currentFpsTarget <= 8 ? 120 : 33);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  // ---------------- PUBLIC API ----------------
  public setOnSelectTask(cb: (taskId: string) => void) {
    this.onSelectTaskCallback = cb;
  }

  public setNodeScale(scale: number) {
    this.markActive();
    this.avatar.setNodeScale(scale);
  }

  public setOrbitRadius(radius: number) {
    this.markActive();
    this.avatar.setOrbitRadius(radius);
  }

  public setOrbitPaused(paused: boolean) {
    this.markActive();
    this.avatar.setOrbitPaused(paused);
  }

  public adjustOrbitAngle(delta: number) {
    this.markActive();
    this.avatar.adjustOrbitAngle(delta);
  }

  public setOrbitAngle(angle: number) {
    this.markActive();
    this.avatar.setOrbitAngle(angle);
  }

  public setEmotion(emotion: JarvisEmotion) {
    this.markActive();
    this.avatar.setEmotion(emotion);
  }

  public setAction(action: JarvisAction) {
    this.currentActionState = action;
    this.markActive();
    this.avatar.setAction(action);
    this.subAvatars.forEach((s) => s.avatar.setAction(action));
  }

  public setAgentColor(colorHex: string) {
    this.activeAgentColorHex = colorHex || '#00f0ff';
    this.markActive();
    this.avatar.setAgentColorTheme(this.activeAgentColorHex);
  }

  public setShowSquadFormation(show: boolean) {
    this.markActive();
    this.subAvatarsGroup.visible = show;
  }

  public triggerJump() {
    this.currentActionState = 'celebracion_salto';
    this.markActive();
    this.avatar.setAction('celebracion_salto');
  }

  public setLipSync(data: VoiceLipSyncData) {
    if (data.volume > 0.02) {
      this.markActive();
    }
    this.lipSyncState = data;
  }

  public setCameraPreset(preset: 'default' | 'closeup' | 'overview' | 'fullbody') {
    this.markActive();
    switch (preset) {
      case 'closeup':
        this.cameraPosTarget.set(0, 0.15, 3.2);
        this.cameraTarget.set(0, 0.1, 0);
        break;
      case 'overview':
        this.cameraPosTarget.set(2.2, 1.2, 5.4);
        this.cameraTarget.set(0, 0, 0);
        break;
      case 'fullbody':
        this.cameraPosTarget.set(0, 0.05, 5.0);
        this.cameraTarget.set(0, -0.15, 0);
        break;
      case 'default':
      default:
        this.cameraPosTarget.set(0, 0.15, 4.6);
        this.cameraTarget.set(0, 0.05, 0);
        break;
    }
    this.orbitAngles = { phi: 0, theta: 0 };
  }

  public resetOrbit() {
    this.markActive();
    this.orbitAngles = { phi: 0, theta: 0 };
  }

  public dispose() {
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.renderer.dispose();
  }
}

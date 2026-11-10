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

    // 8. Add CyberBird3D Avatar System
    this.avatar = new CyberBird3D();
    this.scene.add(this.avatar.group);

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

  private holoGlobe: THREE.Mesh | null = null;
  private rackLeds: THREE.Mesh[] = [];

  private setupRoomEnvironment() {
    const floorGeo = new THREE.PlaneGeometry(36, 36);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x030712,
      roughness: 0.16,
      metalness: 0.9,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -1.62;
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = !this.isSoftwareGl;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(32, 32, 0x00f0ff, 0x1e293b);
    grid.position.y = -1.61;
    this.scene.add(grid);

    const pedestalGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.08, 32);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x0b1120,
      roughness: 0.25,
      metalness: 0.92,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.set(0, -1.62, 0);
    this.scene.add(pedestal);

    const ringGeo = new THREE.TorusGeometry(1.75, 0.02, 8, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, -1.58, 0);
    this.scene.add(ring);

    const deskGroup = new THREE.Group();
    const deskSurfaceGeo = new THREE.CylinderGeometry(3.35, 3.35, 0.10, 48, 1, false, -Math.PI * 0.44, Math.PI * 0.88);
    deskSurfaceGeo.rotateY(Math.PI * 0.5);
    const deskMat = new THREE.MeshStandardMaterial({
      color: 0x070e1b,
      metalness: 0.9,
      roughness: 0.18,
    });
    const deskSurface = new THREE.Mesh(deskSurfaceGeo, deskMat);
    deskSurface.position.set(0, -0.62, 0);
    deskGroup.add(deskSurface);

    const deskOuterTrimGeo = new THREE.TorusGeometry(3.36, 0.022, 8, 48, Math.PI * 0.88);
    deskOuterTrimGeo.rotateX(Math.PI * 0.5);
    deskOuterTrimGeo.rotateZ(-Math.PI * 0.06);
    const cyanTrimMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const deskOuterTrim = new THREE.Mesh(deskOuterTrimGeo, cyanTrimMat);
    deskOuterTrim.position.set(0, -0.57, 0);
    deskGroup.add(deskOuterTrim);

    const deskInnerTrimGeo = new THREE.TorusGeometry(2.1, 0.018, 8, 48, Math.PI * 0.88);
    deskInnerTrimGeo.rotateX(Math.PI * 0.5);
    deskInnerTrimGeo.rotateZ(-Math.PI * 0.06);
    const magentaTrimMat = new THREE.MeshBasicMaterial({ color: 0xff00aa });
    const deskInnerTrim = new THREE.Mesh(deskInnerTrimGeo, magentaTrimMat);
    deskInnerTrim.position.set(0, -0.57, 0);
    deskGroup.add(deskInnerTrim);

    for (let p = -2; p <= 2; p++) {
      const pAngle = p * 0.35;
      const px = Math.cos(pAngle + Math.PI * 0.5) * 2.8;
      const pz = Math.sin(pAngle + Math.PI * 0.5) * 2.8;
      const pillarGeo = new THREE.CylinderGeometry(0.08, 0.10, 1.0, 16);
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.95 });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(px, -1.12, pz);
      deskGroup.add(pillar);
    }
    this.scene.add(deskGroup);

    const racksGroup = new THREE.Group();
    const rackPositionsX = [-4.6, -2.3, 0, 2.3, 4.6];
    const rackMat = new THREE.MeshStandardMaterial({
      color: 0x090e18,
      metalness: 0.92,
      roughness: 0.22,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.3,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.6,
    });

    rackPositionsX.forEach((rx, rIdx) => {
      const rack = new THREE.Group();
      rack.position.set(rx, 0.5, -4.8);

      const frameGeo = new THREE.BoxGeometry(1.6, 4.2, 0.85);
      const frameMesh = new THREE.Mesh(frameGeo, rackMat);
      rack.add(frameMesh);

      const glassGeo = new THREE.PlaneGeometry(1.4, 4.0);
      const glassMesh = new THREE.Mesh(glassGeo, glassMat);
      glassMesh.position.z = 0.44;
      rack.add(glassMesh);

      for (let b = 0; b < 6; b++) {
        const bladeGeo = new THREE.BoxGeometry(1.4, 0.45, 0.7);
        const bladeMesh = new THREE.Mesh(bladeGeo, new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 }));
        bladeMesh.position.set(0, -1.5 + b * 0.6, 0.05);
        rack.add(bladeMesh);

        for (let l = 0; l < 4; l++) {
          const ledGeo = new THREE.BoxGeometry(0.04, 0.04, 0.02);
          const ledColor = (rIdx + b + l) % 3 === 0 ? 0x22c55e : (rIdx + b + l) % 3 === 1 ? 0x00f0ff : 0xf59e0b;
          const ledMat = new THREE.MeshBasicMaterial({ color: ledColor, transparent: true, opacity: 0.9 });
          const ledMesh = new THREE.Mesh(ledGeo, ledMat);
          ledMesh.position.set(-0.5 + l * 0.12, -1.5 + b * 0.6, 0.42);
          rack.add(ledMesh);
          this.rackLeds.push(ledMesh);
        }
      }

      racksGroup.add(rack);
    });
    this.scene.add(racksGroup);

    const globeGeo = new THREE.IcosahedronGeometry(1.15, 2);
    const globeMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
    });
    this.holoGlobe = new THREE.Mesh(globeGeo, globeMat);
    this.holoGlobe.position.set(0, 1.8, -4.2);
    this.scene.add(this.holoGlobe);

    const globeCoreGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const globeCoreMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.4 });
    const globeCore = new THREE.Mesh(globeCoreGeo, globeCoreMat);
    this.holoGlobe.add(globeCore);

    const particleGeo = new THREE.BufferGeometry();
    const count = 60;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      pos[i] = (Math.random() - 0.5) * 14;
      pos[i + 1] = Math.random() * 5 - 1.2;
      pos[i + 2] = (Math.random() - 0.5) * 10;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.045,
      transparent: true,
      opacity: 0.6,
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

      if (this.holoGlobe) {
        this.holoGlobe.rotation.y += delta * 0.25;
      }
      const t = this.clock.getElapsedTime();
      for (let i = 0; i < this.rackLeds.length; i++) {
        (this.rackLeds[i].material as THREE.MeshBasicMaterial).opacity = Math.sin(t * 8 + i * 1.5) > 0 ? 0.95 : 0.25;
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

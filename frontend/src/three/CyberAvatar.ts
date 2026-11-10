import * as THREE from 'three';
import { JarvisAction, JarvisEmotion, VoiceLipSyncData } from '../types/jarvis';

// Reusable math helpers outside render loop
const _vec3 = new THREE.Vector3();

export class CyberAvatar {
  public group: THREE.Group;
  
  // Skeleton / Joint Groups for realistic kinematics
  private chairGroup: THREE.Group;
  private characterGroup: THREE.Group;
  private hipsGroup: THREE.Group;
  private spineGroup: THREE.Group;
  private headGroup: THREE.Group;
  private leftArmGroup: THREE.Group;
  private rightArmGroup: THREE.Group;
  private leftForearmGroup: THREE.Group;
  private rightForearmGroup: THREE.Group;
  private leftHandGroup: THREE.Group;
  private rightHandGroup: THREE.Group;
  private leftLegGroup: THREE.Group;
  private rightLegGroup: THREE.Group;
  
  // Holographic props
  private holoScreensGroup: THREE.Group;
  private holoDataGroup: THREE.Group;
  private holoGlobeGroup: THREE.Group;
  private victoryParticles: THREE.Points;
  private particlePositions!: Float32Array;

  // Face Visor Canvas & Texture
  private visorCanvas: HTMLCanvasElement;
  private visorCtx: CanvasRenderingContext2D;
  private visorTexture: THREE.CanvasTexture;
  private visorMaterial: THREE.MeshBasicMaterial;

  // States
  private currentEmotion: JarvisEmotion = 'curioso';
  private currentAction: JarvisAction = 'idle';
  private animTimer = 0;
  private jumpProgress = 0; // 0 to 1 during jump
  private isJumping = false;

  // Audio / Lip-sync smoothing
  private mouthOpen = 0;
  private eyeBlinkTimer = 0;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'JARVIS_CYBER_AVATAR_SYSTEM';

    // 1. Procedural Face Texture (LED Visor with Eyes and Lip-sync Mouth)
    this.visorCanvas = document.createElement('canvas');
    this.visorCanvas.width = 512;
    this.visorCanvas.height = 256;
    this.visorCtx = this.visorCanvas.getContext('2d')!;
    this.visorTexture = new THREE.CanvasTexture(this.visorCanvas);
    this.visorTexture.colorSpace = THREE.SRGBColorSpace;

    this.visorMaterial = new THREE.MeshBasicMaterial({
      map: this.visorTexture,
      transparent: true,
      side: THREE.DoubleSide,
    });

    // 2. Initialize Hierarchical Kinematic Groups
    this.chairGroup = new THREE.Group();
    this.characterGroup = new THREE.Group();
    this.hipsGroup = new THREE.Group();
    this.spineGroup = new THREE.Group();
    this.headGroup = new THREE.Group();
    this.leftArmGroup = new THREE.Group();
    this.rightArmGroup = new THREE.Group();
    this.leftForearmGroup = new THREE.Group();
    this.rightForearmGroup = new THREE.Group();
    this.leftHandGroup = new THREE.Group();
    this.rightHandGroup = new THREE.Group();
    this.leftLegGroup = new THREE.Group();
    this.rightLegGroup = new THREE.Group();

    this.holoScreensGroup = new THREE.Group();
    this.holoDataGroup = new THREE.Group();
    this.holoGlobeGroup = new THREE.Group();

    // 3. Build Meshes
    this.buildCyberChair();
    this.buildCharacterHierarchy();
    this.buildHolographicScreens();
    this.buildHolographicDataCube();
    this.buildHolographicGlobe();
    this.victoryParticles = this.buildVictoryParticles();

    // Assembly hierarchy
    this.group.add(this.chairGroup);
    this.group.add(this.characterGroup);
    this.group.add(this.holoScreensGroup);
    this.group.add(this.holoDataGroup);
    this.group.add(this.holoGlobeGroup);
    this.group.add(this.victoryParticles);

    // Initial facial render
    this.renderVisorTexture(0);
  }

  // -------------------------------------------------------------
  // BUILD PROCEDURAL CYBER CHAIR (Sala de Control Throne)
  // -------------------------------------------------------------
  private buildCyberChair() {
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x111622,
      roughness: 0.35,
      metalness: 0.85,
    });
    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const neonMagentaMat = new THREE.MeshBasicMaterial({ color: 0xff00aa });

    // Seat base
    const seatGeo = new THREE.BoxGeometry(1.6, 0.25, 1.4);
    const seat = new THREE.Mesh(seatGeo, darkMat);
    seat.position.set(0, 0.9, 0.1);
    this.chairGroup.add(seat);

    // Seat neon cushion border
    const cushionPiping = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.05, 1.45), neonCyanMat);
    cushionPiping.position.set(0, 0.95, 0.1);
    this.chairGroup.add(cushionPiping);

    // Backrest (high ergonomic gaming/cyber throne)
    const backGeo = new THREE.BoxGeometry(1.5, 2.2, 0.25);
    const backrest = new THREE.Mesh(backGeo, darkMat);
    backrest.position.set(0, 2.1, -0.55);
    backrest.rotation.x = 0.08;
    this.chairGroup.add(backrest);

    // Backrest wings
    const wingGeo = new THREE.BoxGeometry(0.2, 1.8, 0.4);
    const leftWing = new THREE.Mesh(wingGeo, darkMat);
    leftWing.position.set(-0.75, 2.1, -0.4);
    leftWing.rotation.y = 0.3;
    const rightWing = new THREE.Mesh(wingGeo, darkMat);
    rightWing.position.set(0.75, 2.1, -0.4);
    rightWing.rotation.y = -0.3;
    this.chairGroup.add(leftWing, rightWing);

    // Headrest with embossed "4F" cyan plate
    const headrestGeo = new THREE.BoxGeometry(1.0, 0.6, 0.3);
    const headrest = new THREE.Mesh(headrestGeo, darkMat);
    headrest.position.set(0, 3.2, -0.62);
    this.chairGroup.add(headrest);

    // "4F" logo plate on chair headrest
    const logoPlate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.02), neonCyanMat);
    logoPlate.position.set(0, 3.2, -0.46);
    this.chairGroup.add(logoPlate);

    // Armrests
    const armrestGeo = new THREE.BoxGeometry(0.2, 0.08, 1.1);
    const leftArmrest = new THREE.Mesh(armrestGeo, darkMat);
    leftArmrest.position.set(-0.85, 1.5, 0.1);
    const rightArmrest = new THREE.Mesh(armrestGeo, darkMat);
    rightArmrest.position.set(0.85, 1.5, 0.1);
    this.chairGroup.add(leftArmrest, rightArmrest);

    // Chair hydraulic pedestal base
    const baseCol = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 16), darkMat);
    baseCol.position.set(0, 0.45, 0.1);
    const baseStar = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.1, 8), darkMat);
    baseStar.position.set(0, 0.05, 0.1);
    this.chairGroup.add(baseCol, baseStar);

    // Backrest neon piping
    const leftPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.3, 8), neonCyanMat);
    leftPipe.position.set(-0.72, 2.1, -0.5);
    const rightPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.3, 8), neonMagentaMat);
    rightPipe.position.set(0.72, 2.1, -0.5);
    this.chairGroup.add(leftPipe, rightPipe);
  }

  // -------------------------------------------------------------
  // BUILD PROCEDURAL AVATAR CHARACTER (Hoodie, Cap 4F, Visor, Joints)
  // -------------------------------------------------------------
  private buildCharacterHierarchy() {
    const hoodieMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d14,
      roughness: 0.7,
      metalness: 0.15,
    });
    const tacticalPantsMat = new THREE.MeshStandardMaterial({
      color: 0x0d111a,
      roughness: 0.65,
      metalness: 0.2,
    });
    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x111622,
      roughness: 0.35,
      metalness: 0.8,
    });
    const neonMagentaMat = new THREE.MeshBasicMaterial({ color: 0xff00bb });
    const skinGloveMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.6,
    });

    // Root of character sits on chair
    this.characterGroup.position.set(0, 1.05, 0.1);

    // HIPS
    const hipsGeo = new THREE.BoxGeometry(0.9, 0.45, 0.7);
    const hipsMesh = new THREE.Mesh(hipsGeo, tacticalPantsMat);
    this.hipsGroup.add(hipsMesh);
    this.characterGroup.add(this.hipsGroup);

    // SPINE & TORSO (wearing cyber hoodie with "PULSO CURIOSO" neon graphic)
    this.spineGroup.position.set(0, 0.25, 0);
    this.hipsGroup.add(this.spineGroup);

    const chestGeo = new THREE.BoxGeometry(1.05, 1.15, 0.75);
    const chestMesh = new THREE.Mesh(chestGeo, hoodieMat);
    chestMesh.position.set(0, 0.6, 0);
    this.spineGroup.add(chestMesh);

    // Neon Chest graphic ("J" crest / "PULSO CURIOSO" triangle)
    const chestCrest = new THREE.Mesh(new THREE.BufferGeometry(), neonCyanMat);
    // Inverted triangle shape for chest
    const shape = new THREE.Shape();
    shape.moveTo(-0.2, 0.2);
    shape.lineTo(0.2, 0.2);
    shape.lineTo(0, -0.15);
    shape.closePath();
    const crestGeo = new THREE.ShapeGeometry(shape);
    const crestMesh = new THREE.Mesh(crestGeo, neonCyanMat);
    crestMesh.position.set(0, 0.75, 0.38);
    this.spineGroup.add(crestMesh);

    // Neon stripes on hoodie chest
    const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.02), neonMagentaMat);
    chestStripe.position.set(0, 0.45, 0.38);
    this.spineGroup.add(chestStripe);

    // HEAD GROUP (mounted at top of spine)
    this.headGroup.position.set(0, 1.35, 0.05);
    this.spineGroup.add(this.headGroup);

    // Hood / Cowl base
    const hoodGeo = new THREE.SphereGeometry(0.48, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.85);
    const hoodMesh = new THREE.Mesh(hoodGeo, hoodieMat);
    hoodMesh.position.set(0, 0.1, -0.05);
    this.headGroup.add(hoodMesh);

    // Cyber Cap with "4F" logo (Sheet reference 07/08)
    const capCrownGeo = new THREE.SphereGeometry(0.44, 16, 16);
    const capCrown = new THREE.Mesh(capCrownGeo, hoodieMat);
    capCrown.position.set(0, 0.2, 0);
    capCrown.scale.set(1.0, 0.85, 1.05);
    this.headGroup.add(capCrown);

    // Cap visor/brim pointing forward
    const brimGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.04, 16, 1, false, -Math.PI * 0.4, Math.PI * 0.8);
    const capBrim = new THREE.Mesh(brimGeo, hoodieMat);
    capBrim.position.set(0, 0.22, 0.28);
    capBrim.rotation.x = -0.15;
    this.headGroup.add(capBrim);

    // "4F" Badge on Cap Front Plate
    const capBadge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.04), neonCyanMat);
    capBadge.position.set(0, 0.38, 0.42);
    capBadge.rotation.x = -0.2;
    this.headGroup.add(capBadge);

    // Cyber Visor / Face Screen (Curved dynamic screen with procedural eyes & lip-sync)
    const visorGeo = new THREE.CylinderGeometry(0.42, 0.38, 0.48, 32, 1, true, -Math.PI * 0.42, Math.PI * 0.84);
    const visorMesh = new THREE.Mesh(visorGeo, this.visorMaterial);
    visorMesh.position.set(0, 0.08, 0.22);
    visorMesh.rotation.y = Math.PI; // Face outwards
    this.headGroup.add(visorMesh);

    // Tactical Mask lower chin shield
    const chinGeo = new THREE.ConeGeometry(0.36, 0.32, 5);
    const chinMesh = new THREE.Mesh(chinGeo, hoodieMat);
    chinMesh.position.set(0, -0.16, 0.22);
    chinMesh.rotation.x = -Math.PI * 0.8;
    this.headGroup.add(chinMesh);

    // Cyber Headphones (Glowing earcups on left & right of head)
    const cupGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 16);
    cupGeo.rotateZ(Math.PI / 2);
    const leftCup = new THREE.Mesh(cupGeo, darkMat);
    leftCup.position.set(-0.46, 0.1, 0);
    const rightCup = new THREE.Mesh(cupGeo, darkMat);
    rightCup.position.set(0.46, 0.1, 0);

    const leftGlowRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 8, 16), neonCyanMat);
    leftGlowRing.position.set(-0.54, 0.1, 0);
    leftGlowRing.rotation.y = Math.PI / 2;
    const rightGlowRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 8, 16), neonMagentaMat);
    rightGlowRing.position.set(0.54, 0.1, 0);
    rightGlowRing.rotation.y = Math.PI / 2;

    this.headGroup.add(leftCup, rightCup, leftGlowRing, rightGlowRing);

    // ---------------- LEFT ARM ----------------
    this.leftArmGroup.position.set(-0.62, 1.1, 0);
    this.spineGroup.add(this.leftArmGroup);

    const upperArmGeo = new THREE.CylinderGeometry(0.14, 0.12, 0.55, 12);
    upperArmGeo.translate(0, -0.27, 0);
    const leftUpperArmMesh = new THREE.Mesh(upperArmGeo, hoodieMat);
    this.leftArmGroup.add(leftUpperArmMesh);

    // Neon sleeve stripe
    const leftArmStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.125, 0.06, 12), neonCyanMat);
    leftArmStripe.position.set(0, -0.2, 0);
    this.leftArmGroup.add(leftArmStripe);

    // Forearm & Elbow
    this.leftForearmGroup.position.set(0, -0.55, 0);
    this.leftArmGroup.add(this.leftForearmGroup);

    const forearmGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.52, 12);
    forearmGeo.translate(0, -0.26, 0);
    const leftForearmMesh = new THREE.Mesh(forearmGeo, hoodieMat);
    this.leftForearmGroup.add(leftForearmMesh);

    // Hand & Tactical Glove (Palma abierta con LED)
    this.leftHandGroup.position.set(0, -0.52, 0);
    this.leftForearmGroup.add(this.leftHandGroup);

    const handGeo = new THREE.BoxGeometry(0.18, 0.22, 0.08);
    const leftHandMesh = new THREE.Mesh(handGeo, skinGloveMat);
    this.leftHandGroup.add(leftHandMesh);

    // ---------------- RIGHT ARM ----------------
    this.rightArmGroup.position.set(0.62, 1.1, 0);
    this.spineGroup.add(this.rightArmGroup);

    const rightUpperArmMesh = new THREE.Mesh(upperArmGeo, hoodieMat);
    this.rightArmGroup.add(rightUpperArmMesh);

    const rightArmStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.125, 0.06, 12), neonMagentaMat);
    rightArmStripe.position.set(0, -0.2, 0);
    this.rightArmGroup.add(rightArmStripe);

    this.rightForearmGroup.position.set(0, -0.55, 0);
    this.rightArmGroup.add(this.rightForearmGroup);

    const rightForearmMesh = new THREE.Mesh(forearmGeo, hoodieMat);
    this.rightForearmGroup.add(rightForearmMesh);

    this.rightHandGroup.position.set(0, -0.52, 0);
    this.rightForearmGroup.add(this.rightHandGroup);

    const rightHandMesh = new THREE.Mesh(handGeo, skinGloveMat);
    this.rightHandGroup.add(rightHandMesh);

    // Glowing palm LED (Sheet reference 04: "SALUDO ABIERTO")
    const palmGlow = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), neonCyanMat);
    palmGlow.position.set(0, -0.02, 0.045);
    this.rightHandGroup.add(palmGlow);

    // ---------------- LEGS ----------------
    // Sitting posture by default
    this.leftLegGroup.position.set(-0.3, 0, 0.2);
    this.hipsGroup.add(this.leftLegGroup);
    this.rightLegGroup.position.set(0.3, 0, 0.2);
    this.hipsGroup.add(this.rightLegGroup);

    const thighGeo = new THREE.CylinderGeometry(0.16, 0.14, 0.7, 12);
    thighGeo.translate(0, 0, 0.35);
    thighGeo.rotateX(Math.PI / 2); // Thigh horizontal forward
    const leftThigh = new THREE.Mesh(thighGeo, tacticalPantsMat);
    const rightThigh = new THREE.Mesh(thighGeo, tacticalPantsMat);
    this.leftLegGroup.add(leftThigh);
    this.rightLegGroup.add(rightThigh);

    const shinGeo = new THREE.CylinderGeometry(0.14, 0.12, 0.75, 12);
    shinGeo.translate(0, -0.375, 0);
    const leftShin = new THREE.Mesh(shinGeo, tacticalPantsMat);
    leftShin.position.set(0, 0, 0.7);
    const rightShin = new THREE.Mesh(shinGeo, tacticalPantsMat);
    rightShin.position.set(0, 0, 0.7);
    this.leftLegGroup.add(leftShin);
    this.rightLegGroup.add(rightShin);

    // Sneakers with neon glow soles
    const shoeGeo = new THREE.BoxGeometry(0.25, 0.18, 0.45);
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.3 });
    const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
    leftShoe.position.set(0, -0.75, 0.8);
    const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
    rightShoe.position.set(0, -0.75, 0.8);

    const leftSole = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.46), neonCyanMat);
    leftSole.position.set(0, -0.84, 0.8);
    const rightSole = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.46), neonCyanMat);
    rightSole.position.set(0, -0.84, 0.8);

    this.leftLegGroup.add(leftShoe, leftSole);
    this.rightLegGroup.add(rightShoe, rightSole);
  }

  // -------------------------------------------------------------
  // BUILD HOLOGRAPHIC SCREENS (Mode "Trabajando")
  // -------------------------------------------------------------
  private buildHolographicScreens() {
    this.holoScreensGroup.position.set(0, 2.0, 0.7);
    this.holoScreensGroup.visible = false; // Hidden until 'trabajando'

    const createScreen = (textTitle: string, colorHex: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'rgba(6, 25, 45, 0.85)';
      ctx.fillRect(0, 0, 512, 256);

      // Neon cyber borders
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 504, 248);

      // Header
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 20px "JetBrains Mono", monospace';
      ctx.fillText(textTitle, 20, 36);

      // Fake matrix code lines
      ctx.fillStyle = '#4ade80';
      ctx.font = '14px "JetBrains Mono", monospace';
      const lines = [
        '>>> JARVIS_CORE::init_cluster(nodes=5, fabric=OK)',
        '>>> thread_spawn: ollama_llama3_8b --gpu-layers 33',
        '>>> stream_eval: 98.4 token/s | latency: 12ms',
        '>>> neural_sync: face_rig_v1.1 --viseme=OPEN_A',
        '>>> status: OK [100% OPERATIVO]'
      ];
      lines.forEach((l, i) => ctx.fillText(l, 20, 75 + i * 28));

      // Grid chart
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.lineWidth = 1;
      for (let x = 320; x < 490; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, 70);
        ctx.lineTo(x, 220);
        ctx.stroke();
      }
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(320, 190);
      ctx.lineTo(360, 140);
      ctx.lineTo(410, 160);
      ctx.lineTo(450, 95);
      ctx.lineTo(490, 110);
      ctx.stroke();

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      });

      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.65), mat);
      return plane;
    };

    const screenCenter = createScreen('TERMINAL DE EJECUCIÓN // JARVIS', 0x00ffff);
    screenCenter.position.set(0, 0, 0.3);

    const screenLeft = createScreen('TELEMETRÍA DE RED & FABRIC', 0x38bdf8);
    screenLeft.position.set(-1.1, 0, 0.05);
    screenLeft.rotation.y = 0.45;

    const screenRight = createScreen('ANÁLISIS DE MODELOS IA', 0xa855f7);
    screenRight.position.set(1.1, 0, 0.05);
    screenRight.rotation.y = -0.45;

    this.holoScreensGroup.add(screenCenter, screenLeft, screenRight);
  }

  // -------------------------------------------------------------
  // BUILD HOLOGRAPHIC DATA CUBE (Mode "Manipular Datos")
  // -------------------------------------------------------------
  private buildHolographicDataCube() {
    this.holoDataGroup.position.set(0, 2.0, 0.85);
    this.holoDataGroup.visible = false;

    // Glowing rotating wireframe cube
    const cubeMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true,
    });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), cubeMat);

    // Inner glowing sphere
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xff00bb,
      wireframe: true,
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), sphereMat);

    // Orbital rings
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.015, 8, 32), ringMat);
    ring1.rotation.x = Math.PI / 3;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.015, 8, 32), ringMat);
    ring2.rotation.y = Math.PI / 4;

    this.holoDataGroup.add(cube, sphere, ring1, ring2);
  }

  // -------------------------------------------------------------
  // BUILD HOLOGRAPHIC GLOBE (Background matching Image 1)
  // -------------------------------------------------------------
  private buildHolographicGlobe() {
    this.holoGlobeGroup.position.set(2.4, 2.2, -1.0);

    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 20), wireMat);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const equatorRing = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.02, 8, 32), ringMat);
    equatorRing.rotation.x = Math.PI / 2.3;

    // Glow base
    const baseLight = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.5, 0.2, 16),
      new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.4, metalness: 0.9 })
    );
    baseLight.position.set(0, -1.0, 0);

    this.holoGlobeGroup.add(globe, equatorRing, baseLight);
  }

  // -------------------------------------------------------------
  // BUILD VICTORY PARTICLES (Burst during "Saltar de Alegría")
  // -------------------------------------------------------------
  private buildVictoryParticles(): THREE.Points {
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      this.particlePositions[i * 3 + 0] = (Math.random() - 0.5) * 2;
      this.particlePositions[i * 3 + 1] = 1 + Math.random() * 2;
      this.particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 2;

      // Cyan / Magenta / Neon green
      const r = Math.random();
      if (r < 0.33) {
        colors[i * 3] = 0; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 1; // cyan
      } else if (r < 0.66) {
        colors[i * 3] = 1; colors[i * 3 + 1] = 0; colors[i * 3 + 2] = 0.8; // magenta
      } else {
        colors[i * 3] = 0; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 0.2; // toxic green
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    particles.position.set(0, 0, 0);
    return particles;
  }

  // -------------------------------------------------------------
  // PROCEDURAL VISOR TEXTURE RENDERING (Expressions & Lip-Sync)
  // Matching the sheet: Character'ose & Exber-Avatar Model V1.1
  // -------------------------------------------------------------
  private renderVisorTexture(mouthLevel: number) {
    const ctx = this.visorCtx;
    const w = 512;
    const h = 256;

    ctx.clearRect(0, 0, w, h);

    // Dark cyber visor background with scanlines
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, w, h);

    // Subtle visor grid texture
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Determine colors based on emotion
    let eyeColor = '#00ffff';
    let eyeGlow = 'rgba(0, 255, 255, 0.8)';

    if (this.currentEmotion === 'orgullo') {
      eyeColor = '#4ade80'; // Emerald Green / Star
      eyeGlow = 'rgba(74, 222, 128, 0.9)';
    } else if (this.currentEmotion === 'combate') {
      eyeColor = '#ff00aa'; // Neon Magenta
      eyeGlow = 'rgba(255, 0, 170, 0.9)';
    } else if (this.currentEmotion === 'melancolia') {
      eyeColor = '#ec4899'; // Tears Magenta
      eyeGlow = 'rgba(236, 72, 153, 0.8)';
    } else if (this.currentEmotion === 'alivio') {
      eyeColor = '#2dd4bf'; // Gentle Teal
      eyeGlow = 'rgba(45, 212, 191, 0.8)';
    } else if (this.currentEmotion === 'desden') {
      eyeColor = '#f43f5e'; // Critical Squint
      eyeGlow = 'rgba(244, 63, 94, 0.8)';
    }

    ctx.shadowBlur = 18;
    ctx.shadowColor = eyeGlow;
    ctx.fillStyle = eyeColor;
    ctx.strokeStyle = eyeColor;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';

    const leftEyeX = 170;
    const rightEyeX = 342;
    const eyeY = 95;

    // Blink simulation
    const isBlinking = this.eyeBlinkTimer > 3.8 && this.eyeBlinkTimer < 4.0;

    if (isBlinking) {
      // Flat blink line
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 45, eyeY);
      ctx.lineTo(leftEyeX + 45, eyeY);
      ctx.moveTo(rightEyeX - 45, eyeY);
      ctx.lineTo(rightEyeX + 45, eyeY);
      ctx.stroke();
    } else {
      // Render Specific Expression from Reference Sheet
      switch (this.currentEmotion) {
        case 'orgullo': {
          // STAR EYES ⭐⭐ (Celebración / Orgullo)
          const drawStar = (cx: number, cy: number, spikes = 5, outerRadius = 38, innerRadius = 18) => {
            let rot = Math.PI / 2 * 3;
            let step = Math.PI / spikes;
            ctx.beginPath();
            ctx.moveTo(cx, cy - outerRadius);
            for (let i = 0; i < spikes; i++) {
              let x = cx + Math.cos(rot) * outerRadius;
              let y = cy + Math.sin(rot) * outerRadius;
              ctx.lineTo(x, y);
              rot += step;
              x = cx + Math.cos(rot) * innerRadius;
              y = cy + Math.sin(rot) * innerRadius;
              ctx.lineTo(x, y);
              rot += step;
            }
            ctx.lineTo(cx, cy - outerRadius);
            ctx.closePath();
            ctx.fill();
          };
          drawStar(leftEyeX, eyeY);
          drawStar(rightEyeX, eyeY);
          break;
        }

        case 'melancolia': {
          // XX EYES ✖ ✖ + Tear droplets
          const size = 32;
          // Left X
          ctx.beginPath();
          ctx.moveTo(leftEyeX - size, eyeY - size);
          ctx.lineTo(leftEyeX + size, eyeY + size);
          ctx.moveTo(leftEyeX + size, eyeY - size);
          ctx.lineTo(leftEyeX - size, eyeY + size);
          ctx.stroke();
          // Right X
          ctx.beginPath();
          ctx.moveTo(rightEyeX - size, eyeY - size);
          ctx.lineTo(rightEyeX + size, eyeY + size);
          ctx.moveTo(rightEyeX + size, eyeY - size);
          ctx.lineTo(rightEyeX - size, eyeY + size);
          ctx.stroke();

          // Tears glowing downward
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#38bdf8';
          ctx.beginPath();
          ctx.moveTo(leftEyeX, eyeY + size + 6);
          ctx.lineTo(leftEyeX, eyeY + size + 28);
          ctx.moveTo(rightEyeX, eyeY + size + 6);
          ctx.lineTo(rightEyeX, eyeY + size + 28);
          ctx.stroke();
          break;
        }

        case 'combate': {
          // FIERCE ANGLED COMBAT SLITS \ /
          ctx.lineWidth = 14;
          ctx.beginPath();
          // Left angry slant
          ctx.moveTo(leftEyeX - 50, eyeY - 20);
          ctx.lineTo(leftEyeX + 45, eyeY + 15);
          // Right angry slant
          ctx.moveTo(rightEyeX + 50, eyeY - 20);
          ctx.lineTo(rightEyeX - 45, eyeY + 15);
          ctx.stroke();
          break;
        }

        case 'desden': {
          // SKEPTICAL SQUINT (Half-closed horizontal narrow slit)
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(leftEyeX - 45, eyeY - 5);
          ctx.lineTo(leftEyeX + 45, eyeY + 5);
          ctx.moveTo(rightEyeX - 45, eyeY + 5);
          ctx.lineTo(rightEyeX + 45, eyeY - 5);
          ctx.stroke();
          break;
        }

        case 'alivio': {
          // GENTLE SMILE CURVES ◠ ◠ (Alivio profundo)
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.arc(leftEyeX, eyeY + 15, 36, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(rightEyeX, eyeY + 15, 36, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
          break;
        }

        case 'neutro': {
          // SLEEK CYBER SLIT
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.moveTo(leftEyeX - 45, eyeY);
          ctx.lineTo(leftEyeX + 45, eyeY);
          ctx.moveTo(rightEyeX - 45, eyeY);
          ctx.lineTo(rightEyeX + 45, eyeY);
          ctx.stroke();
          break;
        }

        case 'curioso':
        default: {
          // CURIOSIDAD GENUINA: Left Diamond, Right Wide Circle (or wide glowing circles!)
          ctx.beginPath();
          ctx.arc(leftEyeX, eyeY, 32, 0, Math.PI * 2);
          ctx.arc(rightEyeX, eyeY, 32, 0, Math.PI * 2);
          ctx.fill();
          // Inner pupil contrast
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#05070d';
          ctx.beginPath();
          ctx.arc(leftEyeX - 8, eyeY - 8, 10, 0, Math.PI * 2);
          ctx.arc(rightEyeX - 8, eyeY - 8, 10, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
    }

    // -----------------------------------------------------------------
    // REAL-TIME LIP-SYNC MOUTH / VISUALIZER LED ARRAY (Lower Visor)
    // Synchronized to real-time speech and phonemes!
    // -----------------------------------------------------------------
    const mouthY = 195;
    const mouthCenter = 256;
    const barCount = 13;
    const barSpacing = 16;
    const half = Math.floor(barCount / 2);

    ctx.shadowBlur = 12;
    ctx.shadowColor = eyeColor;
    ctx.fillStyle = eyeColor;

    for (let i = 0; i < barCount; i++) {
      const distFromCenter = Math.abs(i - half);
      const factor = 1 - distFromCenter / (half + 1);
      
      // Dynamic height modulated by mouthLevel (lip-sync audio volume)
      const baseHeight = 6;
      const waveMod = Math.sin(this.animTimer * 12 + i * 0.8) * 0.3 + 0.7;
      const barH = baseHeight + mouthLevel * 50 * factor * waveMod;

      const bx = mouthCenter + (i - half) * barSpacing - 4;
      const by = mouthY - barH / 2;
      ctx.fillRect(bx, by, 8, barH);
    }

    this.visorTexture.needsUpdate = true;
  }

  // -------------------------------------------------------------
  // PUBLIC CONTROLS & ANIMATION TRIGGERS
  // -------------------------------------------------------------
  public setEmotion(emotion: JarvisEmotion) {
    this.currentEmotion = emotion;
    this.renderVisorTexture(this.mouthOpen);
  }

  public setAction(action: JarvisAction) {
    this.currentAction = action;

    // Manage visibility of mode-specific props
    this.holoScreensGroup.visible = action === 'trabajando';
    this.holoDataGroup.visible = action === 'manipular_datos';

    if (action === 'celebracion_salto') {
      this.triggerJump();
    }
  }

  public triggerJump() {
    this.isJumping = true;
    this.jumpProgress = 0;
    this.setEmotion('orgullo');
  }

  // -------------------------------------------------------------
  // MAIN UPDATE / TICK (Called every frame from Render Loop)
  // -------------------------------------------------------------
  public update(delta: number, mouseNorm: { x: number; y: number }, lipSync: VoiceLipSyncData) {
    this.animTimer += delta;
    this.eyeBlinkTimer += delta;
    if (this.eyeBlinkTimer > 4.2) {
      this.eyeBlinkTimer = 0;
    }

    // Smooth mouth audio level
    this.mouthOpen = THREE.MathUtils.damp(this.mouthOpen, lipSync.volume, 14, delta);
    this.renderVisorTexture(this.mouthOpen);

    // Subtle breathing animation for torso & spine
    const breath = Math.sin(this.animTimer * 2.2) * 0.03;
    this.spineGroup.position.y = 0.25 + breath;

    // Holographic globe slow rotation
    this.holoGlobeGroup.rotation.y += delta * 0.4;

    // -------------------------------------------------------------
    // JUMP ANIMATION PHYSICS ("Saltar de Alegría / Celebración")
    // Parabolic trajectory + fist-pump victory pose
    // -------------------------------------------------------------
    if (this.isJumping) {
      this.jumpProgress += delta * 1.35; // ~0.75 second jump
      if (this.jumpProgress >= 1.0) {
        this.isJumping = false;
        this.jumpProgress = 0;
        (this.victoryParticles.material as THREE.PointsMaterial).opacity = 0;
        this.setAction('idle');
      } else {
        // Parabolic jump arc: sin(pi * progress)
        const jumpHeight = Math.sin(this.jumpProgress * Math.PI) * 1.5;
        this.characterGroup.position.y = 1.05 + jumpHeight;
        this.characterGroup.position.z = 0.1 + Math.sin(this.jumpProgress * Math.PI) * 0.4;

        // Raise right fist in air (Victory pose with "4F" visible!)
        this.rightArmGroup.rotation.x = THREE.MathUtils.damp(this.rightArmGroup.rotation.x, -Math.PI * 0.85, 12, delta);
        this.rightArmGroup.rotation.z = THREE.MathUtils.damp(this.rightArmGroup.rotation.z, -0.4, 12, delta);
        this.rightForearmGroup.rotation.x = THREE.MathUtils.damp(this.rightForearmGroup.rotation.x, -0.2, 12, delta);

        // Left arm balanced
        this.leftArmGroup.rotation.x = THREE.MathUtils.damp(this.leftArmGroup.rotation.x, 0.4, 12, delta);
        this.leftArmGroup.rotation.z = THREE.MathUtils.damp(this.leftArmGroup.rotation.z, -0.4, 12, delta);

        // Legs tuck during jump apex, extend on landing
        const tuck = Math.sin(this.jumpProgress * Math.PI) * 0.6;
        this.leftLegGroup.rotation.x = -tuck;
        this.rightLegGroup.rotation.x = -tuck;

        // Victory particles burst
        const pMat = this.victoryParticles.material as THREE.PointsMaterial;
        pMat.opacity = Math.sin(this.jumpProgress * Math.PI) * 0.9;
        this.victoryParticles.rotation.y += delta * 2;
        return;
      }
    }

    // Default ground/chair position when not jumping
    this.characterGroup.position.y = THREE.MathUtils.damp(this.characterGroup.position.y, 1.05, 8, delta);
    this.characterGroup.position.z = THREE.MathUtils.damp(this.characterGroup.position.z, 0.1, 8, delta);
    this.leftLegGroup.rotation.x = THREE.MathUtils.damp(this.leftLegGroup.rotation.x, 0, 8, delta);
    this.rightLegGroup.rotation.x = THREE.MathUtils.damp(this.rightLegGroup.rotation.x, 0, 8, delta);

    // -------------------------------------------------------------
    // KINEMATIC BEHAVIORS PER ACTION
    // -------------------------------------------------------------
    switch (this.currentAction) {
      case 'saludo': {
        // Gesto Saludo Abierto (Wave hand to Facu)
        // Right arm raises to front-shoulder height with open palm
        const wave = Math.sin(this.animTimer * 8) * 0.35;
        this.rightArmGroup.rotation.x = THREE.MathUtils.damp(this.rightArmGroup.rotation.x, -1.3, 8, delta);
        this.rightArmGroup.rotation.z = THREE.MathUtils.damp(this.rightArmGroup.rotation.z, -0.3 + wave, 12, delta);
        this.rightForearmGroup.rotation.x = THREE.MathUtils.damp(this.rightForearmGroup.rotation.x, -0.5, 8, delta);
        this.rightHandGroup.rotation.y = THREE.MathUtils.damp(this.rightHandGroup.rotation.y, 0.2, 8, delta);

        // Left arm rests gently on armrest
        this.leftArmGroup.rotation.x = THREE.MathUtils.damp(this.leftArmGroup.rotation.x, 0.1, 6, delta);
        this.leftArmGroup.rotation.z = THREE.MathUtils.damp(this.leftArmGroup.rotation.z, 0.1, 6, delta);

        // Head tilts friendly
        this.headGroup.rotation.z = THREE.MathUtils.damp(this.headGroup.rotation.z, 0.08, 6, delta);
        break;
      }

      case 'trabajando': {
        // Punto de Vista Técnico / Modo Trabajo
        // Floating screens visible; both hands hovering and typing furiously!
        const typeL = Math.sin(this.animTimer * 22) * 0.12;
        const typeR = Math.cos(this.animTimer * 24 + 0.5) * 0.12;

        this.leftArmGroup.rotation.x = THREE.MathUtils.damp(this.leftArmGroup.rotation.x, -0.85, 8, delta);
        this.leftArmGroup.rotation.z = THREE.MathUtils.damp(this.leftArmGroup.rotation.z, 0.35, 8, delta);
        this.leftForearmGroup.rotation.x = -0.7 + typeL;

        this.rightArmGroup.rotation.x = THREE.MathUtils.damp(this.rightArmGroup.rotation.x, -0.85, 8, delta);
        this.rightArmGroup.rotation.z = THREE.MathUtils.damp(this.rightArmGroup.rotation.z, -0.35, 8, delta);
        this.rightForearmGroup.rotation.x = -0.7 + typeR;

        // Head tilted slightly forward focused on screens
        this.headGroup.rotation.x = THREE.MathUtils.damp(this.headGroup.rotation.x, 0.22, 6, delta);
        this.headGroup.rotation.y = THREE.MathUtils.damp(this.headGroup.rotation.y, Math.sin(this.animTimer * 1.5) * 0.15, 6, delta);
        break;
      }

      case 'manipular_datos': {
        // Manipulación Táctica de Datos Complejos
        // Hands cradling the 3D rotating data cube and stretching streams
        this.holoDataGroup.rotation.y += delta * 0.8;
        this.holoDataGroup.rotation.x = Math.sin(this.animTimer * 1.5) * 0.2;

        const gesture = Math.sin(this.animTimer * 3) * 0.1;
        this.leftArmGroup.rotation.x = THREE.MathUtils.damp(this.leftArmGroup.rotation.x, -0.75, 8, delta);
        this.leftArmGroup.rotation.z = THREE.MathUtils.damp(this.leftArmGroup.rotation.z, 0.5 + gesture, 8, delta);
        this.leftForearmGroup.rotation.x = THREE.MathUtils.damp(this.leftForearmGroup.rotation.x, -0.5, 8, delta);

        this.rightArmGroup.rotation.x = THREE.MathUtils.damp(this.rightArmGroup.rotation.x, -0.75, 8, delta);
        this.rightArmGroup.rotation.z = THREE.MathUtils.damp(this.rightArmGroup.rotation.z, -0.5 - gesture, 8, delta);
        this.rightForearmGroup.rotation.x = THREE.MathUtils.damp(this.rightForearmGroup.rotation.x, -0.5, 8, delta);
        break;
      }

      case 'explicacion': {
        // Explicación Detallada (Dynamic conversation gesture leaning forward)
        const cadence = Math.sin(this.animTimer * 4.5);
        this.spineGroup.rotation.x = THREE.MathUtils.damp(this.spineGroup.rotation.x, 0.15, 6, delta);

        this.rightArmGroup.rotation.x = THREE.MathUtils.damp(this.rightArmGroup.rotation.x, -0.8 + cadence * 0.15, 8, delta);
        this.rightArmGroup.rotation.z = THREE.MathUtils.damp(this.rightArmGroup.rotation.z, -0.4, 8, delta);
        this.rightForearmGroup.rotation.x = THREE.MathUtils.damp(this.rightForearmGroup.rotation.x, -0.6 - cadence * 0.2, 8, delta);

        this.leftArmGroup.rotation.x = THREE.MathUtils.damp(this.leftArmGroup.rotation.x, -0.3, 6, delta);
        this.leftArmGroup.rotation.z = THREE.MathUtils.damp(this.leftArmGroup.rotation.z, 0.2, 6, delta);
        break;
      }

      case 'despedida': {
        // Modo Despedida / Standby
        const slowWave = Math.sin(this.animTimer * 3) * 0.15;
        this.rightArmGroup.rotation.x = THREE.MathUtils.damp(this.rightArmGroup.rotation.x, -0.9, 6, delta);
        this.rightArmGroup.rotation.z = THREE.MathUtils.damp(this.rightArmGroup.rotation.z, -0.2 + slowWave, 6, delta);
        this.rightForearmGroup.rotation.x = THREE.MathUtils.damp(this.rightForearmGroup.rotation.x, -0.4, 6, delta);

        this.leftArmGroup.rotation.x = THREE.MathUtils.damp(this.leftArmGroup.rotation.x, 0.05, 6, delta);
        this.headGroup.rotation.x = THREE.MathUtils.damp(this.headGroup.rotation.x, 0.12, 4, delta);
        break;
      }

      case 'idle':
      default: {
        // Relaxed natural resting pose with arm reaching forward (matching Image 1!)
        // In image 1, right hand is outstretched toward Facu, left arm relaxed
        const handBob = Math.sin(this.animTimer * 1.8) * 0.04;
        
        // Right hand reaches slightly forward as in hero image
        this.rightArmGroup.rotation.x = THREE.MathUtils.damp(this.rightArmGroup.rotation.x, -0.55 + handBob, 6, delta);
        this.rightArmGroup.rotation.z = THREE.MathUtils.damp(this.rightArmGroup.rotation.z, -0.25, 6, delta);
        this.rightForearmGroup.rotation.x = THREE.MathUtils.damp(this.rightForearmGroup.rotation.x, -0.6, 6, delta);

        // Left arm rests naturally on armrest
        this.leftArmGroup.rotation.x = THREE.MathUtils.damp(this.leftArmGroup.rotation.x, 0.1, 6, delta);
        this.leftArmGroup.rotation.z = THREE.MathUtils.damp(this.leftArmGroup.rotation.z, 0.15, 6, delta);
        this.leftForearmGroup.rotation.x = THREE.MathUtils.damp(this.leftForearmGroup.rotation.x, -0.2, 6, delta);

        // Head gently tracks pointer
        const targetHeadX = -mouseNorm.y * 0.25;
        const targetHeadY = mouseNorm.x * 0.45;
        this.headGroup.rotation.x = THREE.MathUtils.damp(this.headGroup.rotation.x, targetHeadX, 6, delta);
        this.headGroup.rotation.y = THREE.MathUtils.damp(this.headGroup.rotation.y, targetHeadY, 6, delta);
        this.headGroup.rotation.z = THREE.MathUtils.damp(this.headGroup.rotation.z, 0, 6, delta);
        this.spineGroup.rotation.x = THREE.MathUtils.damp(this.spineGroup.rotation.x, 0, 6, delta);
        break;
      }
    }
  }

  public dispose() {
    this.visorTexture.dispose();
    this.visorMaterial.dispose();
  }
}

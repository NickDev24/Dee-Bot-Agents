import * as THREE from 'three';
import { JarvisAction, JarvisEmotion, VoiceLipSyncData } from '../types/jarvis';
import { NEURAL_TASKS } from '../data/neuralTasks';

// Reusable math helpers
const _vec3 = new THREE.Vector3();

export interface NeuralNode3D {
  mesh: THREE.Group;
  halo: THREE.Mesh;
  line: THREE.Line;
  pulsePhoton: THREE.Mesh;
  taskId: string;
  baseAngle: number;
  heightOffset: number;
}

export class CyberBird3D {
  public group: THREE.Group;

  // Hierarchical kinematic groups
  public bodyGroup: THREE.Group;
  private headGroup: THREE.Group;
  private beakGroup: THREE.Group;
  private upperBeakMesh!: THREE.Mesh;
  private lowerBeakMesh!: THREE.Mesh;
  private mouthGlowMesh!: THREE.Mesh;

  // Arms, Shoulders & Hand Kinematics (Firmly Welded to Body)
  private leftArmGroup: THREE.Group;
  private rightArmGroup: THREE.Group;
  private leftWingGroup: THREE.Group;
  private rightWingGroup: THREE.Group;
  private leftFingers: THREE.Group[] = [];
  private rightFingers: THREE.Group[] = [];

  private leftHeadphoneGroup: THREE.Group;
  private rightHeadphoneGroup: THREE.Group;
  private leftEqBars: THREE.Mesh[] = [];
  private rightEqBars: THREE.Mesh[] = [];

  // Raised Cyber Eye Socket Housings (Convex, Never Clipped)
  private leftEyeHousing!: THREE.Group;
  private rightEyeHousing!: THREE.Group;
  private leftEyeMesh!: THREE.Mesh;
  private rightEyeMesh!: THREE.Mesh;
  private leftEyebrowMesh!: THREE.Mesh;
  private rightEyebrowMesh!: THREE.Mesh;

  // Cyber Snapback Cap ("4F") & Tactical Visor
  private capGroup: THREE.Group;
  private crestGroup: THREE.Group;
  private tailGroup: THREE.Group;
  private talonsGroup: THREE.Group;
  private shadowMesh!: THREE.Mesh;

  // 3D Neuronal Nodes (Orbiting Tasks)
  public neuralNodesGroup: THREE.Group;
  public neuralNodes: NeuralNode3D[] = [];
  public interactiveMeshes: THREE.Object3D[] = [];

  // Node customization controls
  private nodeScale = 1.0;
  private orbitRadius = 2.4;
  private orbitPaused = false;
  private orbitAngleOffset = 0;

  // Holographic 3D Props
  private holoScreensGroup: THREE.Group;
  private holoKeyboardMesh!: THREE.Mesh;
  private holoDataOrbGroup: THREE.Group;
  private victoryParticles!: THREE.Points;
  private particlePositions!: Float32Array;
  private particleVelocities!: Float32Array;

  // Eye Visor Canvas Textures
  private leftEyeCanvas: HTMLCanvasElement;
  private leftEyeCtx: CanvasRenderingContext2D;
  private leftEyeTexture: THREE.CanvasTexture;

  private rightEyeCanvas: HTMLCanvasElement;
  private rightEyeCtx: CanvasRenderingContext2D;
  private rightEyeTexture: THREE.CanvasTexture;

  // State
  private currentEmotion: JarvisEmotion = 'curioso';
  private currentAction: JarvisAction = 'idle';
  private animTimer = 0;
  private jumpProgress = 0;
  private isJumping = false;
  private mouthOpen = 0;
  private blinkTimer = 0;
  private isBlinking = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'DEE_CYBER_BIRD_3D';

    // 1. Initialize Eye Textures
    this.leftEyeCanvas = document.createElement('canvas');
    this.leftEyeCanvas.width = 256;
    this.leftEyeCanvas.height = 256;
    this.leftEyeCtx = this.leftEyeCanvas.getContext('2d')!;
    this.leftEyeTexture = new THREE.CanvasTexture(this.leftEyeCanvas);
    this.leftEyeTexture.colorSpace = THREE.SRGBColorSpace;

    this.rightEyeCanvas = document.createElement('canvas');
    this.rightEyeCanvas.width = 256;
    this.rightEyeCanvas.height = 256;
    this.rightEyeCtx = this.rightEyeCanvas.getContext('2d')!;
    this.rightEyeTexture = new THREE.CanvasTexture(this.rightEyeCanvas);
    this.rightEyeTexture.colorSpace = THREE.SRGBColorSpace;

    // 2. Kinematic Groups (Compact 0.72 scale)
    this.bodyGroup = new THREE.Group();
    this.bodyGroup.scale.set(0.72, 0.72, 0.72);

    this.headGroup = new THREE.Group();
    this.beakGroup = new THREE.Group();
    this.leftArmGroup = new THREE.Group();
    this.rightArmGroup = new THREE.Group();
    this.leftWingGroup = new THREE.Group();
    this.rightWingGroup = new THREE.Group();
    this.leftHeadphoneGroup = new THREE.Group();
    this.rightHeadphoneGroup = new THREE.Group();
    this.capGroup = new THREE.Group();
    this.crestGroup = new THREE.Group();
    this.tailGroup = new THREE.Group();
    this.talonsGroup = new THREE.Group();
    this.holoScreensGroup = new THREE.Group();
    this.holoDataOrbGroup = new THREE.Group();
    this.neuralNodesGroup = new THREE.Group();

    // 3. Build 3D Geometry Assemblies
    this.buildBody();
    this.buildCyberCap();
    this.buildBeak();
    this.buildEyesAndBrows();
    this.buildArmShouldersAndWings();
    this.buildHeadphones();
    this.buildCrestAndTail();
    this.buildTalons();
    this.buildContactShadow();
    this.buildHolographicTerminals();
    this.buildHolographicDataOrb();
    this.buildVictoryParticles();
    this.buildNeuralNodes();

    // Assemble Hierarchical Tree
    this.headGroup.add(this.capGroup);
    this.headGroup.add(this.beakGroup);
    this.headGroup.add(this.leftEyeHousing);
    this.headGroup.add(this.rightEyeHousing);
    this.headGroup.add(this.leftHeadphoneGroup);
    this.headGroup.add(this.rightHeadphoneGroup);
    this.headGroup.add(this.crestGroup);

    this.bodyGroup.add(this.headGroup);
    this.bodyGroup.add(this.leftArmGroup);
    this.bodyGroup.add(this.rightArmGroup);
    this.bodyGroup.add(this.tailGroup);
    this.bodyGroup.add(this.talonsGroup);

    this.group.add(this.bodyGroup);
    this.group.add(this.shadowMesh);
    this.group.add(this.holoScreensGroup);
    this.group.add(this.holoDataOrbGroup);
    this.group.add(this.victoryParticles);
    this.group.add(this.neuralNodesGroup);

    // Initial eye render
    this.updateEyeCanvas();
  }

  // =========================================================================
  // 1. 3D SPHERICAL CYBER BODY
  // =========================================================================
  private buildBody() {
    const bodyGeo = new THREE.SphereGeometry(1.15, 64, 48);
    const pos = bodyGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < 0) {
        pos.setX(i, pos.getX(i) * (1 + y * 0.05));
        pos.setZ(i, pos.getZ(i) * (1 + y * 0.05));
      }
    }
    bodyGeo.computeVertexNormals();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      metalness: 0.88,
      roughness: 0.16,
      envMapIntensity: 1.5,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.bodyGroup.add(bodyMesh);

    // Front/Belly plate
    const bellyGeo = new THREE.SphereGeometry(1.155, 32, 24, -Math.PI * 0.4, Math.PI * 0.8, Math.PI * 0.35, Math.PI * 0.45);
    const bellyMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.7,
      roughness: 0.3,
    });
    const bellyMesh = new THREE.Mesh(bellyGeo, bellyMat);
    this.bodyGroup.add(bellyMesh);

    // Neon circuit line trims
    const ringGeo = new THREE.TorusGeometry(1.155, 0.012, 8, 64);
    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const neonRing = new THREE.Mesh(ringGeo, neonCyanMat);
    neonRing.rotation.x = Math.PI * 0.28;
    neonRing.rotation.y = Math.PI * 0.12;
    this.bodyGroup.add(neonRing);

    const ringGeo2 = new THREE.TorusGeometry(1.158, 0.01, 8, 64);
    const neonMagentaMat = new THREE.MeshBasicMaterial({ color: 0xff00bb });
    const neonRing2 = new THREE.Mesh(ringGeo2, neonMagentaMat);
    neonRing2.rotation.x = -Math.PI * 0.35;
    neonRing2.rotation.y = -Math.PI * 0.18;
    this.bodyGroup.add(neonRing2);

    // Chest Emblem ("D" for DEE)
    const chestCanvas = document.createElement('canvas');
    chestCanvas.width = 128;
    chestCanvas.height = 128;
    const cCtx = chestCanvas.getContext('2d')!;
    cCtx.fillStyle = 'rgba(2, 6, 23, 0.9)';
    cCtx.beginPath();
    cCtx.roundRect(12, 12, 104, 104, 20);
    cCtx.fill();
    cCtx.strokeStyle = '#00f0ff';
    cCtx.lineWidth = 6;
    cCtx.stroke();

    cCtx.fillStyle = '#00f0ff';
    cCtx.font = '900 72px monospace';
    cCtx.textAlign = 'center';
    cCtx.textBaseline = 'middle';
    cCtx.fillText('D', 64, 66);

    const chestTex = new THREE.CanvasTexture(chestCanvas);
    chestTex.colorSpace = THREE.SRGBColorSpace;
    const chestMat = new THREE.MeshBasicMaterial({ map: chestTex, transparent: true, side: THREE.DoubleSide });
    const chestMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), chestMat);
    chestMesh.position.set(0, -0.22, 1.14);
    chestMesh.rotation.x = 0.25;
    this.bodyGroup.add(chestMesh);
  }

  // =========================================================================
  // 2. 3D TITANIUM MECHANICAL BEAK (Upper Beak + Lower Mandible for Lip-Sync)
  // =========================================================================
  private buildBeak() {
    this.beakGroup.position.set(0, -0.02, 1.05);

    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.95,
      roughness: 0.15,
      envMapIntensity: 1.8,
    });

    // Upper Beak
    const upperGeo = new THREE.ConeGeometry(0.28, 0.58, 6);
    upperGeo.rotateX(Math.PI * 0.48);
    this.upperBeakMesh = new THREE.Mesh(upperGeo, titaniumMat);
    this.upperBeakMesh.position.set(0, 0.04, 0.25);
    this.upperBeakMesh.scale.set(1.1, 0.75, 1.0);
    this.upperBeakMesh.castShadow = true;
    this.beakGroup.add(this.upperBeakMesh);

    // Cyan Neon Edge along Upper Beak Ridge
    const ridgeGeo = new THREE.BoxGeometry(0.015, 0.015, 0.52);
    const ridgeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
    ridge.position.set(0, 0.08, 0.25);
    ridge.rotation.x = -0.2;
    this.upperBeakMesh.add(ridge);

    // Lower Beak: Pivoting Mandible for Real 3D Lip-Sync
    const lowerGeo = new THREE.ConeGeometry(0.24, 0.45, 6);
    lowerGeo.rotateX(Math.PI * 0.48);
    this.lowerBeakMesh = new THREE.Mesh(lowerGeo, titaniumMat);
    this.lowerBeakMesh.position.set(0, -0.06, 0.2);
    this.lowerBeakMesh.scale.set(1.0, 0.55, 0.9);
    this.lowerBeakMesh.castShadow = true;
    this.beakGroup.add(this.lowerBeakMesh);

    // Acoustic Voice Glow inside beak cleft
    const mouthGlowGeo = new THREE.PlaneGeometry(0.18, 0.08);
    const mouthGlowMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.mouthGlowMesh = new THREE.Mesh(mouthGlowGeo, mouthGlowMat);
    this.mouthGlowMesh.position.set(0, -0.02, 0.08);
    this.beakGroup.add(this.mouthGlowMesh);
  }

  // =========================================================================
  // 3. CYBER SNAPBACK CAP ("4F") & TACTICAL BROW VISOR (From Reference Sheet)
  // =========================================================================
  private buildCyberCap() {
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x070b14,
      metalness: 0.85,
      roughness: 0.28,
    });
    const neonGreenMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

    // 1. Cap Crown / Dome (Sits firmly on head apex)
    const crownGeo = new THREE.SphereGeometry(1.10, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.44);
    const crownMesh = new THREE.Mesh(crownGeo, capMat);
    crownMesh.position.set(0, 0.45, -0.05);
    crownMesh.rotation.x = -0.15;
    this.capGroup.add(crownMesh);

    // Neon seam trim around crown base
    const crownRingGeo = new THREE.TorusGeometry(1.08, 0.016, 8, 48);
    const crownRing = new THREE.Mesh(crownRingGeo, neonGreenMat);
    crownRing.position.set(0, 0.52, -0.04);
    crownRing.rotation.x = Math.PI * 0.45;
    this.capGroup.add(crownRing);

    // 2. Cap Visor / Flat Tactical Brim (Angled forward over the brow)
    const brimGroup = new THREE.Group();
    brimGroup.position.set(0, 0.52, 0.78);
    brimGroup.rotation.x = 0.28; // Tilted slightly down to shadow the eyes

    const brimGeo = new THREE.BoxGeometry(1.26, 0.048, 0.68);
    const brimMesh = new THREE.Mesh(brimGeo, capMat);
    brimMesh.position.set(0, 0, 0.28);
    brimMesh.castShadow = true;
    brimGroup.add(brimMesh);

    // Neon Edge Trim on Visor
    const brimNeonGeo = new THREE.BoxGeometry(1.28, 0.02, 0.05);
    const brimNeon = new THREE.Mesh(brimNeonGeo, neonGreenMat);
    brimNeon.position.set(0, 0.015, 0.62);
    brimGroup.add(brimNeon);

    this.capGroup.add(brimGroup);

    // 3. Iconic "4F" Illuminated Cyber Emblem
    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width = 128;
    badgeCanvas.height = 128;
    const bCtx = badgeCanvas.getContext('2d')!;
    bCtx.fillStyle = 'rgba(7, 11, 20, 0.95)';
    bCtx.beginPath();
    bCtx.roundRect(8, 8, 112, 112, 24);
    bCtx.fill();
    bCtx.strokeStyle = '#00ff88';
    bCtx.lineWidth = 6;
    bCtx.stroke();

    bCtx.fillStyle = '#00ff88';
    bCtx.font = '900 58px monospace';
    bCtx.textAlign = 'center';
    bCtx.textBaseline = 'middle';
    bCtx.fillText('DEE', 64, 66);

    const badgeTex = new THREE.CanvasTexture(badgeCanvas);
    badgeTex.colorSpace = THREE.SRGBColorSpace;
    const badgeMat = new THREE.MeshBasicMaterial({ map: badgeTex, transparent: true });
    const badgeGeo = new THREE.PlaneGeometry(0.38, 0.38);
    const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
    badgeMesh.position.set(0, 0.82, 0.85);
    badgeMesh.rotation.x = -0.22;
    this.capGroup.add(badgeMesh);
  }

  // =========================================================================
  // 4. 3D CONVEX PROTRUDING EYE HOUSINGS & TACTICAL EYEBROWS (ZERO CLIPPING)
  // =========================================================================
  private buildEyesAndBrows() {
    const socketMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.92,
      roughness: 0.18,
    });
    const neonCyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });

    // 1. Ocular Faceplate Chassis Bridge (Firmly anchors eyes to head front)
    const faceplateGeo = new THREE.CylinderGeometry(1.18, 1.18, 0.44, 32, 1, false, -Math.PI * 0.28, Math.PI * 0.56);
    faceplateGeo.rotateY(Math.PI * 0.5);
    const faceplateMat = new THREE.MeshStandardMaterial({
      color: 0x090e1a,
      metalness: 0.9,
      roughness: 0.25,
    });
    const faceplateMesh = new THREE.Mesh(faceplateGeo, faceplateMat);
    faceplateMesh.position.set(0, 0.34, 0);
    this.headGroup.add(faceplateMesh);

    const createEyeAssembly = (isRight: boolean) => {
      const housing = new THREE.Group();
      // Position raised PROUDLY on the facial surface:
      // Distance from origin: sqrt(0.44^2 + 0.36^2 + 1.14^2) = 1.27 > 1.15 (completely clear of body)
      housing.position.set(isRight ? 0.44 : -0.44, 0.36, 1.14);
      housing.rotation.y = isRight ? 0.32 : -0.32;
      housing.rotation.x = -0.10;

      // 1. Titanium Raised Socket Cylinder (Length 0.24, projecting forward)
      const socketGeo = new THREE.CylinderGeometry(0.32, 0.35, 0.24, 32);
      socketGeo.rotateX(Math.PI * 0.5);
      const socketMesh = new THREE.Mesh(socketGeo, socketMat);
      socketMesh.castShadow = true;
      housing.add(socketMesh);

      // 2. Beveled Outer Bezel Ring (Thick titanium rim)
      const ringGeo = new THREE.TorusGeometry(0.30, 0.024, 12, 32);
      const ringMesh = new THREE.Mesh(ringGeo, neonCyan);
      ringMesh.position.z = 0.11;
      housing.add(ringMesh);

      // 3. CONVEX PROTRUDING EYE LENS (Curved 3D dome, NEVER flat)
      const lensGeo = new THREE.SphereGeometry(0.28, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
      lensGeo.scale(1.0, 1.0, 0.38); // Convex bubble pointing outward
      const lensMat = new THREE.MeshBasicMaterial({
        map: isRight ? this.rightEyeTexture : this.leftEyeTexture,
        transparent: true,
        side: THREE.DoubleSide,
      });
      const lensMesh = new THREE.Mesh(lensGeo, lensMat);
      lensMesh.position.z = 0.11; // Protrudes outward from bezel, apex at z = 0.21
      housing.add(lensMesh);

      if (isRight) this.rightEyeMesh = lensMesh;
      else this.leftEyeMesh = lensMesh;

      // 4. Tactical Angular Eyebrow mounted solidly over the socket
      const browGeo = new THREE.BoxGeometry(0.54, 0.09, 0.08);
      const browMat = new THREE.MeshStandardMaterial({
        color: 0x050914,
        metalness: 0.9,
        roughness: 0.2,
      });
      const browMesh = new THREE.Mesh(browGeo, browMat);
      browMesh.position.set(0, 0.34, 0.09);
      browMesh.rotation.z = isRight ? 0.22 : -0.22;

      const browNeonGeo = new THREE.BoxGeometry(0.54, 0.02, 0.09);
      const browNeon = new THREE.Mesh(browNeonGeo, neonCyan);
      browNeon.position.y = 0.045;
      browMesh.add(browNeon);

      housing.add(browMesh);

      if (isRight) this.rightEyebrowMesh = browMesh;
      else this.leftEyebrowMesh = browMesh;

      return housing;
    };

    this.leftEyeHousing = createEyeAssembly(false);
    this.rightEyeHousing = createEyeAssembly(true);
  }

  // =========================================================================
  // 5. 3D BALL-AND-SOCKET SHOULDERS, CONTINUOUS ARMS & ARTICULATED HANDS ("MANITOS")
  // =========================================================================
  private buildArmShouldersAndWings() {
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.95,
      roughness: 0.15,
      envMapIntensity: 1.5,
    });
    const darkArmorMat = new THREE.MeshStandardMaterial({
      color: 0x0b1120,
      metalness: 0.88,
      roughness: 0.22,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.98,
      roughness: 0.08,
    });
    const neonCyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    const createSolidConnectedArm = (isRight: boolean) => {
      // 1. Arm Root: Firmly embedded inside the torso sphere at x: ±1.02, y: 0.08, z: -0.04
      const armRoot = new THREE.Group();
      armRoot.position.set(isRight ? 1.02 : -1.02, 0.08, -0.04);

      // Heavy-duty Shoulder Armor Pauldron / Torso Flange (Clamps over torso mesh)
      const pauldronGeo = new THREE.CylinderGeometry(0.28, 0.34, 0.16, 24);
      pauldronGeo.rotateZ(isRight ? -Math.PI * 0.45 : Math.PI * 0.45);
      const pauldron = new THREE.Mesh(pauldronGeo, darkArmorMat);
      armRoot.add(pauldron);

      // Glowing Neon Flange Ring on Shoulder
      const shoulderRingGeo = new THREE.TorusGeometry(0.30, 0.024, 12, 24);
      shoulderRingGeo.rotateY(Math.PI * 0.5);
      const shoulderRing = new THREE.Mesh(shoulderRingGeo, neonCyan);
      shoulderRing.position.x = isRight ? 0.04 : -0.04;
      armRoot.add(shoulderRing);

      // Heavy Ball-and-Socket Joint Core
      const ballGeo = new THREE.SphereGeometry(0.22, 24, 24);
      const ballJoint = new THREE.Mesh(ballGeo, metalMat);
      armRoot.add(ballJoint);

      // 2. Upper Arm (Bicep / Humerus) Group
      const upperArmGroup = new THREE.Group();
      upperArmGroup.position.set(isRight ? 0.12 : -0.12, -0.16, 0);

      // Solid Upper Arm Cylinder Sleeve
      const bicepGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.38, 16);
      const bicepMesh = new THREE.Mesh(bicepGeo, darkArmorMat);
      bicepMesh.position.y = -0.10;
      upperArmGroup.add(bicepMesh);

      // Parallel Hydraulic Pistons
      for (let p = -1; p <= 1; p += 2) {
        const pistonRodGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.36, 12);
        const pistonRod = new THREE.Mesh(pistonRodGeo, chromeMat);
        pistonRod.position.set(p * 0.09, -0.10, 0.06);
        upperArmGroup.add(pistonRod);
      }

      // 3. Elbow Articulation Joint (Connecting Upper Arm directly to Forearm)
      const elbowGroup = new THREE.Group();
      elbowGroup.position.set(0, -0.32, 0);

      const elbowPivotGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.22, 16);
      elbowPivotGeo.rotateZ(Math.PI * 0.5);
      const elbowPivot = new THREE.Mesh(elbowPivotGeo, metalMat);
      elbowGroup.add(elbowPivot);

      const elbowNeonGeo = new THREE.TorusGeometry(0.132, 0.015, 8, 24);
      elbowNeonGeo.rotateY(Math.PI * 0.5);
      const elbowNeon = new THREE.Mesh(elbowNeonGeo, neonCyan);
      elbowGroup.add(elbowNeon);

      // 4. Forearm (Radius & Ulna) Group
      const forearmGroup = new THREE.Group();
      forearmGroup.position.set(0, -0.06, 0);

      const forearmGeo = new THREE.CylinderGeometry(0.13, 0.10, 0.38, 16);
      const forearmMesh = new THREE.Mesh(forearmGeo, darkArmorMat);
      forearmMesh.position.y = -0.18;
      forearmGroup.add(forearmMesh);

      // Forearm Neon Data Conduit
      const conduitGeo = new THREE.BoxGeometry(0.02, 0.32, 0.03);
      const conduit = new THREE.Mesh(conduitGeo, neonCyan);
      conduit.position.set(0, -0.18, 0.11);
      forearmGroup.add(conduit);

      // 5. Tactical Cyber Wing Blade (Integrated seamlessly onto Forearm Outer Edge)
      const wingGroup = new THREE.Group();
      wingGroup.position.set(isRight ? 0.16 : -0.16, -0.15, 0);

      const bladeGeo = new THREE.BoxGeometry(0.65, 0.22, 0.06);
      const blade = new THREE.Mesh(bladeGeo, darkArmorMat);
      blade.position.set(isRight ? 0.26 : -0.26, 0, 0);
      blade.rotation.z = isRight ? -0.22 : 0.22;
      wingGroup.add(blade);

      // 3 Outer Feather Blades with neon edges
      for (let i = 0; i < 3; i++) {
        const featherGeo = new THREE.ConeGeometry(0.09, 0.48 + i * 0.12, 4);
        featherGeo.rotateZ(isRight ? -Math.PI * 0.45 - i * 0.15 : Math.PI * 0.45 + i * 0.15);
        const feather = new THREE.Mesh(featherGeo, darkArmorMat);
        feather.position.set(isRight ? 0.48 + i * 0.1 : -0.48 - i * 0.1, -0.08 - i * 0.1, 0.02 * i);
        wingGroup.add(feather);

        const tipNeonGeo = new THREE.SphereGeometry(0.022, 8, 8);
        const tipNeon = new THREE.Mesh(tipNeonGeo, neonCyan);
        tipNeon.position.set(isRight ? 0.68 + i * 0.12 : -0.68 - i * 0.12, -0.12 - i * 0.15, 0);
        wingGroup.add(tipNeon);
      }
      forearmGroup.add(wingGroup);

      // 6. Solid Wrist Cuff & Articulated Hand ("Manito")
      const wristGroup = new THREE.Group();
      wristGroup.position.set(0, -0.38, 0);

      // Titanium Wrist Ring
      const wristGeo = new THREE.CylinderGeometry(0.10, 0.09, 0.08, 16);
      const wrist = new THREE.Mesh(wristGeo, metalMat);
      wristGroup.add(wrist);

      const wristNeonGeo = new THREE.TorusGeometry(0.095, 0.012, 8, 24);
      wristNeonGeo.rotateX(Math.PI * 0.5);
      const wristNeon = new THREE.Mesh(wristNeonGeo, neonCyan);
      wristGroup.add(wristNeon);

      // Hand Palm Chassis
      const palmGroup = new THREE.Group();
      palmGroup.position.set(0, -0.08, 0.02);

      const palmGeo = new THREE.BoxGeometry(0.16, 0.14, 0.07);
      const palmMesh = new THREE.Mesh(palmGeo, darkArmorMat);
      palmGroup.add(palmMesh);

      // Palm Center Cybernetic Emitter
      const palmLedGeo = new THREE.CircleGeometry(0.035, 16);
      const palmLed = new THREE.Mesh(palmLedGeo, neonCyan);
      palmLed.position.set(0, 0, 0.036);
      palmGroup.add(palmLed);

      // 4 Articulated Fingers (Opposable Thumb + Index + Middle + Pinky)
      const fingerList: THREE.Group[] = [];

      // Thumb (Angled inward)
      const thumbGroup = new THREE.Group();
      thumbGroup.position.set(isRight ? -0.08 : 0.08, -0.02, 0.03);
      thumbGroup.rotation.z = isRight ? 0.45 : -0.45;
      thumbGroup.rotation.y = isRight ? -0.35 : 0.35;

      const thumbSeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.035), metalMat);
      thumbSeg1.position.y = -0.04;
      thumbGroup.add(thumbSeg1);

      const thumbSeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.03), darkArmorMat);
      thumbSeg2.position.y = -0.10;
      thumbGroup.add(thumbSeg2);

      const thumbTip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), neonCyan);
      thumbTip.position.y = -0.14;
      thumbGroup.add(thumbTip);

      palmGroup.add(thumbGroup);
      fingerList.push(thumbGroup);

      // 3 Main Fingers (Index, Middle, Pinky)
      const fingerXPositions = isRight ? [-0.04, 0.01, 0.06] : [0.04, -0.01, -0.06];
      const fingerLengths = [0.15, 0.17, 0.14];

      for (let f = 0; f < 3; f++) {
        const fingerGroup = new THREE.Group();
        fingerGroup.position.set(fingerXPositions[f], -0.07, 0);

        // Knuckle 1
        const k1 = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), metalMat);
        fingerGroup.add(k1);

        // Proximal Phalanx
        const pLen = fingerLengths[f] * 0.55;
        const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.038, pLen, 0.035), metalMat);
        p1.position.y = -pLen * 0.5;
        fingerGroup.add(p1);

        // Knuckle 2
        const k2 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), metalMat);
        k2.position.y = -pLen;
        fingerGroup.add(k2);

        // Distal Phalanx
        const dLen = fingerLengths[f] * 0.45;
        const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.032, dLen, 0.03), darkArmorMat);
        p2.position.y = -pLen - dLen * 0.5;
        fingerGroup.add(p2);

        // Neon Glowing Fingertip
        const fTip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), neonCyan);
        fTip.position.y = -pLen - dLen;
        fingerGroup.add(fTip);

        palmGroup.add(fingerGroup);
        fingerList.push(fingerGroup);
      }

      wristGroup.add(palmGroup);
      forearmGroup.add(wristGroup);
      elbowGroup.add(forearmGroup);
      upperArmGroup.add(elbowGroup);
      armRoot.add(upperArmGroup);

      return { armRoot, wingGroup, fingerList };
    };

    const left = createSolidConnectedArm(false);
    this.leftArmGroup = left.armRoot;
    this.leftWingGroup = left.wingGroup;
    this.leftFingers = left.fingerList;
    this.leftArmGroup.rotation.y = 0.22;

    const right = createSolidConnectedArm(true);
    this.rightArmGroup = right.armRoot;
    this.rightWingGroup = right.wingGroup;
    this.rightFingers = right.fingerList;
    this.rightArmGroup.rotation.y = -0.22;
  }

  // =========================================================================
  // 5. 3D PILOT HEADPHONES & EQUALIZER BARS
  // =========================================================================
  private buildHeadphones() {
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.92,
      roughness: 0.15,
    });
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0x020617,
      roughness: 0.8,
    });

    const bandGeo = new THREE.TorusGeometry(1.22, 0.06, 12, 48, Math.PI);
    bandGeo.rotateZ(Math.PI);
    const bandMesh = new THREE.Mesh(bandGeo, metalMat);
    bandMesh.position.set(0, 0.28, -0.08);
    this.headGroup.add(bandMesh);

    const cupGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.2, 24);
    cupGeo.rotateZ(Math.PI * 0.5);

    const leftCup = new THREE.Mesh(cupGeo, metalMat);
    const leftCushion = new THREE.Mesh(cupGeo, cushionMat);
    leftCushion.scale.set(0.95, 0.95, 0.95);
    leftCushion.position.x = 0.04;
    this.leftHeadphoneGroup.add(leftCup);
    this.leftHeadphoneGroup.add(leftCushion);
    this.leftHeadphoneGroup.position.set(-1.24, 0.26, -0.04);

    const rightCup = new THREE.Mesh(cupGeo, metalMat);
    const rightCushion = new THREE.Mesh(cupGeo, cushionMat);
    rightCushion.scale.set(0.95, 0.95, 0.95);
    rightCushion.position.x = -0.04;
    this.rightHeadphoneGroup.add(rightCup);
    this.rightHeadphoneGroup.add(rightCushion);
    this.rightHeadphoneGroup.position.set(1.24, 0.26, -0.04);

    const eqMatCyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const eqMatYellow = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const eqMatRed = new THREE.MeshBasicMaterial({ color: 0xf43f5e });

    for (let i = 0; i < 5; i++) {
      const barGeo = new THREE.BoxGeometry(0.025, 0.12, 0.018);
      const mat = i === 4 ? eqMatRed : i === 3 ? eqMatYellow : eqMatCyan;

      const lBar = new THREE.Mesh(barGeo, mat);
      lBar.position.set(-0.11, (i - 2) * 0.05, 0);
      this.leftHeadphoneGroup.add(lBar);
      this.leftEqBars.push(lBar);

      const rBar = new THREE.Mesh(barGeo, mat);
      rBar.position.set(0.11, (i - 2) * 0.05, 0);
      this.rightHeadphoneGroup.add(rBar);
      this.rightEqBars.push(rBar);
    }
  }

  // =========================================================================
  // 6. TOP CREST & TAIL
  // =========================================================================
  private buildCrestAndTail() {
    const crestMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      metalness: 0.9,
      roughness: 0.2,
    });
    const neonCyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    for (let i = 0; i < 3; i++) {
      const geo = new THREE.ConeGeometry(0.1 - i * 0.015, 0.55 - i * 0.08, 4);
      geo.rotateX(-0.4 - i * 0.15);
      const mesh = new THREE.Mesh(geo, crestMat);
      mesh.position.set(0, 1.15 + i * 0.06, -0.12 - i * 0.16);
      this.crestGroup.add(mesh);

      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), neonCyan);
      tip.position.set(0, 1.4 + i * 0.06, -0.28 - i * 0.16);
      this.crestGroup.add(tip);
    }

    for (let i = 0; i < 4; i++) {
      const tailGeo = new THREE.BoxGeometry(0.12, 0.45, 0.035);
      const tailMesh = new THREE.Mesh(tailGeo, crestMat);
      tailMesh.position.set((i - 1.5) * 0.14, -0.75, -1.05);
      tailMesh.rotation.x = 0.65 + Math.abs(i - 1.5) * 0.1;
      this.tailGroup.add(tailMesh);
    }
  }

  // =========================================================================
  // 7. TALONS & CONTACT SHADOW
  // =========================================================================
  private buildTalons() {
    const clawMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.95,
      roughness: 0.15,
    });

    const createFoot = (xOffset: number) => {
      const foot = new THREE.Group();
      foot.position.set(xOffset, -1.15, 0.12);

      for (let i = -1; i <= 1; i++) {
        const clawGeo = new THREE.ConeGeometry(0.05, 0.24, 4);
        clawGeo.rotateX(Math.PI * 0.4);
        clawGeo.rotateY(i * 0.35);
        const claw = new THREE.Mesh(clawGeo, clawMat);
        claw.position.set(i * 0.1, -0.06, 0.12);
        foot.add(claw);
      }

      const backClawGeo = new THREE.ConeGeometry(0.05, 0.18, 4);
      backClawGeo.rotateX(-Math.PI * 0.4);
      const backClaw = new THREE.Mesh(backClawGeo, clawMat);
      backClaw.position.set(0, -0.05, -0.1);
      foot.add(backClaw);

      return foot;
    };

    this.talonsGroup.add(createFoot(-0.38));
    this.talonsGroup.add(createFoot(0.38));
  }

  private buildContactShadow() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    grad.addColorStop(0.5, 'rgba(0, 240, 255, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const shadowTex = new THREE.CanvasTexture(canvas);
    const shadowGeo = new THREE.PlaneGeometry(2.6, 2.6);
    shadowGeo.rotateX(-Math.PI * 0.5);

    this.shadowMesh = new THREE.Mesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.65,
      })
    );
    this.shadowMesh.position.y = -1.6;
  }

  // =========================================================================
  // 8. 3D LABORATORY COMPUTERS / NEURAL WORKSTATIONS (Each Computer is a Task Node)
  // =========================================================================
  private createComputerScreenTexture(task: (typeof NEURAL_TASKS)[0], idx: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 320;
    const ctx = canvas.getContext('2d')!;

    // Screen Background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, 512, 320);

    // Subtle scanlines
    ctx.fillStyle = 'rgba(0, 240, 255, 0.03)';
    for (let y = 0; y < 320; y += 4) {
      ctx.fillRect(0, y, 512, 2);
    }

    // Top Title Bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 36);
    ctx.strokeStyle = task.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 36);
    ctx.lineTo(512, 36);
    ctx.stroke();

    // Window controls
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(16, 18, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.arc(32, 18, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#10b981';
    ctx.beginPath(); ctx.arc(48, 18, 5, 0, Math.PI * 2); ctx.fill();

    // Title text
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`DEE OS // NODO-0${idx + 1}: ${task.badge}`, 68, 22);

    ctx.fillStyle = task.color;
    ctx.font = 'bold 11px monospace';
    ctx.fillText('● ONLINE', 440, 22);

    // Screen Content based on category
    ctx.font = '12px monospace';
    if (task.category === 'browser') {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(14, 46, 484, 26, 6);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('🔒 https://chromium.internal/scraper/live-feed', 24, 63);

      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('LEADS CAPTURADOS: 42 PERFILES CALIFICADOS', 20, 105);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px monospace';
      ctx.fillText('> Presupuesto validado: > $2,500 USD por lead', 20, 130);
      ctx.fillText('> Plataformas: Twitter/X · LinkedIn Tech · GitHub', 20, 150);
      ctx.fillText('> Sentimiento: 92% Receptivo · Pipeline Activo', 20, 170);

      // Graph bars
      for (let b = 0; b < 16; b++) {
        const barH = 20 + Math.sin(b * 0.8) * 35 + ((b * 7) % 25);
        ctx.fillStyle = b % 2 === 0 ? '#00f0ff' : '#22c55e';
        ctx.fillRect(20 + b * 28, 265 - barH, 20, barH);
      }
    } else if (task.category === 'terminal') {
      ctx.fillStyle = '#ec4899';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('bash - dee-agent@sandbox-cluster:~#', 20, 60);

      ctx.fillStyle = '#f1f5f9';
      ctx.font = '11px monospace';
      ctx.fillText('$ hermes-agent --autonomous-cycle --target=x64', 20, 85);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('• packaging platform=linux arch=x64 [100%]', 20, 105);
      ctx.fillText('• bundle size: 48.2 MB (-34% optimizado Three.js)', 20, 125);
      ctx.fillStyle = '#4ade80';
      ctx.fillText('✓ Compilation status: 0 errors, 0 warnings (3.2ms)', 20, 145);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('✓ Ollama Local Bridge: CONNECTED port 11434', 20, 165);

      // Memory & CPU bar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(20, 200, 470, 22);
      ctx.fillStyle = '#ec4899';
      ctx.fillRect(20, 200, 260, 22);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('CPU: 11.8% · RAM: 512MB / 16GB · SANDBOX SECCOMP OK', 28, 215);
    } else if (task.category === 'editor') {
      ctx.fillStyle = '#a855f7';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('src/three/CyberBird3D.ts · TypeScript AST Diff', 20, 60);

      ctx.fillStyle = '#64748b';
      ctx.font = '11px monospace';
      ctx.fillText('104  export function dispatchAutonomousCycle(node: NeuralNode) {', 20, 85);
      ctx.fillStyle = '#4ade80';
      ctx.fillText('105+   const t0 = performance.now();', 20, 105);
      ctx.fillText('106+   const isValid = verifySafeAST(node.ast);', 20, 125);
      ctx.fillText('107+   return isValid ? executeSandboxed(node) : fallback();', 20, 145);
      ctx.fillStyle = '#64748b';
      ctx.fillText('108  }', 20, 165);

      ctx.fillStyle = '#00f0ff';
      ctx.fillText('✓ TypeScript Strict Mode: 0 Type Errors', 20, 200);
      ctx.fillText('✓ Clean Architecture: Decoupled WebGL & Zero GC', 20, 220);
    } else if (task.category === 'database') {
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('RAKAZO VECTOR MEMORY // HNSW HIGH-DIMENSIONAL GRAPH', 20, 60);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '11px monospace';
      ctx.fillText('> Vectores indexados: 1,420,000 en memoria RAM', 20, 85);
      ctx.fillText('> Latencia de búsqueda: 2.1ms (Cosine Similarity)', 20, 105);
      ctx.fillText('> Caché de contexto: 98% hit-rate persistente', 20, 125);

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const cx = 90 + (i % 4) * 95;
        const cy = 185 + Math.floor(i / 4) * 45;
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`C-${i + 1}`, cx - 8, cy + 4);
      }
    } else if (task.category === 'communication') {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('NEGOCIACIÓN CON CLIENTES // CHAT EN VIVO', 20, 60);

      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(20, 78, 360, 36, 8);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Martín (Cliente Tech): ¿Tiempos de entrega para MVP?', 30, 100);

      ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
      ctx.strokeStyle = '#fbbf24';
      ctx.beginPath();
      ctx.roundRect(60, 122, 430, 44, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.fillText('Dee: En 48hs hábiles te dejamos el runtime con Ollama', 70, 140);
      ctx.fillText('local y cero costos de nube. ¿Preparo el SLA?', 70, 158);

      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('★ Probabilidad de cierre de contrato: 94% [ALTA]', 20, 210);
    } else {
      ctx.fillStyle = '#8b5cf6';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('GESTOR DE ARCHIVOS & VERSIONADO GIT', 20, 60);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px monospace';
      ctx.fillText('📁 /root/projects/dee-hybrid-mascot/', 20, 85);
      ctx.fillText('├── 📁 src/three/CyberBird3D.ts (48KB)', 35, 105);
      ctx.fillText('├── 📁 src/components/views/LiveTaskInspectorModal.tsx', 35, 125);
      ctx.fillText('├── 📁 src/services/voiceEngine.ts (Spanish + LipSync)', 35, 145);
      ctx.fillText('└── 📄 package.json [Branch: main* synced]', 35, 165);

      ctx.fillStyle = '#a78bfa';
      ctx.fillText('✓ SHA256 Checksum verificado · Backup automático OK', 20, 210);
    }

    // Bottom action hint
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.fillRect(0, 275, 512, 45);
    ctx.fillStyle = task.color;
    ctx.font = 'bold 11px monospace';
    ctx.fillText('⚡ HAZ CLIC PARA ABRIR EL INSPECTOR DE ESTA COMPUTADORA', 50, 302);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildNeuralNodes() {
    const nodeCount = NEURAL_TASKS.length;

    NEURAL_TASKS.forEach((task, idx) => {
      const angle = (idx / nodeCount) * Math.PI * 2;
      const workstation = new THREE.Group();
      workstation.userData = { taskId: task.id, isNode: true };

      // 1. Desk Console Module (Under the computer)
      const deskGeo = new THREE.BoxGeometry(1.02, 0.08, 0.62);
      const deskMat = new THREE.MeshStandardMaterial({
        color: 0x070d18,
        metalness: 0.88,
        roughness: 0.2,
      });
      const deskMesh = new THREE.Mesh(deskGeo, deskMat);
      deskMesh.position.set(0, -0.56, 0);
      deskMesh.userData = { taskId: task.id, isNode: true };
      workstation.add(deskMesh);
      this.interactiveMeshes.push(deskMesh);

      // Glowing desk edge strip
      const deskTrimGeo = new THREE.BoxGeometry(1.04, 0.02, 0.04);
      const deskTrimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(task.color) });
      const deskTrim = new THREE.Mesh(deskTrimGeo, deskTrimMat);
      deskTrim.position.set(0, -0.52, 0.31);
      workstation.add(deskTrim);

      // Support pylon to floor
      const pylonGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.0, 16);
      const pylonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.95, roughness: 0.15 });
      const pylon = new THREE.Mesh(pylonGeo, pylonMat);
      pylon.position.set(0, -1.08, 0);
      workstation.add(pylon);

      // 2. Articulated Monitor Stand
      const standBaseGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.03, 16);
      const standBase = new THREE.Mesh(standBaseGeo, pylonMat);
      standBase.position.set(0, -0.51, -0.1);
      workstation.add(standBase);

      const standArmGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.38, 12);
      const standArm = new THREE.Mesh(standArmGeo, pylonMat);
      standArm.position.set(0, -0.32, -0.1);
      workstation.add(standArm);

      // 3. Monitor Chassis (Titanium Bevel)
      const monitorChassisGeo = new THREE.BoxGeometry(0.86, 0.54, 0.04);
      const monitorMat = new THREE.MeshStandardMaterial({
        color: 0x0b1120,
        metalness: 0.92,
        roughness: 0.18,
      });
      const monitorChassis = new THREE.Mesh(monitorChassisGeo, monitorMat);
      monitorChassis.position.set(0, -0.12, -0.06);
      monitorChassis.userData = { taskId: task.id, isNode: true };
      workstation.add(monitorChassis);
      this.interactiveMeshes.push(monitorChassis);

      // Glowing Task Bezel Rim
      const bezelRimGeo = new THREE.BoxGeometry(0.88, 0.015, 0.05);
      const bezelRim = new THREE.Mesh(bezelRimGeo, deskTrimMat);
      bezelRim.position.set(0, 0.15, -0.06);
      workstation.add(bezelRim);

      // 4. Live Computer Screen (Procedural Canvas)
      const screenTex = this.createComputerScreenTexture(task, idx);
      const screenGeo = new THREE.PlaneGeometry(0.82, 0.50);
      const screenMat = new THREE.MeshBasicMaterial({
        map: screenTex,
        side: THREE.FrontSide,
      });
      const screenMesh = new THREE.Mesh(screenGeo, screenMat);
      screenMesh.position.set(0, -0.12, -0.038);
      screenMesh.userData = { taskId: task.id, isNode: true };
      workstation.add(screenMesh);
      this.interactiveMeshes.push(screenMesh);

      // 5. Desktop Cyber Keyboard & Laser Mouse Pad
      const kbGeo = new THREE.BoxGeometry(0.50, 0.018, 0.20);
      const kbMat = new THREE.MeshStandardMaterial({
        color: 0x050914,
        metalness: 0.8,
        roughness: 0.3,
      });
      const kbMesh = new THREE.Mesh(kbGeo, kbMat);
      kbMesh.position.set(0, -0.51, 0.12);
      kbMesh.rotation.x = -0.1;
      kbMesh.userData = { taskId: task.id, isNode: true };
      workstation.add(kbMesh);
      this.interactiveMeshes.push(kbMesh);

      // Glowing Keys Grid on Keyboard
      const keysGeo = new THREE.PlaneGeometry(0.46, 0.16);
      keysGeo.rotateX(-Math.PI * 0.5);
      const keysMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(task.color),
        wireframe: true,
        transparent: true,
        opacity: 0.6,
      });
      const keysMesh = new THREE.Mesh(keysGeo, keysMat);
      keysMesh.position.set(0, -0.495, 0.12);
      keysMesh.rotation.x = -0.1;
      workstation.add(keysMesh);

      // 6. Auxiliary Vertical Tower / Coolant Cylinder
      const towerGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.42, 16);
      const coolantMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(task.color),
        transparent: true,
        opacity: 0.85,
      });
      const coolantTower = new THREE.Mesh(towerGeo, coolantMat);
      coolantTower.position.set(0.52, -0.32, -0.05);
      workstation.add(coolantTower);

      // 7. Floating 3D Badge Sprite
      const spriteCanvas = document.createElement('canvas');
      spriteCanvas.width = 160;
      spriteCanvas.height = 64;
      const sCtx = spriteCanvas.getContext('2d')!;
      sCtx.fillStyle = 'rgba(2, 6, 23, 0.9)';
      sCtx.strokeStyle = task.color;
      sCtx.lineWidth = 3;
      sCtx.beginPath();
      sCtx.roundRect(4, 4, 152, 56, 12);
      sCtx.fill();
      sCtx.stroke();
      sCtx.fillStyle = '#ffffff';
      sCtx.font = '22px sans-serif';
      sCtx.fillText(task.icon, 12, 40);
      sCtx.fillStyle = task.color;
      sCtx.font = 'bold 12px monospace';
      sCtx.fillText(task.badge.split(' ')[0], 48, 38);

      const spriteTex = new THREE.CanvasTexture(spriteCanvas);
      spriteTex.colorSpace = THREE.SRGBColorSpace;
      const spriteMat = new THREE.SpriteMaterial({ map: spriteTex, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(0.44, 0.20, 1);
      sprite.position.set(0, 0.24, -0.06);
      sprite.userData = { taskId: task.id, isNode: true };
      workstation.add(sprite);

      this.neuralNodesGroup.add(workstation);

      // 8. Glowing Neural Filament Line (Connecting Dee to the computer)
      const lineCurvePoints = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.cos(angle) * 1.0, -0.25, Math.sin(angle) * 1.0),
        new THREE.Vector3(Math.cos(angle) * 2.4, -0.45, Math.sin(angle) * 2.4),
      ];
      const curve = new THREE.CatmullRomCurve3(lineCurvePoints);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));
      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(task.color),
        transparent: true,
        opacity: 0.6,
      });
      const filamentLine = new THREE.Line(lineGeo, lineMat);
      this.neuralNodesGroup.add(filamentLine);

      // 9. Moving Pulse Photon
      const photonGeo = new THREE.SphereGeometry(0.045, 8, 8);
      const photonMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pulsePhoton = new THREE.Mesh(photonGeo, photonMat);
      this.neuralNodesGroup.add(pulsePhoton);

      this.neuralNodes.push({
        mesh: workstation,
        halo: monitorChassis,
        line: filamentLine,
        pulsePhoton,
        taskId: task.id,
        baseAngle: angle,
        heightOffset: -0.05,
      });
    });

    // Keep 3D scene focused EXCLUSIVELY on Dee by default (Grok-Bot / Meta-Muse clean aesthetic)
    this.neuralNodesGroup.visible = false;
  }

  // =========================================================================
  // 9. HOLOGRAPHIC TERMINALS & DATA PROPS
  // =========================================================================
  private buildHolographicTerminals() {
    this.holoScreensGroup.visible = false;

    // Holographic Laser Keyboard under Dee's hands
    const kbGeo = new THREE.PlaneGeometry(1.5, 0.55, 12, 4);
    kbGeo.rotateX(-Math.PI * 0.35);
    const kbMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
    });
    this.holoKeyboardMesh = new THREE.Mesh(kbGeo, kbMat);
    this.holoKeyboardMesh.position.set(0, -0.45, 0.92);
    this.holoScreensGroup.add(this.holoKeyboardMesh);

    // Floating Holographic Code Projection Arc in front of Dee when executing tasks
    const screenGeo = new THREE.PlaneGeometry(1.35, 0.58);
    const screenMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      wireframe: true,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
    });
    const holoScreen = new THREE.Mesh(screenGeo, screenMat);
    holoScreen.position.set(0, 0.08, 1.05);
    this.holoScreensGroup.add(holoScreen);
  }

  private buildHolographicDataOrb() {
    this.holoDataOrbGroup.visible = false;
    this.holoDataOrbGroup.position.set(0, -0.15, 1.25);

    const outerGeo = new THREE.IcosahedronGeometry(0.45, 1);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    this.holoDataOrbGroup.add(outerMesh);

    const innerGeo = new THREE.DodecahedronGeometry(0.24, 0);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xff00aa,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    this.holoDataOrbGroup.add(innerMesh);
  }

  private buildVictoryParticles() {
    const particleCount = 120;
    const geo = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(particleCount * 3);
    this.particleVelocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      this.resetParticle(i);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xfbbf24,
      size: 0.1,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    this.victoryParticles = new THREE.Points(geo, mat);
  }

  private resetParticle(idx: number) {
    const i3 = idx * 3;
    this.particlePositions[i3] = (Math.random() - 0.5) * 0.3;
    this.particlePositions[i3 + 1] = 0;
    this.particlePositions[i3 + 2] = (Math.random() - 0.5) * 0.3;

    const angle = Math.random() * Math.PI * 2;
    const speed = 1.6 + Math.random() * 2.2;
    this.particleVelocities[i3] = Math.cos(angle) * speed;
    this.particleVelocities[i3 + 1] = 2.0 + Math.random() * 2.5;
    this.particleVelocities[i3 + 2] = Math.sin(angle) * speed;
  }

  // =========================================================================
  // PROCEDURAL EYE HUD TEXTURE RENDERER
  // =========================================================================
  private updateEyeCanvas(lookX = 0, lookY = 0) {
    [
      { ctx: this.leftEyeCtx, tex: this.leftEyeTexture, isLeft: true },
      { ctx: this.rightEyeCtx, tex: this.rightEyeTexture, isLeft: false },
    ].forEach(({ ctx, tex, isLeft }) => {
      ctx.clearRect(0, 0, 256, 256);

      ctx.fillStyle = '#030712';
      ctx.beginPath();
      ctx.arc(128, 128, 120, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.lineWidth = 2;
      for (let r = 30; r < 120; r += 24) {
        ctx.beginPath();
        ctx.arc(128, 128, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (this.isBlinking) {
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(30, 128);
        ctx.lineTo(226, 128);
        ctx.stroke();
        tex.needsUpdate = true;
        return;
      }

      const cx = 128 + lookX * 36;
      const cy = 128 + lookY * 28;

      switch (this.currentEmotion) {
        case 'orgullo': {
          const drawStar = (x: number, y: number, r: number) => {
            const spikes = 5;
            let rot = (Math.PI / 2) * 3;
            const step = Math.PI / spikes;
            ctx.fillStyle = '#4ade80';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(x, y - r);
            for (let i = 0; i < spikes; i++) {
              ctx.lineTo(x + Math.cos(rot) * r, y + Math.sin(rot) * r);
              rot += step;
              ctx.lineTo(x + Math.cos(rot) * (r * 0.45), y + Math.sin(rot) * (r * 0.45));
              rot += step;
            }
            ctx.lineTo(x, y - r);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          };
          drawStar(128, 128, 64);
          break;
        }

        case 'combate': {
          ctx.strokeStyle = '#ff007f';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(cx, cy, 55, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#ff007f';
          ctx.beginPath();
          ctx.arc(cx, cy, 26, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(cx - 70, cy);
          ctx.lineTo(cx + 70, cy);
          ctx.moveTo(cx, cy - 70);
          ctx.lineTo(cx, cy + 70);
          ctx.stroke();
          break;
        }

        case 'desden': {
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 14;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(35, 128 + (isLeft ? -10 : 10));
          ctx.lineTo(220, 128 + (isLeft ? 10 : -10));
          ctx.stroke();
          break;
        }

        case 'alivio': {
          ctx.strokeStyle = '#2dd4bf';
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.arc(128, 150, 60, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
          break;
        }

        case 'melancolia': {
          ctx.strokeStyle = '#e879f9';
          ctx.lineWidth = 12;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(60, 60);
          ctx.lineTo(196, 196);
          ctx.moveTo(196, 60);
          ctx.lineTo(60, 196);
          ctx.stroke();
          break;
        }

        case 'curioso':
        default: {
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(cx, cy, 60, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#00f0ff';
          ctx.beginPath();
          ctx.arc(cx, cy, 32, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cx - 10, cy - 10, 10, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }

      tex.needsUpdate = true;
    });
  }

  // =========================================================================
  // PUBLIC KINEMATICS & CONTROL API
  // =========================================================================
  public setAction(action: JarvisAction) {
    this.currentAction = action;
    if (action === 'celebracion_salto') {
      this.isJumping = true;
      this.jumpProgress = 0;
      (this.victoryParticles.material as THREE.PointsMaterial).opacity = 0.9;
      for (let i = 0; i < 120; i++) this.resetParticle(i);
    } else {
      this.isJumping = false;
      (this.victoryParticles.material as THREE.PointsMaterial).opacity = 0;
    }

    this.holoScreensGroup.visible = action === 'trabajando';
    this.holoDataOrbGroup.visible = action === 'manipular_datos';
  }

  public setEmotion(emotion: JarvisEmotion) {
    this.currentEmotion = emotion;
    this.updateEyeCanvas();
  }

  // Real-time Neural Node Resizing & Orbit Manipulation
  public setNodeScale(scale: number) {
    this.nodeScale = Math.max(0.4, Math.min(2.5, scale));
  }

  public setOrbitRadius(radius: number) {
    this.orbitRadius = Math.max(1.5, Math.min(4.0, radius));
  }

  public setOrbitPaused(paused: boolean) {
    this.orbitPaused = paused;
  }

  public adjustOrbitAngle(deltaAngle: number) {
    this.orbitAngleOffset += deltaAngle;
  }

  public setOrbitAngle(angle: number) {
    this.orbitAngleOffset = angle;
  }

  // =========================================================================
  // RENDER LOOP
  // =========================================================================
  public update(delta: number, mouseNorm: { x: number; y: number }, lipSync: VoiceLipSyncData) {
    this.animTimer += delta;

    // 1. Natural Blinking
    this.blinkTimer += delta;
    if (this.blinkTimer > 3.8) {
      this.isBlinking = true;
      if (this.blinkTimer > 3.96) {
        this.isBlinking = false;
        this.blinkTimer = 0;
      }
      this.updateEyeCanvas(mouseNorm.x, mouseNorm.y);
    }

    // 2. Head / Eyeball LookAt Targeting
    const targetRotY = mouseNorm.x * 0.45;
    const targetRotX = -mouseNorm.y * 0.35;
    this.headGroup.rotation.y = THREE.MathUtils.damp(this.headGroup.rotation.y, targetRotY, 8, delta);
    this.headGroup.rotation.x = THREE.MathUtils.damp(this.headGroup.rotation.x, targetRotX, 8, delta);

    if (Math.abs(mouseNorm.x) > 0.01 || Math.abs(mouseNorm.y) > 0.01) {
      this.updateEyeCanvas(mouseNorm.x, mouseNorm.y);
    }

    // 3. REAL 3D LIP-SYNC (Titanium Mandible Pivots + Acoustic Chamber Glow)
    const targetMouthOpen = Math.min(0.38, lipSync.volume * 0.45);
    this.mouthOpen = THREE.MathUtils.damp(this.mouthOpen, targetMouthOpen, 18, delta);
    this.lowerBeakMesh.rotation.x = -this.mouthOpen;
    this.lowerBeakMesh.position.y = -0.06 - this.mouthOpen * 0.25;
    (this.mouthGlowMesh.material as THREE.MeshBasicMaterial).opacity = Math.min(0.9, lipSync.volume * 1.5);

    // 4. Pilot Headphone Equalizer Bars Audio Reaction
    const vol = lipSync.volume;
    for (let i = 0; i < 5; i++) {
      const barH = 0.06 + vol * 0.24 * (Math.sin(this.animTimer * 12 + i) * 0.4 + 0.6);
      this.leftEqBars[i].scale.y = barH / 0.12;
      this.rightEqBars[i].scale.y = barH / 0.12;
    }

    // 5. Eyebrows 3D Tilt
    if (this.currentEmotion === 'combate') {
      this.leftEyebrowMesh.rotation.z = -0.42;
      this.rightEyebrowMesh.rotation.z = 0.42;
      this.leftEyebrowMesh.position.y = 0.26;
      this.rightEyebrowMesh.position.y = 0.26;
    } else if (this.currentEmotion === 'desden') {
      this.leftEyebrowMesh.rotation.z = -0.08;
      this.leftEyebrowMesh.position.y = 0.38;
      this.rightEyebrowMesh.rotation.z = 0.32;
    } else {
      this.leftEyebrowMesh.rotation.z = -0.22;
      this.rightEyebrowMesh.rotation.z = 0.22;
      this.leftEyebrowMesh.position.y = 0.32;
      this.rightEyebrowMesh.position.y = 0.32;
    }

    // 6. UPDATE 3D NEURONAL NODES (User Scale + Orbit Distance + Dynamic Filaments)
    if (!this.orbitPaused) {
      this.orbitAngleOffset += delta * 0.15;
    }

    this.neuralNodes.forEach((node, i) => {
      // Dynamic user scale
      node.mesh.scale.set(this.nodeScale, this.nodeScale, this.nodeScale);

      // Orbital placement at dynamic radius
      const currentAngle = node.baseAngle + this.orbitAngleOffset;
      const x = Math.cos(currentAngle) * this.orbitRadius;
      const z = Math.sin(currentAngle) * this.orbitRadius;
      const y = node.heightOffset;

      node.mesh.position.set(x, y, z);
      node.mesh.lookAt(0, y * 0.5, 0);

      // Update filament line curve connecting to mascot center
      const mascotCenter = this.bodyGroup.position;
      const lineCurvePoints = [
        mascotCenter.clone(),
        new THREE.Vector3(x * 0.5, (y + mascotCenter.y) * 0.5 - 0.15, z * 0.5),
        new THREE.Vector3(x, y - 0.2, z),
      ];
      const curve = new THREE.CatmullRomCurve3(lineCurvePoints);
      node.line.geometry.setFromPoints(curve.getPoints(24));

      // Pulse photon moving along the neural line
      const pulseT = (this.animTimer * 0.8 + i * 0.18) % 1.0;
      const photonPos = curve.getPoint(pulseT);
      node.pulsePhoton.position.copy(photonPos);
    });

    // 7. ACTION-SPECIFIC KINEMATICS (Attached Arm/Wing Gestures)
    switch (this.currentAction) {
      case 'celebracion_salto': {
        this.jumpProgress += delta * 1.8;
        if (this.jumpProgress > Math.PI) {
          this.jumpProgress = Math.PI;
        }

        const jumpY = Math.sin(this.jumpProgress) * 1.8;
        this.bodyGroup.position.y = jumpY;
        this.bodyGroup.rotation.z = this.jumpProgress * 2;

        const stretch = 1.0 + Math.sin(this.jumpProgress) * 0.22;
        this.bodyGroup.scale.set(0.72 / Math.sqrt(stretch), 0.72 * stretch, 0.72 / Math.sqrt(stretch));

        const flap = Math.sin(this.animTimer * 28) * 0.65;
        this.leftArmGroup.rotation.z = flap;
        this.rightArmGroup.rotation.z = -flap;

        const shadowScale = Math.max(0.3, 1.0 - jumpY * 0.35);
        this.shadowMesh.scale.set(shadowScale, shadowScale, shadowScale);
        (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, 0.65 - jumpY * 0.25);

        const positions = this.victoryParticles.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < 120; i++) {
          const i3 = i * 3;
          positions[i3] += this.particleVelocities[i3] * delta;
          positions[i3 + 1] += this.particleVelocities[i3 + 1] * delta;
          positions[i3 + 2] += this.particleVelocities[i3 + 2] * delta;
          this.particleVelocities[i3 + 1] -= 9.8 * delta;
        }
        this.victoryParticles.geometry.attributes.position.needsUpdate = true;
        break;
      }

      case 'trabajando': {
        this.bodyGroup.position.y = Math.sin(this.animTimer * 4) * 0.04;
        this.bodyGroup.rotation.z = 0;
        this.bodyGroup.scale.set(0.72, 0.72, 0.72);

        // Hands typing on holographic laser keyboard with articulated fingers
        const typingL = Math.sin(this.animTimer * 18) * 0.25 - 0.2;
        const typingR = Math.cos(this.animTimer * 18) * 0.25 - 0.2;
        this.leftArmGroup.rotation.x = 0.5 + typingL;
        this.rightArmGroup.rotation.x = 0.5 + typingR;
        this.leftArmGroup.rotation.z = -0.2;
        this.rightArmGroup.rotation.z = 0.2;

        this.leftFingers.forEach((f, idx) => {
          f.rotation.x = Math.sin(this.animTimer * 24 + idx * 1.5) * 0.35 + 0.2;
        });
        this.rightFingers.forEach((f, idx) => {
          f.rotation.x = Math.cos(this.animTimer * 24 + idx * 1.5) * 0.35 + 0.2;
        });

        this.holoKeyboardMesh.rotation.z = Math.sin(this.animTimer * 2) * 0.02;
        break;
      }

      case 'saludo': {
        this.bodyGroup.position.y = Math.sin(this.animTimer * 2) * 0.04;
        this.bodyGroup.rotation.z = 0;
        this.bodyGroup.scale.set(0.72, 0.72, 0.72);

        // Right hand & wing raised in salute, palm open and waving
        this.rightArmGroup.rotation.z = -1.25;
        this.rightArmGroup.rotation.x = 0.35 + Math.sin(this.animTimer * 8) * 0.15;
        this.leftArmGroup.rotation.z = 0.15;
        this.leftArmGroup.rotation.x = 0;

        this.rightFingers.forEach((f, idx) => {
          f.rotation.z = Math.sin(this.animTimer * 10 + idx) * 0.12;
          f.rotation.x = 0.05;
        });
        this.leftFingers.forEach((f) => { f.rotation.x = 0.15; });
        break;
      }

      case 'manipular_datos': {
        this.bodyGroup.position.y = Math.sin(this.animTimer * 2) * 0.04;
        this.bodyGroup.rotation.z = 0;
        this.bodyGroup.scale.set(0.72, 0.72, 0.72);

        // Hands cupping around data orb with fingers grasping
        this.leftArmGroup.rotation.z = -0.35;
        this.rightArmGroup.rotation.z = 0.35;
        this.leftArmGroup.rotation.y = 0.45;
        this.rightArmGroup.rotation.y = -0.45;

        const grasp = Math.sin(this.animTimer * 3) * 0.15 + 0.25;
        this.leftFingers.forEach((f) => { f.rotation.x = grasp; });
        this.rightFingers.forEach((f) => { f.rotation.x = grasp; });

        this.holoDataOrbGroup.rotation.y += delta * 1.5;
        this.holoDataOrbGroup.rotation.x += delta * 0.8;
        break;
      }

      case 'despedida': {
        this.bodyGroup.position.y = -0.15 + Math.sin(this.animTimer * 1.5) * 0.03;
        this.bodyGroup.rotation.x = 0.18;
        this.bodyGroup.rotation.z = 0;
        this.leftArmGroup.rotation.z = 0.15;
        this.rightArmGroup.rotation.z = -0.15;
        this.leftFingers.forEach((f) => { f.rotation.x = 0.2; });
        this.rightFingers.forEach((f) => { f.rotation.x = 0.2; });
        break;
      }

      case 'idle':
      default: {
        const hoverY = Math.sin(this.animTimer * 2.2) * 0.1;
        this.bodyGroup.position.y = hoverY;
        this.bodyGroup.rotation.z = Math.sin(this.animTimer * 1.1) * 0.02;
        this.bodyGroup.rotation.x = 0;
        this.bodyGroup.scale.set(0.72, 0.72, 0.72);

        // Gentle arm & hand float
        this.leftArmGroup.rotation.z = Math.sin(this.animTimer * 2.2) * 0.06 - 0.18;
        this.rightArmGroup.rotation.z = -Math.sin(this.animTimer * 2.2) * 0.06 + 0.18;
        this.leftArmGroup.rotation.x = 0;
        this.rightArmGroup.rotation.x = 0;

        // Natural relaxed finger curve
        this.leftFingers.forEach((f) => { f.rotation.x = 0.15; });
        this.rightFingers.forEach((f) => { f.rotation.x = 0.15; });

        const shadowBreath = 1.0 - hoverY * 0.2;
        this.shadowMesh.scale.set(shadowBreath, shadowBreath, shadowBreath);
        (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.65 - hoverY * 0.1;
        break;
      }
    }
  }

  public setAgentColorTheme(primaryHex: string) {
    const targetColor = new THREE.Color(primaryHex);
    this.bodyGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as THREE.Material;
        if (
          mat &&
          mat.type === 'MeshBasicMaterial' &&
          mesh !== this.leftEyeMesh &&
          mesh !== this.rightEyeMesh
        ) {
          const basic = mat as THREE.MeshBasicMaterial;
          if (!basic.map) {
            basic.color.copy(targetColor);
          }
        }
      }
    });
    if (this.holoKeyboardMesh) {
      (this.holoKeyboardMesh.material as THREE.MeshBasicMaterial).color.copy(targetColor);
    }
  }
}

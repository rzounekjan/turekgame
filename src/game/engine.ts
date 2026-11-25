import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { GamePhase, HudSnapshot, ScorePopupEvent } from '../types/game';
import { TurekAudioEngine } from './audio';
import {
  AMBULANCE_HIT_POINTS,
  AMBULANCE_MAX_INTERVAL,
  AMBULANCE_MIN_INTERVAL,
  DESPAWN_Z,
  getLaneX,
  getLevelForScore,
  getSpeedForScore,
  LANE_COUNT,
  LEVELS,
  NORMAL_DODGE_POINTS,
  PLAYER_Z,
  ROAD_LENGTH,
  SPAWN_Z,
  SPEEDUP_EVERY_POINTS,
  TOTAL_HIGHWAY_WIDTH,
} from './constants';
import { VehicleAssetLibrary, type TrafficVariant, type VehicleRig } from './models';
import {
  createAmbulanceRoofTexture,
  createContactShadowTexture,
  createHighwayAsphaltTexture,
} from './textures';

interface TrafficVehicle {
  rig: VehicleRig;
  active: boolean;
  isAmbulance: boolean;
  lane: number;
  z: number;
  speedMultiplier: number;
  passedPlayer: boolean;
  knockedOut: boolean;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinY: number;
  spinZ: number;
}

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onScorePopup: (popup: ScorePopupEvent) => void;
  onLevelUp: (level: number, name: string, subtitle: string, accentHex: string) => void;
  onSpeedUp: (speedKmh: number) => void;
  onGameOver: (finalSnapshot: HudSnapshot) => void;
}

// Reusable scratch objects to prevent per-frame GC allocations
const _dummy = new THREE.Object3D();
const _projVec = new THREE.Vector3();
const _targetSkyColor = new THREE.Color();
const _targetFogColor = new THREE.Color();
const _targetAccentColor = new THREE.Color();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class TurekGameEngine {
  private readonly container: HTMLElement;
  private readonly callbacks: EngineCallbacks;
  private readonly audio: TurekAudioEngine;
  private readonly isSoftwareGl: boolean;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly assets: VehicleAssetLibrary;

  private readonly roadTexture: THREE.CanvasTexture;
  private readonly contactShadowTex: THREE.CanvasTexture;
  private readonly ambulanceRoofTex: THREE.CanvasTexture;
  private readonly envTexture: THREE.Texture;

  private readonly playerRig: VehicleRig;
  private readonly trafficPool: TrafficVehicle[] = [];
  private readonly gantryGroups: THREE.Group[] = [];
  private readonly gantryNeonMats: THREE.MeshStandardMaterial[] = [];
  private readonly poleInstanced: THREE.InstancedMesh;
  private readonly poleLampInstanced: THREE.InstancedMesh;
  private readonly poleZPositions: number[] = [];

  private readonly particleMesh: THREE.InstancedMesh;
  private readonly particles: ParticleSlot[] = [];
  private readonly PARTICLE_COUNT = 88;

  private readonly keyLight: THREE.DirectionalLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly rimLight: THREE.DirectionalLight;

  // Game state
  private phase: GamePhase = 'title';
  private score = 0;
  private bestLocalScore = 0;
  private currentLevel = 1;
  private lastSpeedStep = 0;
  private dodgedCars = 0;
  private ambulancesHit = 0;

  // Player kinematics
  private playerLane = 2; // 0..5 (6 lanes)
  private playerX = getLaneX(2);
  private playerRoll = 0;
  private playerSquash = 1;
  private playerHitFlash = 0;

  // Input state (tap + smooth hold repeat)
  private heldDir: -1 | 0 | 1 = 0;
  private holdRepeatTimer = 0;
  private readonly HOLD_INITIAL_DELAY = 0.19;
  private readonly HOLD_REPEAT_INTERVAL = 0.13;

  // Traffic spawning & ambulance cadence (every 8th to 15th car)
  private spawnTimer = 0.4;
  private carsSinceAmbulance = 0;
  private nextAmbulanceTarget = randInt(AMBULANCE_MIN_INTERVAL, AMBULANCE_MAX_INTERVAL);

  // Camera & feel
  private baseCamY = 24;
  private baseCamZ = 27.5;
  private baseFov = 48;
  private shakeIntensity = 0;
  private hitstopTimer = 0;
  private roadScrollOffset = 0;
  private elapsedTime = 0;
  private demoSteerTimer = 0;

  // Loop, adaptive FPS governor & HUD dirty-check
  private readonly isMobileGpu: boolean;
  private currentDpr = 1;
  private avgFrameMs = 16.6;
  private slowFrameStreak = 0;
  private frameId = 0;
  private disposed = false;
  private lastTimestamp = 0;
  private hudSyncTimer = 0;
  private lastHudSignature = '';
  private popupCounter = 1;
  private contextLost = false;

  // Cleanup refs
  private readonly disposables: Array<{ dispose: () => void }> = [];

  constructor(
    container: HTMLElement,
    audio: TurekAudioEngine,
    callbacks: EngineCallbacks,
    initialBestScore = 0,
  ) {
    this.container = container;
    this.audio = audio;
    this.callbacks = callbacks;
    this.bestLocalScore = initialBestScore;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.isMobileGpu =
      !this.isSoftwareGl &&
      (window.matchMedia?.('(pointer: coarse)').matches ||
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));

    const maxTargetDpr = this.isSoftwareGl
      ? 1
      : Math.min(window.devicePixelRatio || 1, this.isMobileGpu ? 1.5 : 2);
    this.currentDpr = maxTargetDpr;

    // Renderer configured for crisp antialiasing & high-FPS mobile GPU performance
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.currentDpr);
    // Every vehicle has a grounded contact shadow plane; skip heavy real-time shadow pass on mobile GPUs for 60/120fps
    const enableDynamicShadows = !this.isSoftwareGl && !this.isMobileGpu;
    this.renderer.shadowMap.enabled = enableDynamicShadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';

    this.container.appendChild(this.renderer.domElement);

    // Scene & atmospheric horizon fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(LEVELS[0].skyColor);
    this.scene.fog = new THREE.FogExp2(LEVELS[0].fogColor, 0.0115);

    // Studio environment reflections for glossy Black SUV and metallic cars
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envTexture = pmrem.fromScene(roomEnv, 0.04).texture;
    this.scene.environment = this.envTexture;
    roomEnv.dispose();
    pmrem.dispose();

    // Camera positioned for vertical top-to-bottom 6-lane readability with rich 3D depth
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.5, 220);

    // Balanced 3-point warm/cool highway lighting rig
    this.hemiLight = new THREE.HemisphereLight(0x7cc4ff, 0x111524, 0.85);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff4e0, 1.85);
    this.keyLight.position.set(14, 34, 18);
    if (enableDynamicShadows) {
      this.keyLight.castShadow = true;
      this.keyLight.shadow.mapSize.set(512, 512);
      this.keyLight.shadow.camera.near = 5;
      this.keyLight.shadow.camera.far = 95;
      const d = 24;
      this.keyLight.shadow.camera.left = -d;
      this.keyLight.shadow.camera.right = d;
      this.keyLight.shadow.camera.top = d;
      this.keyLight.shadow.camera.bottom = -d;
      this.keyLight.shadow.bias = -0.0005;
      this.keyLight.shadow.normalBias = 0.025;
    }
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x00e5ff, 1.15);
    this.rimLight.position.set(-16, 16, -28);
    this.scene.add(this.rimLight);

    // Procedural textures
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.roadTexture = createHighwayAsphaltTexture(maxAniso);
    this.contactShadowTex = createContactShadowTexture();
    this.ambulanceRoofTex = createAmbulanceRoofTexture(maxAniso);

    // Shared procedural vehicle models library
    this.assets = new VehicleAssetLibrary(this.contactShadowTex, this.ambulanceRoofTex);

    // Build 6-lane highway + surrounding night terrain + guardrails + neon gantries + light poles
    const { poleInstanced, poleLampInstanced } = this.buildHighwayWorld();
    this.poleInstanced = poleInstanced;
    this.poleLampInstanced = poleLampInstanced;

    // Player's Black SUV
    this.playerRig = this.assets.createPlayerSUV();
    this.playerRig.group.position.set(this.playerX, 0, PLAYER_Z);
    this.scene.add(this.playerRig.group);

    // Pre-allocate pooled oncoming traffic & ambulances (zero GC during gameplay)
    this.buildTrafficPool();

    // Pooled instanced sparks / neon burst particles
    const pGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.disposables.push(pGeo, pMat);
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, this.PARTICLE_COUNT);
    this.particleMesh.frustumCulled = false;
    this.scene.add(this.particleMesh);

    for (let i = 0; i < this.PARTICLE_COUNT; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        color: new THREE.Color(0xffffff),
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, this.particles[i].color);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }

    // Bind resize & WebGL context resilience
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('blur', this.handleWindowBlur);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    // Pre-warm shaders on GPU devices
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Seed initial demo cars for an atmospheric live Title Screen highway
    this.seedInitialDemoTraffic();
    this.emitHud();

    // Start loop
    this.lastTimestamp = performance.now();
    this.scheduleNextFrame();
  }

  private buildHighwayWorld(): {
    poleInstanced: THREE.InstancedMesh;
    poleLampInstanced: THREE.InstancedMesh;
  } {
    // 1. Extended dark surrounding terrain outside the highway (so the highway sits in a real world, never a floating box)
    const groundGeo = new THREE.PlaneGeometry(260, ROAD_LENGTH + 60);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x090d18,
      roughness: 0.94,
      metalness: 0.05,
    });
    this.disposables.push(groundGeo, groundMat);
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.set(0, -0.06, -30);
    this.scene.add(ground);

    // Subtle distant low-poly highway ridge embankments flanking both sides
    const bankGeo = new THREE.BoxGeometry(28, 1.8, ROAD_LENGTH + 40);
    const bankMat = new THREE.MeshStandardMaterial({
      color: 0x0d1324,
      roughness: 0.88,
      metalness: 0.12,
    });
    this.disposables.push(bankGeo, bankMat);
    const leftBank = new THREE.Mesh(bankGeo, bankMat);
    leftBank.position.set(-(TOTAL_HIGHWAY_WIDTH * 0.5 + 17), 0.7, -30);
    leftBank.rotation.z = -0.14;
    const rightBank = new THREE.Mesh(bankGeo, bankMat);
    rightBank.position.set(TOTAL_HIGHWAY_WIDTH * 0.5 + 17, 0.7, -30);
    rightBank.rotation.z = 0.14;
    this.scene.add(leftBank, rightBank);

    // 2. Main 6-lane asphalt highway surface
    const roadGeo = new THREE.PlaneGeometry(TOTAL_HIGHWAY_WIDTH, ROAD_LENGTH);
    roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({
      map: this.roadTexture,
      roughness: 0.56,
      metalness: 0.18,
    });
    this.disposables.push(roadGeo, roadMat);
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.position.set(0, 0, -34);
    roadMesh.receiveShadow = !this.isSoftwareGl;
    this.scene.add(roadMesh);

    // 3. Metallic highway crash guardrails + glowing edge rail strip on both sides
    const barrierGeo = new THREE.BoxGeometry(0.45, 0.72, ROAD_LENGTH);
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.42,
      metalness: 0.78,
    });
    const neonRailGeo = new THREE.BoxGeometry(0.14, 0.14, ROAD_LENGTH);
    const neonRailMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    this.gantryNeonMats.push(neonRailMat);
    this.disposables.push(barrierGeo, barrierMat, neonRailGeo, neonRailMat);

    const railX = TOTAL_HIGHWAY_WIDTH * 0.5 + 0.25;
    for (const side of [-1, 1]) {
      const barrier = new THREE.Mesh(barrierGeo, barrierMat);
      barrier.position.set(side * railX, 0.36, -34);
      this.scene.add(barrier);

      const neonStrip = new THREE.Mesh(neonRailGeo, neonRailMat);
      neonStrip.position.set(side * (railX - 0.24), 0.54, -34);
      this.scene.add(neonStrip);
    }

    // 4. Instanced highway streetlight poles along both sides (low draw calls for mobile!)
    const pairs = 12;
    const totalPoles = pairs * 2;
    const poleGeo = new THREE.BoxGeometry(0.24, 6.8, 0.24);
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.45,
      metalness: 0.75,
    });
    const lampGeo = new THREE.BoxGeometry(1.5, 0.18, 0.34);
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xe0f8ff,
      emissive: 0x38bdf8,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    });
    this.gantryNeonMats.push(lampMat);
    this.disposables.push(poleGeo, poleMat, lampGeo, lampMat);

    const poleInstanced = new THREE.InstancedMesh(poleGeo, poleMat, totalPoles);
    const poleLampInstanced = new THREE.InstancedMesh(lampGeo, lampMat, totalPoles);
    poleInstanced.frustumCulled = false;
    poleLampInstanced.frustumCulled = false;

    const spacing = ROAD_LENGTH / pairs;
    for (let i = 0; i < pairs; i++) {
      this.poleZPositions.push(-110 + i * spacing);
    }
    this.updatePoleInstances(poleInstanced, poleLampInstanced);
    this.scene.add(poleInstanced, poleLampInstanced);

    // 5. Modern illuminated overhead highway neon arches / gantries (3 recycled arches)
    const gantryPillarGeo = new THREE.BoxGeometry(0.55, 7.6, 0.65);
    const gantryBeamGeo = new THREE.BoxGeometry(TOTAL_HIGHWAY_WIDTH + 2.2, 0.52, 0.72);
    const gantryNeonGeo = new THREE.BoxGeometry(TOTAL_HIGHWAY_WIDTH + 0.8, 0.18, 0.22);
    const gantrySteelMat = new THREE.MeshStandardMaterial({
      color: 0x141b2d,
      roughness: 0.4,
      metalness: 0.82,
    });
    const gantryGlowMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.4,
      roughness: 0.15,
    });
    this.gantryNeonMats.push(gantryGlowMat);
    this.disposables.push(
      gantryPillarGeo,
      gantryBeamGeo,
      gantryNeonGeo,
      gantrySteelMat,
      gantryGlowMat,
    );

    for (let i = 0; i < 3; i++) {
      const gantry = new THREE.Group();
      const pillarOffset = TOTAL_HIGHWAY_WIDTH * 0.5 + 0.85;

      const leftPillar = new THREE.Mesh(gantryPillarGeo, gantrySteelMat);
      leftPillar.position.set(-pillarOffset, 3.8, 0);
      const rightPillar = new THREE.Mesh(gantryPillarGeo, gantrySteelMat);
      rightPillar.position.set(pillarOffset, 3.8, 0);

      const topBeam = new THREE.Mesh(gantryBeamGeo, gantrySteelMat);
      topBeam.position.set(0, 7.65, 0);

      const neonTube = new THREE.Mesh(gantryNeonGeo, gantryGlowMat);
      neonTube.position.set(0, 7.36, 0.34);

      gantry.add(leftPillar, rightPillar, topBeam, neonTube);
      gantry.position.set(0, 0, -95 + i * 52);
      this.scene.add(gantry);
      this.gantryGroups.push(gantry);
    }

    return { poleInstanced, poleLampInstanced };
  }

  private updatePoleInstances(
    poles: THREE.InstancedMesh,
    lamps: THREE.InstancedMesh,
  ): void {
    const poleX = TOTAL_HIGHWAY_WIDTH * 0.5 + 0.95;
    let idx = 0;
    for (let i = 0; i < this.poleZPositions.length; i++) {
      const z = this.poleZPositions[i];
      for (const side of [-1, 1]) {
        _dummy.position.set(side * poleX, 3.4, z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        poles.setMatrixAt(idx, _dummy.matrix);

        _dummy.position.set(side * (poleX - 0.65), 6.72, z);
        _dummy.updateMatrix();
        lamps.setMatrixAt(idx, _dummy.matrix);
        idx++;
      }
    }
    poles.instanceMatrix.needsUpdate = true;
    lamps.instanceMatrix.needsUpdate = true;
  }

  private buildTrafficPool(): void {
    const variants: Exclude<TrafficVariant, 'ambulance'>[] = [
      'coupe',
      'sedan',
      'hatchback',
      'van',
    ];

    // 22 normal vehicles + 4 pooled bonus ambulances
    for (let i = 0; i < 22; i++) {
      const variant = variants[i % variants.length];
      const rig = this.assets.createTrafficCar(variant, i);
      rig.group.visible = false;
      this.scene.add(rig.group);
      this.trafficPool.push({
        rig,
        active: false,
        isAmbulance: false,
        lane: 0,
        z: SPAWN_Z,
        speedMultiplier: 1,
        passedPlayer: false,
        knockedOut: false,
        vx: 0,
        vy: 0,
        vz: 0,
        spinX: 0,
        spinY: 0,
        spinZ: 0,
      });
    }

    for (let i = 0; i < 4; i++) {
      const rig = this.assets.createAmbulance();
      rig.group.visible = false;
      this.scene.add(rig.group);
      this.trafficPool.push({
        rig,
        active: false,
        isAmbulance: true,
        lane: 0,
        z: SPAWN_Z,
        speedMultiplier: 1,
        passedPlayer: false,
        knockedOut: false,
        vx: 0,
        vy: 0,
        vz: 0,
        spinX: 0,
        spinY: 0,
        spinZ: 0,
      });
    }
  }

  private seedInitialDemoTraffic(): void {
    this.clearTraffic();
    const demoRows = [-72, -50, -28, -8];
    for (let r = 0; r < demoRows.length; r++) {
      const laneA = (r * 2) % LANE_COUNT;
      const laneB = (laneA + 3) % LANE_COUNT;
      this.activateVehicle(laneA, demoRows[r], r === 2);
      this.activateVehicle(laneB, demoRows[r] - 5, false);
    }
  }

  private clearTraffic(): void {
    for (const v of this.trafficPool) {
      v.active = false;
      v.knockedOut = false;
      v.passedPlayer = false;
      v.rig.group.visible = false;
      v.rig.group.rotation.set(0, 0, 0);
      v.rig.group.position.set(0, 0, SPAWN_Z);
    }
  }

  private activateVehicle(lane: number, z: number, forceAmbulance: boolean): boolean {
    // Pick an available slot matching normal vs ambulance
    const candidates = this.trafficPool.filter(
      (v) => !v.active && v.isAmbulance === forceAmbulance,
    );
    if (candidates.length === 0) return false;
    const slot = candidates[Math.floor(Math.random() * candidates.length)];

    slot.active = true;
    slot.lane = lane;
    slot.z = z;
    slot.passedPlayer = false;
    slot.knockedOut = false;
    slot.vx = 0;
    slot.vy = 0;
    slot.vz = 0;
    slot.spinX = 0;
    slot.spinY = 0;
    slot.spinZ = 0;
    // Slight realistic variance in oncoming vehicle speeds
    slot.speedMultiplier = forceAmbulance
      ? 1.04
      : 0.92 + Math.random() * 0.22;

    slot.rig.group.position.set(getLaneX(lane), 0, z);
    slot.rig.group.rotation.set(0, 0, 0);
    slot.rig.group.visible = true;
    return true;
  }

  // --- Public Game Controls ---

  public startGame(): void {
    this.audio.unlock();
    this.phase = 'playing';
    this.score = 0;
    this.currentLevel = 1;
    this.lastSpeedStep = 0;
    this.dodgedCars = 0;
    this.ambulancesHit = 0;
    this.playerLane = 2;
    this.playerX = getLaneX(2);
    this.playerRoll = 0;
    this.playerSquash = 1;
    this.playerHitFlash = 0;
    this.heldDir = 0;
    this.shakeIntensity = 0;
    this.hitstopTimer = 0;
    this.carsSinceAmbulance = 0;
    this.nextAmbulanceTarget = randInt(AMBULANCE_MIN_INTERVAL, AMBULANCE_MAX_INTERVAL);
    this.spawnTimer = 0.35;

    this.playerRig.group.position.set(this.playerX, 0, PLAYER_Z);
    this.playerRig.group.rotation.set(0, 0, 0);
    this.playerRig.group.scale.set(1, 1, 1);

    this.clearTraffic();
    this.applyLevelAtmosphere(LEVELS[0], true);
    this.audio.startMusic(1);
    this.emitHud();
  }

  public returnToTitle(): void {
    this.audio.stopMusic();
    this.phase = 'title';
    this.score = 0;
    this.currentLevel = 1;
    this.lastSpeedStep = 0;
    this.dodgedCars = 0;
    this.ambulancesHit = 0;
    this.playerLane = 2;
    this.playerX = getLaneX(2);
    this.playerRoll = 0;
    this.playerSquash = 1;
    this.playerHitFlash = 0;
    this.heldDir = 0;
    this.shakeIntensity = 0;
    this.hitstopTimer = 0;
    this.carsSinceAmbulance = 0;
    this.nextAmbulanceTarget = randInt(AMBULANCE_MIN_INTERVAL, AMBULANCE_MAX_INTERVAL);
    this.spawnTimer = 0.6;

    this.playerRig.group.position.set(this.playerX, 0, PLAYER_Z);
    this.playerRig.group.rotation.set(0, 0, 0);
    this.playerRig.group.scale.set(1, 1, 1);

    this.applyLevelAtmosphere(LEVELS[0], true);
    this.seedInitialDemoTraffic();
    this.emitHud();
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.heldDir = 0;
      this.audio.stopMusic();
      this.emitHud();
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      this.lastTimestamp = performance.now();
      this.audio.startMusic(this.currentLevel);
      this.emitHud();
    }
  }

  public setSteerPress(dir: -1 | 1): void {
    if (this.phase !== 'playing') return;
    this.audio.unlock();
    this.shiftLane(dir);
    this.heldDir = dir;
    this.holdRepeatTimer = this.HOLD_INITIAL_DELAY;
  }

  public releaseSteer(dir?: -1 | 1): void {
    if (dir === undefined || this.heldDir === dir) {
      this.heldDir = 0;
    }
  }

  private shiftLane(dir: -1 | 1): void {
    const next = Math.max(0, Math.min(LANE_COUNT - 1, this.playerLane + dir));
    if (next !== this.playerLane) {
      this.playerLane = next;
      this.playerSquash = 1.07;
      this.audio.playLaneShift(dir);
    }
  }

  public getPhase(): GamePhase {
    return this.phase;
  }

  // --- Loop & Rendering ---

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const aspect = width / height;

    this.camera.aspect = aspect;

    // Smart adaptive framing so all 6 equal-width lanes fit cleanly on BOTH portrait phones and wide desktops
    const desiredVisibleWidth = TOTAL_HIGHWAY_WIDTH + 3.2; // ~22.3 world units
    if (aspect < 0.85) {
      // Portrait mobile smartphone: lift camera slightly higher & wider so all 6 lanes stay comfortably visible
      this.baseFov = 54;
      const vFovRad = THREE.MathUtils.degToRad(this.baseFov);
      const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);
      const neededDist = (desiredVisibleWidth / 2) / Math.tan(hFovRad / 2);
      const scale = THREE.MathUtils.clamp(neededDist / 26, 1.0, 1.65);
      this.baseCamY = 25 * scale;
      this.baseCamZ = PLAYER_Z + 13.5 * scale;
    } else {
      // Desktop / landscape tablet
      this.baseFov = 46;
      this.baseCamY = 23.5;
      this.baseCamZ = PLAYER_Z + 14.5;
    }

    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(this.currentDpr);
  };

  private handleWindowBlur = (): void => {
    this.heldDir = 0;
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
    this.lastTimestamp = performance.now();
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick(performance.now()));
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private tick = (timestamp: number = performance.now()): void => {
    if (this.disposed) return;

    const rawMs = this.lastTimestamp > 0 ? timestamp - this.lastTimestamp : 16.67;
    this.lastTimestamp = timestamp;
    const clampedMs = Math.min(Math.max(rawMs, 1), 50);

    // Adaptive DPR governor on hardware GPUs: keeps motion silky smooth on slower phones
    if (!this.isSoftwareGl && this.phase === 'playing') {
      this.avgFrameMs = this.avgFrameMs * 0.92 + clampedMs * 0.08;
      if (this.avgFrameMs > 21.5 && this.currentDpr > 0.9) {
        this.slowFrameStreak++;
        if (this.slowFrameStreak >= 40) {
          this.slowFrameStreak = 0;
          this.currentDpr = Math.max(0.9, Number((this.currentDpr - 0.25).toFixed(2)));
          this.renderer.setPixelRatio(this.currentDpr);
        }
      } else {
        this.slowFrameStreak = 0;
      }
    }

    const dt = clampedMs / 1000;

    if (!this.contextLost) {
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    }

    this.scheduleNextFrame();
  };

  private update(dt: number): void {
    this.elapsedTime += dt;

    if (this.phase === 'paused') {
      return;
    }

    // Brief arcade hitstop on heavy impacts (ambulance smash / crash)
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.updateParticles(dt * 0.35);
      this.updateCamera(dt);
      return;
    }

    const levelCfg = getLevelForScore(this.score);
    const activeSpeed =
      this.phase === 'playing'
        ? getSpeedForScore(this.score)
        : this.phase === 'title'
          ? 24
          : 4;

    // 1. Scroll 6-lane asphalt highway downward (top -> bottom)
    const repeatLen = ROAD_LENGTH / 7;
    this.roadScrollOffset = (this.roadScrollOffset + (activeSpeed * dt) / repeatLen) % 1;
    this.roadTexture.offset.y = this.roadScrollOffset;

    // 2. Scroll roadside streetlight poles & neon highway gantries downward
    for (let i = 0; i < this.poleZPositions.length; i++) {
      this.poleZPositions[i] += activeSpeed * dt;
      if (this.poleZPositions[i] > DESPAWN_Z + 12) {
        this.poleZPositions[i] -= ROAD_LENGTH;
      }
    }
    this.updatePoleInstances(this.poleInstanced, this.poleLampInstanced);

    for (const gantry of this.gantryGroups) {
      gantry.position.z += activeSpeed * dt;
      if (gantry.position.z > DESPAWN_Z + 10) {
        gantry.position.z -= 156;
      }
    }

    // 3. Smooth level atmosphere color transition
    this.applyLevelAtmosphere(levelCfg, false, dt);

    // 4. Held input smooth lane stepping
    if (this.phase === 'playing' && this.heldDir !== 0) {
      this.holdRepeatTimer -= dt;
      if (this.holdRepeatTimer <= 0) {
        this.shiftLane(this.heldDir);
        this.holdRepeatTimer = this.HOLD_REPEAT_INTERVAL;
      }
    }

    // Title screen autonomous showcase cruise
    if (this.phase === 'title') {
      this.updateDemoAutopilot(dt);
    }

    // 5. Player Black SUV spring-damped lane gliding & banking
    const targetX = getLaneX(this.playerLane);
    const prevX = this.playerX;
    this.playerX = THREE.MathUtils.damp(this.playerX, targetX, 16, dt);
    const lateralVel = (this.playerX - prevX) / Math.max(dt, 0.001);

    const targetRoll = THREE.MathUtils.clamp(-lateralVel * 0.015, -0.22, 0.22);
    this.playerRoll = THREE.MathUtils.damp(this.playerRoll, targetRoll, 14, dt);
    this.playerSquash = THREE.MathUtils.damp(this.playerSquash, 1, 14, dt);

    this.playerRig.group.position.x = this.playerX;
    this.playerRig.group.rotation.z = this.playerRoll;
    this.playerRig.group.rotation.y = THREE.MathUtils.clamp(-lateralVel * 0.008, -0.14, 0.14);
    this.playerRig.group.scale.set(
      this.playerSquash,
      2 - this.playerSquash,
      1,
    );

    // Spin player SUV wheels
    const wheelSpin = activeSpeed * dt * 1.4;
    for (const w of this.playerRig.wheels) {
      w.rotation.x -= wheelSpin;
    }

    if (this.playerHitFlash > 0) {
      this.playerHitFlash = Math.max(0, this.playerHitFlash - dt * 4);
      if (this.playerRig.underglowMat) {
        this.playerRig.underglowMat.opacity = 0.36 + this.playerHitFlash * 0.55;
      }
    }

    // 6. Spawn & update oncoming vehicles
    if (this.phase === 'playing' || this.phase === 'title') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnWave(levelCfg);
        const speedScale = Math.max(0.62, 1 - this.lastSpeedStep * 0.032);
        const minT = levelCfg.spawnIntervalMin * speedScale;
        const maxT = levelCfg.spawnIntervalMax * speedScale;
        this.spawnTimer =
          this.phase === 'title'
            ? 0.95
            : minT + Math.random() * Math.max(0.08, maxT - minT);
      }
    }

    this.updateTraffic(dt, activeSpeed);
    this.updateParticles(dt);
    this.updateCamera(dt, activeSpeed);

    // Throttled HUD telemetry sync (~12Hz during steady driving, immediate on score/level events)
    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.08) {
      this.hudSyncTimer = 0;
      this.emitHud();
    }
  }

  private updateDemoAutopilot(dt: number): void {
    this.demoSteerTimer -= dt;
    if (this.demoSteerTimer > 0) return;

    // Score each lane by safety in front of player
    let bestLane = this.playerLane;
    let bestSafety = -1;

    for (let lane = 0; lane < LANE_COUNT; lane++) {
      let minDist = 999;
      let hasAmbulance = false;
      for (const v of this.trafficPool) {
        if (!v.active || v.knockedOut || v.lane !== lane) continue;
        if (v.z < PLAYER_Z + 4 && v.z > PLAYER_Z - 42) {
          const dist = PLAYER_Z - v.z;
          if (dist < minDist) {
            minDist = dist;
            hasAmbulance = v.isAmbulance;
          }
        }
      }
      const safety = hasAmbulance ? 200 : minDist - Math.abs(lane - this.playerLane) * 2.5;
      if (safety > bestSafety) {
        bestSafety = safety;
        bestLane = lane;
      }
    }

    if (bestLane !== this.playerLane) {
      this.playerLane += bestLane > this.playerLane ? 1 : -1;
      this.demoSteerTimer = 0.24;
    } else {
      this.demoSteerTimer = 0.12;
    }
  }

  private spawnWave(levelCfg: (typeof LEVELS)[number]): void {
    // Pick 1..maxCarsPerWave distinct lanes while always guaranteeing open escape corridors
    const waveSize =
      this.phase === 'title'
        ? 2
        : randInt(1, Math.min(levelCfg.maxCarsPerWave, LANE_COUNT - 2));

    // Check which lanes don't have a car right at the spawn edge
    const openLanes: number[] = [];
    for (let l = 0; l < LANE_COUNT; l++) {
      let blocked = false;
      for (const v of this.trafficPool) {
        if (v.active && !v.knockedOut && v.lane === l && v.z < SPAWN_Z + 17) {
          blocked = true;
          break;
        }
      }
      if (!blocked) openLanes.push(l);
    }

    if (openLanes.length < 2) return;

    // Shuffle open lanes
    for (let i = openLanes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = openLanes[i];
      openLanes[i] = openLanes[j];
      openLanes[j] = tmp;
    }

    // Leave at least 2 lanes clear across the wave so the player always has a fair path
    const count = Math.min(waveSize, openLanes.length - 2);
    for (let i = 0; i < Math.max(1, count); i++) {
      const lane = openLanes[i];
      const staggerZ = SPAWN_Z - i * (2.6 + Math.random() * 5.8);

      this.carsSinceAmbulance++;
      let spawnAmbulance = false;
      if (this.carsSinceAmbulance >= this.nextAmbulanceTarget) {
        spawnAmbulance = true;
        this.carsSinceAmbulance = 0;
        this.nextAmbulanceTarget = randInt(AMBULANCE_MIN_INTERVAL, AMBULANCE_MAX_INTERVAL);
      }

      const spawned = this.activateVehicle(lane, staggerZ, spawnAmbulance);
      if (!spawned && spawnAmbulance) {
        // Retry ambulance on the next car if pool temporarily busy
        this.carsSinceAmbulance = this.nextAmbulanceTarget;
      }
    }
  }

  private updateTraffic(dt: number, highwaySpeed: number): void {
    // Alternating emergency strobe phase for ambulances
    const flashPhase = Math.floor(this.elapsedTime * 11) % 2 === 0;

    for (const v of this.trafficPool) {
      if (!v.active) continue;

      if (v.knockedOut) {
        // Dramatic flying ambulance launch after bonus smash
        v.rig.group.position.x += v.vx * dt;
        v.rig.group.position.y += v.vy * dt;
        v.rig.group.position.z += v.vz * dt;
        v.vy -= 36 * dt;
        v.rig.group.rotation.x += v.spinX * dt;
        v.rig.group.rotation.y += v.spinY * dt;
        v.rig.group.rotation.z += v.spinZ * dt;

        if (v.rig.group.position.y < -8 || v.rig.group.position.z > DESPAWN_Z + 25) {
          v.active = false;
          v.rig.group.visible = false;
        }
        continue;
      }

      // Oncoming vehicles descend from top (-Z) toward bottom (+Z)
      const carSpeed = highwaySpeed * v.speedMultiplier;
      v.z += carSpeed * dt;
      v.rig.group.position.z = v.z;

      for (const w of v.rig.wheels) {
        w.rotation.x += carSpeed * dt * 1.3;
      }

      // Animate ambulance emergency LED strobes & target halo
      if (v.isAmbulance) {
        if (v.rig.sirenBlueMat && v.rig.sirenRedMat) {
          v.rig.sirenBlueMat.emissiveIntensity = flashPhase ? 4.8 : 0.35;
          v.rig.sirenRedMat.emissiveIntensity = flashPhase ? 0.35 : 4.8;
        }
        if (v.rig.bonusHaloMat) {
          v.rig.bonusHaloMat.opacity = 0.28 + Math.sin(this.elapsedTime * 9) * 0.16;
        }
      }

      // Collision detection during active gameplay
      if (this.phase === 'playing') {
        const dx = Math.abs(v.rig.group.position.x - this.playerX);
        const dz = Math.abs(v.z - PLAYER_Z);

        // Generous forgiving hitbox for normal cars, slightly wider welcoming hitbox for bonus ambulances
        const hitX = v.isAmbulance ? 1.88 : 1.56;
        const hitZ = v.isAmbulance ? 4.05 : 3.55;

        if (dx < hitX && dz < hitZ) {
          if (v.isAmbulance) {
            this.handleAmbulanceSmash(v);
            continue;
          } else {
            this.handlePlayerCrash(v);
            return;
          }
        }

        // Passing a normal car safely awards +1 point
        if (!v.isAmbulance && !v.passedPlayer && v.z > PLAYER_Z + 3.2) {
          v.passedPlayer = true;
          this.dodgedCars++;
          this.addPoints(NORMAL_DODGE_POINTS, 'dodge', v.rig.group.position.x, v.z);
        }
      }

      // Recycle once off bottom of highway
      if (v.z > DESPAWN_Z) {
        v.active = false;
        v.rig.group.visible = false;
      }
    }
  }

  private handleAmbulanceSmash(v: TrafficVehicle): void {
    v.knockedOut = true;
    v.passedPlayer = true;
    const kickDir = v.rig.group.position.x >= this.playerX ? 1 : -1;
    v.vx = kickDir * (14 + Math.random() * 8);
    v.vy = 16 + Math.random() * 5;
    v.vz = -18 - Math.random() * 8;
    v.spinX = (Math.random() - 0.5) * 10;
    v.spinY = kickDir * (8 + Math.random() * 6);
    v.spinZ = -kickDir * (9 + Math.random() * 5);

    this.ambulancesHit++;
    this.hitstopTimer = 0.045;
    this.shakeIntensity = 0.65;
    this.playerSquash = 1.18;
    this.playerHitFlash = 1.0;

    this.spawnBurst(v.rig.group.position.x, 1.2, PLAYER_Z - 1.2, 26, [0x00f0ff, 0xfacc15, 0xffffff]);
    this.audio.playAmbulanceBonus();
    this.addPoints(AMBULANCE_HIT_POINTS, 'ambulance', this.playerX, PLAYER_Z - 2.4);
  }

  private handlePlayerCrash(v: TrafficVehicle): void {
    this.phase = 'gameover';
    this.heldDir = 0;
    this.hitstopTimer = 0.075;
    this.shakeIntensity = 1.35;
    this.playerSquash = 0.84;

    this.spawnBurst(
      (this.playerX + v.rig.group.position.x) * 0.5,
      1.1,
      (PLAYER_Z + v.z) * 0.5,
      44,
      [0xff3344, 0xf59e0b, 0xfff7ed, 0x38bdf8],
    );

    this.audio.stopMusic();
    this.audio.playCrash();

    if (this.score > this.bestLocalScore) {
      this.bestLocalScore = this.score;
    }
    const snap = this.buildHudSnapshot();
    this.callbacks.onHudUpdate(snap);
    this.callbacks.onGameOver(snap);
  }

  private addPoints(
    pts: number,
    kind: 'dodge' | 'ambulance',
    worldX: number,
    worldZ: number,
  ): void {
    this.score += pts;
    if (this.score > this.bestLocalScore) {
      this.bestLocalScore = this.score;
    }

    if (kind === 'dodge') {
      this.audio.playDodgePoint();
    }

    // Project popup coordinates into screen percentage
    const { xPercent, yPercent } = this.projectToScreenPercent(worldX, 2.2, worldZ);
    if (kind === 'ambulance') {
      this.callbacks.onScorePopup({
        id: this.popupCounter++,
        text: `+${AMBULANCE_HIT_POINTS}`,
        subtext: 'SANITKA BONUS',
        xPercent,
        yPercent,
        kind: 'ambulance',
      });
    } else if (this.score % 5 === 0) {
      // Keep screen super clean — show subtle +1 pops at crisp intervals or always unobtrusively
      this.callbacks.onScorePopup({
        id: this.popupCounter++,
        text: `+${NORMAL_DODGE_POINTS}`,
        xPercent,
        yPercent,
        kind: 'dodge',
      });
    }

    // Check every-10-points speed increase
    const speedStep = Math.floor(this.score / SPEEDUP_EVERY_POINTS);
    const newLevelCfg = getLevelForScore(this.score);
    const leveledUp = newLevelCfg.level > this.currentLevel;

    if (leveledUp) {
      this.currentLevel = newLevelCfg.level;
      this.lastSpeedStep = speedStep;
      this.audio.setLevel(this.currentLevel, speedStep);
      this.audio.playLevelUp();
      this.callbacks.onLevelUp(
        newLevelCfg.level,
        newLevelCfg.name,
        newLevelCfg.subtitle,
        newLevelCfg.accentHex,
      );
    } else if (speedStep > this.lastSpeedStep) {
      this.lastSpeedStep = speedStep;
      this.audio.setLevel(this.currentLevel, speedStep);
      this.audio.playSpeedUp();
      const kmh = Math.round(getSpeedForScore(this.score) * 3.8);
      this.callbacks.onSpeedUp(kmh);
    }

    this.emitHud();
  }

  private projectToScreenPercent(x: number, y: number, z: number): { xPercent: number; yPercent: number } {
    _projVec.set(x, y, z).project(this.camera);
    const xPercent = THREE.MathUtils.clamp((_projVec.x * 0.5 + 0.5) * 100, 24, 76);
    const yPercent = THREE.MathUtils.clamp((-_projVec.y * 0.5 + 0.5) * 100, 20, 76);
    return { xPercent, yPercent };
  }

  private spawnBurst(
    x: number,
    y: number,
    z: number,
    count: number,
    hexColors: number[],
  ): void {
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 1.4;
      p.y = y + Math.random() * 0.8;
      p.z = z + (Math.random() - 0.5) * 1.4;
      const angle = Math.random() * Math.PI * 2;
      const spd = 6 + Math.random() * 14;
      p.vx = Math.cos(angle) * spd;
      p.vy = 5 + Math.random() * 12;
      p.vz = Math.sin(angle) * spd;
      p.maxLife = 0.45 + Math.random() * 0.45;
      p.life = p.maxLife;
      p.size = 0.7 + Math.random() * 1.1;
      p.color.setHex(hexColors[spawned % hexColors.length]);
      this.particleMesh.setColorAt(i, p.color);
      spawned++;
    }
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private updateParticles(dt: number): void {
    let dirty = false;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      dirty = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 26 * dt;

      const t = p.life / p.maxLife;
      _dummy.position.set(p.x, Math.max(0.12, p.y), p.z);
      _dummy.rotation.set(p.life * 8, p.life * 6, 0);
      _dummy.scale.setScalar(p.size * t);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
    }
    if (dirty) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private applyLevelAtmosphere(
    cfg: (typeof LEVELS)[number],
    instant: boolean,
    dt = 0.016,
  ): void {
    const lerpAmt = instant ? 1 : 1 - Math.exp(-3.2 * dt);

    _targetSkyColor.setHex(cfg.skyColor);
    _targetFogColor.setHex(cfg.fogColor);
    _targetAccentColor.setHex(cfg.gantryColor);

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.lerp(_targetSkyColor, lerpAmt);
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.lerp(_targetFogColor, lerpAmt);
    }

    this.rimLight.color.lerp(_targetAccentColor, lerpAmt);

    for (const mat of this.gantryNeonMats) {
      mat.color.lerp(_targetAccentColor, lerpAmt);
      mat.emissive.lerp(_targetAccentColor, lerpAmt);
    }

    if (this.playerRig.underglowMat) {
      this.playerRig.underglowMat.color.lerp(_targetAccentColor, lerpAmt);
    }
  }

  private updateCamera(dt: number, activeSpeed = 28): void {
    // Subtle FOV widening as speed increases across levels
    const speedRatio = THREE.MathUtils.clamp((activeSpeed - 28) / 50, 0, 1);
    const targetFov = this.baseFov + speedRatio * 5.5;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 4, dt);
      this.camera.updateProjectionMatrix();
    }

    // Subtle lateral follow keeps all 6 lanes balanced while giving physical weight
    const targetCamX =
      this.phase === 'title'
        ? Math.sin(this.elapsedTime * 0.35) * 1.8
        : this.playerX * 0.22;

    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeIntensity > 0.005) {
      shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 9, dt);
    } else {
      this.shakeIntensity = 0;
    }

    const camX = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 6, dt);
    this.camera.position.set(
      camX + shakeX,
      this.baseCamY + shakeY,
      this.baseCamZ,
    );
    this.camera.lookAt(camX * 0.45, 0.4, -12);
  }

  private buildHudSnapshot(): HudSnapshot {
    const levelCfg = getLevelForScore(this.score);
    const nextCfg = LEVELS.find((l) => l.level === levelCfg.level + 1) ?? null;
    const levelProgress = nextCfg
      ? THREE.MathUtils.clamp(
          (this.score - levelCfg.minScore) / (nextCfg.minScore - levelCfg.minScore),
          0,
          1,
        )
      : 1;

    let ambulanceNearby = false;
    for (const v of this.trafficPool) {
      if (v.active && v.isAmbulance && !v.knockedOut && v.z > -72 && v.z < PLAYER_Z + 2) {
        ambulanceNearby = true;
        break;
      }
    }

    return {
      phase: this.phase,
      score: this.score,
      bestLocalScore: this.bestLocalScore,
      level: levelCfg.level,
      levelName: levelCfg.name,
      levelAccent: levelCfg.accentHex,
      speedKmh: Math.round(getSpeedForScore(this.score) * 3.8),
      speedStep: Math.floor(this.score / SPEEDUP_EVERY_POINTS),
      dodgedCars: this.dodgedCars,
      ambulancesHit: this.ambulancesHit,
      nextLevelScore: nextCfg ? nextCfg.minScore : null,
      levelProgress,
      ambulanceNearby,
    };
  }

  private emitHud(force = false): void {
    const snap = this.buildHudSnapshot();
    const sig = `${snap.phase}|${snap.score}|${snap.bestLocalScore}|${snap.level}|${snap.speedKmh}|${snap.dodgedCars}|${snap.ambulancesHit}|${snap.ambulanceNearby ? 1 : 0}`;
    if (!force && sig === this.lastHudSignature) {
      return;
    }
    this.lastHudSignature = sig;
    this.callbacks.onHudUpdate(snap);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('blur', this.handleWindowBlur);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.assets.dispose();
    this.roadTexture.dispose();
    this.contactShadowTex.dispose();
    this.ambulanceRoofTex.dispose();
    this.envTexture.dispose();
    for (const item of this.disposables) {
      item.dispose();
    }

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

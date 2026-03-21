import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number;
  type: "ember" | "spark" | "orb" | "smoke" | "lightning" | "impact";
  hue: number; alpha: number;
}

const RACES = [
  "human", "elf", "dwarf", "orc", "beastfolk", "mystic",
  "fae", "elemental", "undead", "demon", "draconic", "celestial", "aquatic", "titan",
] as const;
type Race = typeof RACES[number];

const PALETTE: Record<Race, { skin: number; armor: number; accent: number; glow: string; scale: number }> = {
  human:     { skin: 0xd4a574, armor: 0x6d3a00, accent: 0xe74c3c, glow: "#c0392b", scale: 1.00 },
  elf:       { skin: 0xe8f5e9, armor: 0x2e7d32, accent: 0xa5d6a7, glow: "#4caf50", scale: 0.92 },
  dwarf:     { skin: 0xcd8530, armor: 0x5d2e00, accent: 0xffd700, glow: "#ff8c00", scale: 0.80 },
  orc:       { skin: 0x558b2f, armor: 0x1b5e20, accent: 0x8bc34a, glow: "#76ff03", scale: 1.18 },
  beastfolk: { skin: 0x8d5524, armor: 0x4e342e, accent: 0xff7043, glow: "#ff5722", scale: 1.06 },
  mystic:    { skin: 0xce93d8, armor: 0x6a1b9a, accent: 0xe040fb, glow: "#ab47bc", scale: 0.90 },
  fae:       { skin: 0xfce4ec, armor: 0xad1457, accent: 0xf48fb1, glow: "#f06292", scale: 0.76 },
  elemental: { skin: 0xff8c00, armor: 0x7a0000, accent: 0xffcc02, glow: "#ff6f00", scale: 1.02 },
  undead:    { skin: 0x78909c, armor: 0x263238, accent: 0xb0bec5, glow: "#90a4ae", scale: 1.00 },
  demon:     { skin: 0xb71c1c, armor: 0x1a0000, accent: 0xff1744, glow: "#f44336", scale: 1.12 },
  draconic:  { skin: 0x1b7a5e, armor: 0x001b14, accent: 0x69f0ae, glow: "#00e676", scale: 1.10 },
  celestial: { skin: 0xffd54f, armor: 0xe65100, accent: 0xffffff, glow: "#fff9c4", scale: 1.00 },
  aquatic:   { skin: 0x0097a7, armor: 0x006064, accent: 0x80deea, glow: "#00bcd4", scale: 0.96 },
  titan:     { skin: 0xbdbdbd, armor: 0x37474f, accent: 0xe0e0e0, glow: "#9e9e9e", scale: 1.38 },
};

interface FighterInfo { race: Race; startingHp: number; }
let lastRacePair: [string, string] = ["", ""];
function randomRacePair(): [FighterInfo, FighterInfo] {
  let r1: Race, r2: Race;
  do {
    const s = [...RACES].sort(() => Math.random() - 0.5);
    r1 = s[0]; r2 = s[1];
  } while (r1 === lastRacePair[0] && r2 === lastRacePair[1]);
  lastRacePair = [r1, r2];
  return [
    { race: r1, startingHp: 3 + Math.floor(Math.random() * 3) },
    { race: r2, startingHp: 3 + Math.floor(Math.random() * 3) },
  ];
}

interface CharRig {
  outerGroup: THREE.Group;
  innerGroup: THREE.Group;
  headGroup: THREE.Group;
  torso: THREE.Mesh;
  lArmPivot: THREE.Group;
  rArmPivot: THREE.Group;
  lLegPivot: THREE.Group;
  rLegPivot: THREE.Group;
  glow: THREE.PointLight;
  baseX: number;
  facing: 1 | -1;
  dispose: () => void;
}

function buildCharacter(
  scene: THREE.Scene, race: Race, baseX: number, facing: 1 | -1
): CharRig {
  const pal = PALETTE[race];
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  function mat(color: number, emissive = 0): THREE.MeshLambertMaterial {
    const m = new THREE.MeshLambertMaterial({
      color,
      emissive: new THREE.Color(color).multiplyScalar(emissive),
    });
    mats.push(m);
    return m;
  }
  function box(w: number, h: number, d: number) {
    const g = new THREE.BoxGeometry(w, h, d);
    geos.push(g);
    return g;
  }
  function mkMesh(g: THREE.BufferGeometry, m: THREE.Material) {
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    return mesh;
  }

  const skinMat   = mat(pal.skin, 0.0);
  const armorMat  = mat(pal.armor, 0.06);
  const accentMat = mat(pal.accent, 0.25);

  const outerGroup = new THREE.Group();
  outerGroup.position.set(baseX, 0, 0);
  scene.add(outerGroup);

  const innerGroup = new THREE.Group();
  innerGroup.rotation.y = facing === 1 ? -Math.PI / 2 : Math.PI / 2;
  innerGroup.scale.setScalar(pal.scale);
  outerGroup.add(innerGroup);

  const torso = mkMesh(box(0.74, 0.88, 0.40), armorMat);
  torso.position.set(0, 0.94, 0);
  innerGroup.add(torso);

  const belt = mkMesh(box(0.77, 0.11, 0.42), accentMat);
  belt.position.set(0, 0.50, 0);
  innerGroup.add(belt);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.50, 0);
  innerGroup.add(headGroup);

  const headMesh = mkMesh(box(0.50, 0.55, 0.46), skinMat);
  headMesh.position.set(0, 0.275, 0);
  headGroup.add(headMesh);

  const eyeGeo = box(0.10, 0.08, 0.04);
  geos.push(eyeGeo);
  const leye = new THREE.Mesh(eyeGeo, accentMat);
  leye.position.set(-0.13, 0.30, 0.24);
  headGroup.add(leye);
  const reye = new THREE.Mesh(eyeGeo, accentMat);
  reye.position.set(0.13, 0.30, 0.24);
  headGroup.add(reye);

  const lShoulder = mkMesh(box(0.26, 0.20, 0.28), accentMat);
  lShoulder.position.set(-0.50, 1.30, 0);
  innerGroup.add(lShoulder);
  const rShoulder = mkMesh(box(0.26, 0.20, 0.28), accentMat);
  rShoulder.position.set(0.50, 1.30, 0);
  innerGroup.add(rShoulder);

  const lArmPivot = new THREE.Group();
  lArmPivot.position.set(-0.46, 1.24, 0);
  innerGroup.add(lArmPivot);
  lArmPivot.rotation.x = 0.1;
  const lUA = mkMesh(box(0.20, 0.44, 0.20), armorMat);
  lUA.position.set(0, -0.22, 0);
  lArmPivot.add(lUA);
  const lFA = mkMesh(box(0.16, 0.38, 0.16), skinMat);
  lFA.position.set(0, -0.63, 0);
  lArmPivot.add(lFA);

  const rArmPivot = new THREE.Group();
  rArmPivot.position.set(0.46, 1.24, 0);
  innerGroup.add(rArmPivot);
  rArmPivot.rotation.x = -0.15;
  const rUA = mkMesh(box(0.20, 0.44, 0.20), armorMat);
  rUA.position.set(0, -0.22, 0);
  rArmPivot.add(rUA);
  const rFA = mkMesh(box(0.16, 0.38, 0.16), skinMat);
  rFA.position.set(0, -0.63, 0);
  rArmPivot.add(rFA);

  const weaponBlade = mkMesh(box(0.07, 0.80, 0.05), accentMat);
  weaponBlade.position.set(0.04, -1.10, 0);
  rArmPivot.add(weaponBlade);
  const guard = mkMesh(box(0.28, 0.07, 0.07), accentMat);
  guard.position.set(0.04, -0.72, 0);
  rArmPivot.add(guard);

  const hip = mkMesh(box(0.70, 0.36, 0.36), armorMat);
  hip.position.set(0, 0.40, 0);
  innerGroup.add(hip);

  const lLegPivot = new THREE.Group();
  lLegPivot.position.set(-0.17, 0.38, 0);
  innerGroup.add(lLegPivot);
  const lUL = mkMesh(box(0.26, 0.48, 0.26), armorMat);
  lUL.position.set(0, -0.24, 0);
  lLegPivot.add(lUL);
  const lLL = mkMesh(box(0.22, 0.44, 0.22), armorMat);
  lLL.position.set(0, -0.70, 0);
  lLegPivot.add(lLL);
  const lFt = mkMesh(box(0.26, 0.15, 0.38), accentMat);
  lFt.position.set(0, -0.96, 0.06);
  lLegPivot.add(lFt);

  const rLegPivot = new THREE.Group();
  rLegPivot.position.set(0.17, 0.38, 0);
  innerGroup.add(rLegPivot);
  const rUL = mkMesh(box(0.26, 0.48, 0.26), armorMat);
  rUL.position.set(0, -0.24, 0);
  rLegPivot.add(rUL);
  const rLL = mkMesh(box(0.22, 0.44, 0.22), armorMat);
  rLL.position.set(0, -0.70, 0);
  rLegPivot.add(rLL);
  const rFt = mkMesh(box(0.26, 0.15, 0.38), accentMat);
  rFt.position.set(0, -0.96, 0.06);
  rLegPivot.add(rFt);

  const glow = new THREE.PointLight(new THREE.Color(pal.glow), 2.0, 6);
  glow.position.set(baseX, 1.5, facing * 0.3);
  scene.add(glow);

  return {
    outerGroup, innerGroup, headGroup, torso,
    lArmPivot, rArmPivot, lLegPivot, rLegPivot,
    glow, baseX, facing,
    dispose() {
      scene.remove(outerGroup);
      scene.remove(glow);
      geos.forEach(g => g.dispose());
      mats.forEach(m => m.dispose());
    },
  };
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
function easeOut(t: number) { return 1 - (1 - t) ** 2; }
function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; }

function resetPose(rig: CharRig) {
  rig.outerGroup.position.set(rig.baseX, 0, 0);
  rig.outerGroup.rotation.set(0, 0, 0);
  rig.innerGroup.rotation.y = rig.facing === 1 ? -Math.PI / 2 : Math.PI / 2;
  rig.torso.rotation.set(0, 0, 0);
  rig.headGroup.rotation.set(0, 0, 0);
  rig.lArmPivot.rotation.set(0.10, 0, 0);
  rig.rArmPivot.rotation.set(-0.15, 0, 0);
  rig.lLegPivot.rotation.set(0, 0, 0);
  rig.rLegPivot.rotation.set(0, 0, 0);
}

function applyIdlePose(rig: CharRig, time: number, phaseOffset: number) {
  const t = time + phaseOffset;
  resetPose(rig);
  rig.outerGroup.position.y = Math.sin(t * 1.6) * 0.045;
  rig.headGroup.rotation.z = Math.sin(t * 0.9) * 0.035;
  rig.lArmPivot.rotation.x = Math.sin(t * 1.3) * 0.10 + 0.10;
  rig.rArmPivot.rotation.x = Math.sin(t * 1.3 + Math.PI) * 0.10 - 0.15;
  rig.lLegPivot.rotation.x = Math.sin(t * 1.6) * 0.06;
  rig.rLegPivot.rotation.x = Math.sin(t * 1.6 + Math.PI) * 0.06;
}

function applyAttackPose(rig: CharRig, t: number) {
  const { facing, baseX } = rig;
  const lungeT = t < 0.40 ? easeOut(t / 0.40) : easeInOut(1 - (t - 0.40) / 0.60);
  rig.outerGroup.position.x = baseX + lungeT * 0.75 * facing;
  rig.outerGroup.position.y = lungeT * 0.04;

  let armX: number;
  if (t < 0.30)      armX = lerp(-0.20, -1.30, t / 0.30);
  else if (t < 0.50) armX = lerp(-1.30,  1.50, (t - 0.30) / 0.20);
  else               armX = lerp( 1.50, -0.15, (t - 0.50) / 0.50);
  rig.rArmPivot.rotation.x = armX;

  const lean = smoothstep(0, 0.5, t) * (1 - smoothstep(0.5, 1.0, t));
  rig.torso.rotation.x   = lean * 0.22;
  rig.headGroup.rotation.x = lean * 0.14;
  rig.lLegPivot.rotation.x =  lean * 0.28;
  rig.rLegPivot.rotation.x = -lean * 0.14;
}

function applyRecoilPose(rig: CharRig, t: number) {
  const { facing, baseX } = rig;
  const rt = t < 0.40 ? easeOut(t / 0.40) : easeInOut(1 - (t - 0.40) / 0.60);
  rig.outerGroup.position.x = baseX - rt * 0.50 * facing;

  const stagger = t < 0.40 ? smoothstep(0, 0.40, t) : smoothstep(0.90, 0.40, t);
  rig.outerGroup.rotation.z = -stagger * 0.28 * facing;
  rig.torso.rotation.x       = -stagger * 0.25;
  rig.headGroup.rotation.x   = -stagger * 0.18;
  rig.lArmPivot.rotation.x   =  stagger * 0.70 - 0.10;
  rig.rArmPivot.rotation.x   = -stagger * 0.80;
}

function applyDyingPose(rig: CharRig, t: number) {
  const ft = easeInOut(Math.min(1, t));
  rig.outerGroup.rotation.z  = -ft * Math.PI * 0.50 * rig.facing;
  rig.outerGroup.position.y  = -ft * 0.55;
  rig.lArmPivot.rotation.x   =  ft * 0.60;
  rig.rArmPivot.rotation.x   = -ft * 0.40;
  rig.lLegPivot.rotation.x   =  ft * 0.30;
  rig.rLegPivot.rotation.x   = -ft * 0.30;
}

type Phase = "idle" | "attack" | "recoil" | "dying";
interface AnimState { phase: Phase; startTime: number; duration: number; }

export default function RacesBattleScene() {
  const glCanvasRef      = useRef<HTMLCanvasElement>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef     = useRef<Particle[]>([]);
  const clashTimersRef   = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [flashOpacity, setFlashOpacity] = useState(0);
  const [shakeX, setShakeX] = useState(0);
  const [shakeY, setShakeY] = useState(0);
  const [leftLabel,  setLeftLabel]  = useState("");
  const [rightLabel, setRightLabel] = useState("");
  const [roundVisible, setRoundVisible] = useState(true);

  useEffect(() => {
    return () => { clashTimersRef.current.forEach(clearTimeout); };
  }, []);

  const spawnImpactBurst = useCallback((canvas: HTMLCanvasElement) => {
    const cx = canvas.width / 2;
    const cy = canvas.height * 0.42;
    for (let i = 0; i < 36; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      particlesRef.current.push({
        x: cx + (Math.random() - 0.5) * 24, y: cy + (Math.random() - 0.5) * 24,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1,
        life: 0, maxLife: 22 + Math.random() * 26,
        size: 1.5 + Math.random() * 4.0,
        type: "impact", hue: 25 + Math.random() * 45, alpha: 0,
      });
    }
  }, []);

  const triggerClash = useCallback((canvas: HTMLCanvasElement | null) => {
    if (canvas) spawnImpactBurst(canvas);
    setFlashOpacity(0.6);
    const shx = (Math.random() - 0.5) * 18;
    const shy = (Math.random() - 0.5) * 11;
    setShakeX(shx); setShakeY(shy);
    clashTimersRef.current.push(
      setTimeout(() => { setFlashOpacity(0.25); setShakeX(-shx * 0.5); setShakeY(-shy * 0.5); }, 80)
    );
    clashTimersRef.current.push(
      setTimeout(() => { setFlashOpacity(0); setShakeX(0); setShakeY(0); }, 210)
    );
  }, [spawnImpactBurst]);

  useEffect(() => {
    const glCanvas = glCanvasRef.current;
    if (!glCanvas) return;

    const probe = document.createElement("canvas");
    const hasWebGL = !!(probe.getContext("webgl2") || probe.getContext("webgl"));
    if (!hasWebGL) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: glCanvas, alpha: true, antialias: true });
    } catch {
      return;
    }
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0314, 0.10);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    camera.position.set(0, 2.6, 7.8);
    camera.lookAt(0, 1.2, 0);

    function resize() {
      const w = glCanvas.clientWidth;
      const h = glCanvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", resize);
    resize();

    const ambient = new THREE.AmbientLight(0x2a1060, 1.0);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(3, 10, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.left = -7;
    dirLight.shadow.camera.right = 7;
    dirLight.shadow.camera.top = 9;
    dirLight.shadow.camera.bottom = -2;
    dirLight.shadow.camera.far = 30;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x4060ff, 0.6);
    rimLight.position.set(0, 4, -6);
    scene.add(rimLight);

    const floorGeo = new THREE.PlaneGeometry(22, 22);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x0c041e, transparent: true, opacity: 0.65 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const ringGeo = new THREE.RingGeometry(1.7, 2.1, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x6600aa, side: THREE.DoubleSide, transparent: true, opacity: 0.35 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    scene.add(ring);

    const innerRingGeo = new THREE.RingGeometry(0.05, 0.15, 32);
    const innerRingMat = new THREE.MeshBasicMaterial({ color: 0xaa44ff, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.005;
    scene.add(innerRing);

    let cancelled = false;
    let leftRig: CharRig | null = null;
    let rightRig: CharRig | null = null;
    let leftHp = 0;
    let rightHp = 0;

    const leftAnim:  AnimState = { phase: "idle", startTime: 0, duration: 0 };
    const rightAnim: AnimState = { phase: "idle", startTime: 0, duration: 0 };
    const clock = new THREE.Clock();

    function spawnFighters(left: FighterInfo, right: FighterInfo) {
      leftRig?.dispose();
      rightRig?.dispose();
      leftRig  = buildCharacter(scene, left.race,  -2.3,  1);
      rightRig = buildCharacter(scene, right.race,  2.3, -1);
      leftHp  = left.startingHp;
      rightHp = right.startingHp;
      leftAnim.phase  = "idle";
      rightAnim.phase = "idle";
      setLeftLabel(left.race.charAt(0).toUpperCase() + left.race.slice(1));
      setRightLabel(right.race.charAt(0).toUpperCase() + right.race.slice(1));
    }

    function sleep(ms: number): Promise<void> {
      return new Promise(resolve => {
        const id = setTimeout(resolve, ms);
        clashTimersRef.current.push(id);
      });
    }

    const [initLeft, initRight] = randomRacePair();
    spawnFighters(initLeft, initRight);

    async function runFight() {
      while (!cancelled) {
        await sleep(2000 + Math.random() * 1000);

        while (!cancelled && leftHp > 0 && rightHp > 0) {
          const leftAttacks = Math.random() > 0.5;
          const attAnim = leftAttacks ? leftAnim : rightAnim;
          const defAnim = leftAttacks ? rightAnim : leftAnim;

          attAnim.phase = "attack";
          attAnim.startTime = clock.getElapsedTime();
          attAnim.duration = 0.90;

          await sleep(attAnim.duration * 1000 * 0.38);
          if (cancelled) return;

          triggerClash(particleCanvasRef.current);
          if (leftAttacks) rightHp--; else leftHp--;

          defAnim.phase = "recoil";
          defAnim.startTime = clock.getElapsedTime();
          defAnim.duration = 0.62;

          await sleep(attAnim.duration * 1000 * 0.62);
          if (cancelled) return;
          if (leftHp <= 0 || rightHp <= 0) break;
          await sleep(900 + Math.random() * 900);
        }

        if (cancelled) return;

        if (leftHp <= 0 && leftRig) {
          leftAnim.phase = "dying";
          leftAnim.startTime = clock.getElapsedTime();
          leftAnim.duration = 1.4;
        }
        if (rightHp <= 0 && rightRig) {
          rightAnim.phase = "dying";
          rightAnim.startTime = clock.getElapsedTime();
          rightAnim.duration = 1.4;
        }

        await sleep(2000);
        if (cancelled) return;

        setRoundVisible(false);
        await sleep(500);
        if (cancelled) return;

        const [newLeft, newRight] = randomRacePair();
        spawnFighters(newLeft, newRight);
        setRoundVisible(true);
      }
    }

    let rafId = 0;
    function renderLoop() {
      rafId = requestAnimationFrame(renderLoop);
      const time = clock.getElapsedTime();

      if (leftRig) {
        const la = leftAnim;
        if (la.phase === "idle") {
          applyIdlePose(leftRig, time, 0);
        } else {
          const t = Math.min(1, (time - la.startTime) / la.duration);
          if (la.phase === "attack") applyAttackPose(leftRig, t);
          else if (la.phase === "recoil") applyRecoilPose(leftRig, t);
          else if (la.phase === "dying") applyDyingPose(leftRig, t);
          if (t >= 1 && la.phase !== "dying") la.phase = "idle";
        }
        leftRig.glow.position.x = leftRig.outerGroup.position.x;
        leftRig.glow.intensity = 1.8 + Math.sin(time * 2.8) * 0.4;
      }

      if (rightRig) {
        const ra = rightAnim;
        if (ra.phase === "idle") {
          applyIdlePose(rightRig, time, Math.PI * 0.75);
        } else {
          const t = Math.min(1, (time - ra.startTime) / ra.duration);
          if (ra.phase === "attack") applyAttackPose(rightRig, t);
          else if (ra.phase === "recoil") applyRecoilPose(rightRig, t);
          else if (ra.phase === "dying") applyDyingPose(rightRig, t);
          if (t >= 1 && ra.phase !== "dying") ra.phase = "idle";
        }
        rightRig.glow.position.x = rightRig.outerGroup.position.x;
        rightRig.glow.intensity = 1.8 + Math.sin(time * 2.8 + Math.PI) * 0.4;
      }

      ring.rotation.z += 0.0025;
      innerRing.rotation.z -= 0.005;
      renderer.render(scene, camera);
    }

    renderLoop();
    runFight();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      leftRig?.dispose();
      rightRig?.dispose();
      floorGeo.dispose(); floorMat.dispose();
      ringGeo.dispose(); ringMat.dispose();
      innerRingGeo.dispose(); innerRingMat.dispose();
      renderer.dispose();
    };
  }, [triggerClash]);

  useEffect(() => {
    const canvas = particleCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function spawnAmbient() {
      if (!canvas) return;
      const w = canvas.width, h = canvas.height;
      const r = Math.random();
      const type: Particle["type"] =
        r < 0.38 ? "ember" : r < 0.60 ? "spark" : r < 0.78 ? "orb" : r < 0.90 ? "smoke" : "lightning";
      let x: number, y: number, vx: number, vy: number, size: number, hue: number, maxLife: number;
      switch (type) {
        case "ember":
          x = Math.random() * w; y = h * (0.30 + Math.random() * 0.70);
          vx = (Math.random() - 0.5) * 1.5; vy = -(0.5 + Math.random() * 1.5);
          size = 1.5 + Math.random() * 3; hue = 20 + Math.random() * 30; maxLife = 60 + Math.random() * 100;
          break;
        case "spark":
          x = Math.random() * w; y = h * (0.40 + Math.random() * 0.50);
          vx = (Math.random() - 0.5) * 3; vy = -(1 + Math.random() * 3);
          size = 1 + Math.random() * 2; hue = 35 + Math.random() * 20; maxLife = 30 + Math.random() * 50;
          break;
        case "orb":
          x = Math.random() * w; y = h * (0.10 + Math.random() * 0.80);
          vx = (Math.random() - 0.5) * 0.6; vy = (Math.random() - 0.5) * 0.6;
          size = 3 + Math.random() * 6; hue = 180 + Math.random() * 180; maxLife = 120 + Math.random() * 180;
          break;
        case "smoke":
          x = Math.random() * w; y = h * (0.50 + Math.random() * 0.50);
          vx = (Math.random() - 0.5) * 0.4; vy = -(0.2 + Math.random() * 0.5);
          size = 20 + Math.random() * 40; hue = 220 + Math.random() * 40; maxLife = 150 + Math.random() * 150;
          break;
        default:
          x = Math.random() * w; y = h * (0.05 + Math.random() * 0.40);
          vx = 0; vy = 0;
          size = 40 + Math.random() * 80; hue = 200 + Math.random() * 60; maxLife = 8 + Math.random() * 12;
          break;
      }
      particlesRef.current.push({ x, y, vx, vy, life: 0, maxLife, size, type, hue, alpha: 0 });
    }

    let frameCount = 0;
    let animId = 0;
    function loop() {
      animId = requestAnimationFrame(loop);
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frameCount++;
      const rate = frameCount % 2 === 0 ? 3 : 2;
      for (let i = 0; i < rate; i++) {
        if (particlesRef.current.length < 300) spawnAmbient();
      }
      particlesRef.current = particlesRef.current.filter(p => p.life < p.maxLife);
      for (const p of particlesRef.current) {
        p.life++;
        p.x += p.vx; p.y += p.vy;
        const prog = p.life / p.maxLife;
        p.alpha = Math.min(prog * 5, 1) * (1 - prog * prog);

        if (p.type === "impact") {
          p.vy += 0.15;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
          g.addColorStop(0, `hsla(${p.hue}, 100%, 95%, ${p.alpha})`);
          g.addColorStop(0.4, `hsla(${p.hue + 15}, 100%, 70%, ${p.alpha * 0.7})`);
          g.addColorStop(1, `hsla(${p.hue + 30}, 100%, 50%, 0)`);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2); ctx.fill();
          ctx.save();
          ctx.globalAlpha = p.alpha * 0.9;
          ctx.strokeStyle = `hsl(${p.hue}, 100%, 85%)`;
          ctx.lineWidth = p.size * 0.4;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); ctx.stroke();
          ctx.restore();
        } else if (p.type === "ember") {
          p.vx += (Math.random() - 0.5) * 0.10;
          p.vy += (Math.random() - 0.5) * 0.05;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          g.addColorStop(0, `hsla(${p.hue}, 100%, 90%, ${p.alpha})`);
          g.addColorStop(1, `hsla(${p.hue}, 100%, 50%, 0)`);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        } else if (p.type === "spark") {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.strokeStyle = `hsl(${p.hue}, 100%, 80%)`;
          ctx.lineWidth = p.size * 0.5;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 4, p.y - p.vy * 4); ctx.stroke();
          ctx.restore();
        } else if (p.type === "orb") {
          const pulse = 0.7 + 0.3 * Math.sin(p.life * 0.08);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * pulse);
          g.addColorStop(0, `hsla(${p.hue}, 100%, 90%, ${p.alpha * 0.9})`);
          g.addColorStop(0.5, `hsla(${p.hue}, 80%, 60%, ${p.alpha * 0.4})`);
          g.addColorStop(1, `hsla(${p.hue}, 70%, 40%, 0)`);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * pulse, 0, Math.PI * 2); ctx.fill();
        } else if (p.type === "smoke") {
          ctx.save();
          ctx.globalAlpha = p.alpha * 0.12;
          ctx.fillStyle = `hsl(${p.hue}, 20%, 70%)`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + prog), 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } else if (p.type === "lightning") {
          ctx.save();
          ctx.globalAlpha = p.alpha * 0.85;
          ctx.strokeStyle = `hsla(${p.hue}, 100%, 90%, 1)`;
          ctx.shadowColor = `hsl(${p.hue}, 100%, 70%)`;
          ctx.shadowBlur = 12;
          ctx.lineWidth = 1.5 + Math.random() * 1.5;
          ctx.beginPath();
          let lx = p.x, ly = p.y;
          const segs = 6 + Math.floor(Math.random() * 4);
          const sl = p.size / segs;
          ctx.moveTo(lx, ly);
          for (let s = 0; s < segs; s++) {
            lx += (Math.random() - 0.5) * sl * 1.2;
            ly += sl * (0.6 + Math.random() * 0.4);
            ctx.lineTo(lx, ly);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.restore();
        }
      }
    }

    loop();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ transform: `translate(${shakeX}px, ${shakeY}px)`, transition: "transform 0.05s ease-out" }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, #0a0314 0%, #10062a 30%, #1a0a3a 60%, #0d0520 100%)" }}
      />

      <img
        src="/races-battle.png" alt=""
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ opacity: 0.05, mixBlendMode: "screen" }}
      />

      <canvas ref={glCanvasRef} className="absolute inset-0 w-full h-full" />
      <canvas ref={particleCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 50% 0%, transparent 40%, rgba(0,0,0,0.55) 100%),
            radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.8) 0%, transparent 60%)
          `,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(0,0,0,0.65) 100%)" }}
      />

      <AnimatePresence>
        {roundVisible && leftLabel && rightLabel && (
          <motion.div
            key={`${leftLabel}-${rightLabel}`}
            className="absolute bottom-[12%] left-0 right-0 flex justify-around items-end pointer-events-none px-12"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center">
              <p className="text-yellow-300 font-bold text-lg tracking-widest uppercase drop-shadow-lg"
                style={{ textShadow: "0 0 16px rgba(255,180,0,0.8)" }}>
                {leftLabel}
              </p>
            </div>
            <div className="text-center">
              <p className="text-red-400 font-bold text-xl tracking-[0.3em] uppercase"
                style={{ textShadow: "0 0 12px rgba(255,50,50,0.9)" }}>
                VS
              </p>
            </div>
            <div className="text-center">
              <p className="text-yellow-300 font-bold text-lg tracking-widest uppercase drop-shadow-lg"
                style={{ textShadow: "0 0 16px rgba(255,180,0,0.8)" }}>
                {rightLabel}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {flashOpacity > 0 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "white", opacity: flashOpacity }}
        />
      )}
    </div>
  );
}

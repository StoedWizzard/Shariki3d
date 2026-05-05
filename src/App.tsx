import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

// ═══════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════
const ARENA       = 5;
const HALF        = ARENA / 2;
const DAMAGE      = 8;
const BALL_RADIUS = 0.6;

// ── Types ──────────────────────────────────────────────────────────
type TeamId   = "A" | "B";
type UnitType =
  | "swordsman" | "archer"   | "laser"  | "engineer"
  | "barbarian" | "king"     | "recruit"| "bomber"
  | "toxic"     | "machinegunner";

type CameraMode = "FREE" | "TOP" | "SIDE" | "CORNER" | "INSIDE";

// ── Unit definition shapes ─────────────────────────────────────────
interface SwordsmanDef  { hp:number; radius:number; color:number; swingDmg:number;   orbitR:number;         orbitSpeed:number; }
interface ArcherDef     { hp:number; radius:number; color:number; projSpeed:number;  projDmg:number;        fireRate:number; spread:number; gravity:number; }
interface LaserDef      { hp:number; radius:number; color:number; cooldown:number;   active:number;         dmgPerSec:number; }
interface EngineerDef   { hp:number; radius:number; color:number; spawnRate:number;  turretProjDmg:number; }
interface BarbarianDef  { hp:number; radius:number; color:number; axeOrbitR:number;  axeOrbitSpeedBase:number; axeDmg:number; }
interface KingDef       { hp:number; radius:number; color:number; crownDmg:number;   recruitHpThreshold:number; }
interface RecruitDef    { hp:number; radius:number; color:number; spearDmg:number;   spearRange:number;     spearRate:number; }
interface BomberDef     { hp:number; radius:number; color:number; bombInterval:number; bombRadius:number;   bombDmg:number; }
interface ToxicDef      { hp:number; radius:number; color:number; knifeR:number;     knifeDmg:number;       dotDmg:number; dotDuration:number; }
interface MachinegunnerDef { hp:number; radius:number; color:number; burstInterval:number; burstCount:number; bulletSpeed:number; bulletDmg:number; bulletSpread:number; }

type UnitDef =
  | SwordsmanDef | ArcherDef    | LaserDef   | EngineerDef
  | BarbarianDef | KingDef      | RecruitDef | BomberDef
  | ToxicDef     | MachinegunnerDef;

interface UnitDefs {
  swordsman:    SwordsmanDef;
  archer:       ArcherDef;
  laser:        LaserDef;
  engineer:     EngineerDef;
  barbarian:    BarbarianDef;
  king:         KingDef;
  recruit:      RecruitDef;
  bomber:       BomberDef;
  toxic:        ToxicDef;
  machinegunner:MachinegunnerDef;
}

// ── Runtime entity types ───────────────────────────────────────────
interface DotEffect {
  remaining: number;
  dmg:       number;
  tickTimer: number;
}

interface Unit {
  x: number; y: number; z: number;
  vx:number; vy:number; vz:number;
  hp:     number;
  maxHp:  number;
  color:  number;
  type:   UnitType;
  team:   TeamId;
  radius: number;
  id:     number;
  // timers / state
  fireTimer:      number;
  laserTimer:     number;
  laserActive:    boolean;
  engineerTimer:  number;
  orbitAngle:     number;
  // king
  lastHpRatio:    number;
  recruitTimer:   number;
  // bomber
  bombTimer:      number;
  // machinegunner
  burstTimer:     number;
  burstShotsLeft: number;
  burstFireTimer: number;
  // DOT
  dots: DotEffect[];
  alive: boolean;
}

interface Projectile {
  x: number; y: number; z: number;
  vx:number; vy:number; vz:number;
  gravity: number | undefined;
  dmg:   number;
  team:  TeamId;
  life:  number;
  color: number;
  dot:   { duration: number; dmg: number } | null;
}

interface Turret {
  x: number; y: number; z: number;
  team:      TeamId;
  fireTimer: number;
  alive:     boolean;
}

interface Bomb {
  x: number; y: number; z: number;
  timer:    number;
  team:     TeamId;
  exploded: boolean;
  flashIdx: number;
}

interface SimState {
  balls:       Unit[];
  projectiles: Projectile[];
  turrets:     Turret[];
  bombs:       Bomb[];
  camMode:     CameraMode;
  yaw:         number;
  pitch:       number;
  orbitDist:   number;
  keys:        Record<string, boolean>;
  collisionFlash: number;
  simRunning:  boolean;
}

interface UnitConfig {
  type: UnitType;
  hp:   number;
}

interface UnitHpInfo {
  type:   UnitType;
  team:   TeamId;
  hp:     number;
  maxHp:  number;
  dots:   number;
}

interface StaticCamera {
  name: CameraMode;
  pos:  [number, number, number];
  look: [number, number, number];
}

interface PropSet {
  sword:    THREE.Group;
  axe:      THREE.Group;
  bow:      THREE.Group;
  crown:    THREE.Group;
  spear:    THREE.Group;
  dynamite: THREE.Group;
  knife:    THREE.Group;
  minigun:  THREE.Group;
  helmet:   THREE.Group;
}

interface PropEntry {
  container: THREE.Group;
  props:     PropSet;
}

// ═══════════════════════════════════════════════════════════════════
//  CONSTANTS (data)
// ═══════════════════════════════════════════════════════════════════
const UNIT_DEFS: UnitDefs = {
  swordsman:    { hp:180, radius:BALL_RADIUS,       color:0x44ddff, swingDmg:6,   orbitR:1.1,  orbitSpeed:2.8 },
  archer:       { hp:100, radius:BALL_RADIUS*0.9,   color:0x88ff44, projSpeed:9,  projDmg:14,  fireRate:1.6, spread:0.18, gravity:-4 },
  laser:        { hp:120, radius:BALL_RADIUS,        color:0xff44ff, cooldown:5,   active:5,    dmgPerSec:22 },
  engineer:     { hp:130, radius:BALL_RADIUS,        color:0xffaa22, spawnRate:10, turretProjDmg:8 },
  barbarian:    { hp:150, radius:BALL_RADIUS*1.05,  color:0xff4422, axeOrbitR:1.2, axeOrbitSpeedBase:3.5, axeDmg:9 },
  king:         { hp:300, radius:BALL_RADIUS*1.2,   color:0xffcc00, crownDmg:20,  recruitHpThreshold:0.2 },
  recruit:      { hp:10,  radius:BALL_RADIUS*0.7,   color:0xaaddff, spearDmg:3,   spearRange:1.4, spearRate:0.8 },
  bomber:       { hp:90,  radius:BALL_RADIUS,        color:0xff8800, bombInterval:5, bombRadius:2.2, bombDmg:35 },
  toxic:        { hp:110, radius:BALL_RADIUS,        color:0x44ff88, knifeR:1.0,   knifeDmg:2,  dotDmg:1, dotDuration:5 },
  machinegunner:{ hp:140, radius:BALL_RADIUS,        color:0xcc88ff, burstInterval:3, burstCount:4, bulletSpeed:12, bulletDmg:8, bulletSpread:0.22 },
};

const TEAM_CSS: Record<TeamId, string>  = { A:"#4488ff", B:"#ff3344" };
const TEAM_HEX: Record<TeamId, number>  = { A:0x4488ff,  B:0xff3344  };

const ALL_TYPES: UnitType[] = [
  "swordsman","archer","laser","engineer","barbarian",
  "king","recruit","bomber","toxic","machinegunner",
];

const TYPE_ICONS: Record<UnitType, string> = {
  swordsman:"⚔️", archer:"🏹", laser:"🔫", engineer:"🔧", barbarian:"🪓",
  king:"👑", recruit:"🪖", bomber:"💣", toxic:"☠️", machinegunner:"🔫",
};
const TYPE_COLORS_CSS: Record<UnitType, string> = {
  swordsman:"#44ddff", archer:"#88ff44", laser:"#ff44ff", engineer:"#ffaa22", barbarian:"#ff4422",
  king:"#ffcc00", recruit:"#aaddff", bomber:"#ff8800", toxic:"#44ff88", machinegunner:"#cc88ff",
};

const STATIC_CAMERAS: StaticCamera[] = [
  { name:"TOP",    pos:[0,14,0],    look:[0,0,0] },
  { name:"SIDE",   pos:[18,5,0],    look:[0,0,0] },
  { name:"CORNER", pos:[12,9,12],   look:[0,0,0] },
  { name:"INSIDE", pos:[0,0,0.1],   look:[3,1,3] },
];

const MAX_UNITS   = 32;
const MAX_PROJ    = 160;
const MAX_TURRETS = 16;
const MAX_BOMBS   = 24;
const TRAIL_LEN   = 8;

// ═══════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function rnd(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
function dist3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function initUnit(
  x: number, y: number, z: number,
  vx: number, vy: number, vz: number,
  type: UnitType,
  team: TeamId,
  customHp?: number
): Unit {
  const def = UNIT_DEFS[type];
  const hp  = customHp ?? def.hp;
  return {
    x, y, z, vx, vy, vz,
    hp, maxHp: hp,
    color: TEAM_HEX[team],
    type, team,
    radius: def.radius,
    id: Math.random(),
    fireTimer: 0, laserTimer: 0, laserActive: false,
    engineerTimer: 0, orbitAngle: Math.random() * Math.PI * 2,
    lastHpRatio: 1, recruitTimer: 0,
    bombTimer: 0,
    burstTimer: 0, burstShotsLeft: 0, burstFireTimer: 0,
    dots: [],
    alive: true,
  };
}

// ── Physics ──────────────────────────────────────────────────────
function stepPhysics(balls: Unit[], dt: number): Unit[] {
  const next: Unit[] = balls.map(b => ({ ...b, dots: [...b.dots] }));

  for (const b of next) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  }
  for (const b of next) {
    const r = b.radius || BALL_RADIUS, lim = HALF - r;
    if (b.x >  lim) { b.x =  lim; b.vx = -Math.abs(b.vx); }
    if (b.x < -lim) { b.x = -lim; b.vx =  Math.abs(b.vx); }
    if (b.y >  lim) { b.y =  lim; b.vy = -Math.abs(b.vy); }
    if (b.y < -lim) { b.y = -lim; b.vy =  Math.abs(b.vy); }
    if (b.z >  lim) { b.z =  lim; b.vz = -Math.abs(b.vz); }
    if (b.z < -lim) { b.z = -lim; b.vz =  Math.abs(b.vz); }
  }

  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const a = next[i], b = next[j];
      if (a.team === b.team) continue;
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const minD = (a.radius || BALL_RADIUS) + (b.radius || BALL_RADIUS);
      if (dist < minD && dist > 0.0001) {
        const ov = (minD - dist) / 2;
        const nx = dx / dist, ny = dy / dist, nz = dz / dist;
        a.x -= nx * ov; a.y -= ny * ov; a.z -= nz * ov;
        b.x += nx * ov; b.y += ny * ov; b.z += nz * ov;
        const dvx = b.vx - a.vx, dvy = b.vy - a.vy, dvz = b.vz - a.vz;
        const dot = dvx * nx + dvy * ny + dvz * nz;
        if (dot < 0) {
          a.vx += dot * nx; a.vy += dot * ny; a.vz += dot * nz;
          b.vx -= dot * nx; b.vy -= dot * ny; b.vz -= dot * nz;
          a.hp = clamp(a.hp - DAMAGE, 0, a.maxHp);
          b.hp = clamp(b.hp - DAMAGE, 0, b.maxHp);
        }
      }
    }
  }
  return next;
}

function stepProjectiles(
  projectiles: Projectile[],
  units:       Unit[],
  dt:          number
): Projectile[] {
  const next: Projectile[] = projectiles.map(p => ({ ...p })).filter(p => p.life > 0);

  for (const p of next) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.gravity) p.vy += p.gravity * dt;
    p.life -= dt;
    if (Math.abs(p.x) > HALF || Math.abs(p.y) > HALF || Math.abs(p.z) > HALF) {
      p.life = 0; continue;
    }
    for (const u of units) {
      if (u.team === p.team || u.hp <= 0) continue;
      if (dist3(u, p) < (u.radius || BALL_RADIUS) + 0.15) {
        u.hp = clamp(u.hp - p.dmg, 0, u.maxHp);
        if (p.dot) {
          u.dots.push({ remaining: p.dot.duration, dmg: p.dot.dmg, tickTimer: 0 });
        }
        p.life = 0; break;
      }
    }
  }
  return next.filter(p => p.life > 0);
}

function tickDots(unit: Unit, dt: number): void {
  if (!unit.dots || unit.dots.length === 0) return;
  unit.dots = unit.dots.filter(d => d.remaining > 0);
  for (const d of unit.dots) {
    d.tickTimer = (d.tickTimer || 0) + dt;
    if (d.tickTimer >= 1) {
      d.tickTimer -= 1;
      unit.hp = clamp(unit.hp - d.dmg, 0, unit.maxHp);
    }
    d.remaining -= dt;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MESH BUILDERS
// ═══════════════════════════════════════════════════════════════════
function buildSwordMesh(): THREE.Group {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.55, 0.04),
    new THREE.MeshStandardMaterial({ color:0xddeeff, emissive:0x6688ff, emissiveIntensity:0.5, metalness:0.95, roughness:0.05 })
  );
  blade.position.y = 0.1;
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.06, 0.05),
    new THREE.MeshStandardMaterial({ color:0xaaaacc, metalness:0.8, roughness:0.2 })
  );
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8),
    new THREE.MeshStandardMaterial({ color:0x553311, roughness:0.9 })
  );
  handle.position.y = -0.2;
  g.add(blade); g.add(guard); g.add(handle);
  return g;
}

function buildAxeMesh(): THREE.Group {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8),
    new THREE.MeshStandardMaterial({ color:0x4a2200, roughness:0.9 })
  );
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.35, 0.07),
    new THREE.MeshStandardMaterial({ color:0x998866, emissive:0xff4400, emissiveIntensity:0.15, metalness:0.8, roughness:0.2 })
  );
  head.position.set(0.15, 0.28, 0);
  g.add(handle); g.add(head);
  return g;
}

function buildBowMesh(): THREE.Group {
  const g = new THREE.Group();
  const bow = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.03, 6, 12, Math.PI),
    new THREE.MeshStandardMaterial({ color:0x885533, roughness:0.9 })
  );
  bow.rotation.z = Math.PI / 2;
  const string = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.56, 4),
    new THREE.MeshBasicMaterial({ color:0xeeddcc })
  );
  g.add(bow); g.add(string);
  return g;
}

function buildCrownMesh(): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.06, 6, 12),
    new THREE.MeshStandardMaterial({ color:0xffcc00, emissive:0xffaa00, emissiveIntensity:0.6, metalness:0.9, roughness:0.1 })
  );
  for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.2, 5),
      new THREE.MeshStandardMaterial({ color:0xffcc00, emissive:0xffdd00, emissiveIntensity:0.4, metalness:0.9 })
    );
    const angle = i * (Math.PI * 2 / 5);
    spike.position.set(Math.cos(angle) * 0.18, 0.12, Math.sin(angle) * 0.18);
    g.add(spike);
  }
  g.add(ring);
  return g;
}

function buildSpearMesh(): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.85, 6),
    new THREE.MeshStandardMaterial({ color:0x663300, roughness:0.9 })
  );
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.22, 6),
    new THREE.MeshStandardMaterial({ color:0xccccdd, metalness:0.8, roughness:0.2 })
  );
  tip.position.y = 0.54;
  g.add(shaft); g.add(tip);
  return g;
}

function buildDynamiteMesh(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.35, 8),
      new THREE.MeshStandardMaterial({ color:0xcc2200, roughness:0.8 })
    );
    stick.position.set((i - 1) * 0.16, 0, 0);
    stick.rotation.z = rnd(-0.2, 0.2);
    g.add(stick);
  }
  const fuse = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.25, 4),
    new THREE.MeshBasicMaterial({ color:0x888833 })
  );
  fuse.position.set(0, 0.3, 0);
  g.add(fuse);
  return g;
}

function buildKnifeMesh(): THREE.Group {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.38, 0.03),
    new THREE.MeshStandardMaterial({ color:0x44ff88, emissive:0x00cc44, emissiveIntensity:0.5, metalness:0.9, roughness:0.1 })
  );
  blade.rotation.z = 0.3;
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.18, 6),
    new THREE.MeshStandardMaterial({ color:0x221133, roughness:0.8 })
  );
  handle.position.y = -0.25;
  g.add(blade); g.add(handle);
  return g;
}

function buildMinigunMesh(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.12, 0.38),
    new THREE.MeshStandardMaterial({ color:0x555577, metalness:0.8, roughness:0.2 })
  );
  for (let i = 0; i < 4; i++) {
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6),
      new THREE.MeshStandardMaterial({ color:0x888888, metalness:0.9, roughness:0.1 })
    );
    barrel.rotation.x = Math.PI / 2;
    const a = i * Math.PI / 2;
    barrel.position.set(Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0.2);
    g.add(barrel);
  }
  g.add(body);
  return g;
}

function buildHelmetMesh(): THREE.Group {
  const g = new THREE.Group();
  const helm = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
    new THREE.MeshStandardMaterial({ color:0xffcc44, emissive:0xff9900, emissiveIntensity:0.25, metalness:0.8, roughness:0.2 })
  );
  g.add(helm);
  return g;
}

// ═══════════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function ArenaSim() {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SimState>({
    balls: [], projectiles: [], turrets: [], bombs: [],
    camMode: "FREE", yaw: 0, pitch: 0.3, orbitDist: 20,
    keys: {}, collisionFlash: 0, simRunning: false,
  });

  const [hp,         setHp]         = useState<Record<TeamId, number>>({ A: 100, B: 100 });
  const [camName,    setCamName]     = useState<CameraMode>("FREE");
  const [colliding,  setColliding]   = useState(false);
  const [countdown,  setCountdown]   = useState(5);
  const [simStarted, setSimStarted]  = useState(false);
  const [winner,     setWinner]      = useState<string | null>(null);
  const [unitHps,    setUnitHps]     = useState<UnitHpInfo[]>([]);
  const [configPhase,setConfigPhase] = useState(true);
  const winnerRef = useRef<string | null>(null);

  const [teamA, setTeamA] = useState<UnitConfig[]>([
    { type:"king",        hp:300 },
    { type:"swordsman",   hp:180 },
    { type:"archer",      hp:100 },
  ]);
  const [teamB, setTeamB] = useState<UnitConfig[]>([
    { type:"barbarian",    hp:150 },
    { type:"machinegunner",hp:140 },
    { type:"bomber",       hp:90  },
  ]);

  const switchCamera = useCallback((name: CameraMode) => {
    stateRef.current.camMode = name;
    setCamName(name);
  }, []);

  const buildRoster = useCallback((teamAcfg: UnitConfig[], teamBcfg: UnitConfig[]): Unit[] => {
    const units: Unit[] = [];
    const positions: [number, number, number][] = [
      [-3.5,0,-3.5],[-2,0,-3],[-3.5,0,0],[-2,0,3],[-3.5,0,3.5],
      [3.5,0,3.5],[2,0,3],[3.5,0,0],[2,0,-3],[3.5,0,-3.5],
    ];
    teamAcfg.forEach((cfg, i) => {
      const p = positions[i] ?? ([rnd(-4,4), 0, rnd(-4,4)] as [number,number,number]);
      units.push(initUnit(p[0], p[1], p[2], rnd(-3,3), rnd(-2,2), rnd(-3,3), cfg.type, "A", cfg.hp));
    });
    teamBcfg.forEach((cfg, i) => {
      const p = positions[5 + i] ?? ([rnd(-4,4), 0, rnd(-4,4)] as [number,number,number]);
      units.push(initUnit(p[0], p[1], p[2], rnd(-3,3), rnd(-2,2), rnd(-3,3), cfg.type, "B", cfg.hp));
    });
    return units;
  }, []);

  const startCountdown = useCallback(() => {
    setConfigPhase(false); setSimStarted(false);
    winnerRef.current = null; setWinner(null);
    const s = stateRef.current;
    s.balls       = buildRoster(teamA, teamB);
    s.projectiles = [];
    s.turrets     = [];
    s.bombs       = [];
    s.simRunning  = false;
    let c = 5; setCountdown(c);
    const iv = setInterval(() => {
      c--;
      if (c <= 0) { clearInterval(iv); setCountdown(0); setSimStarted(true); s.simRunning = true; }
      else setCountdown(c);
    }, 1000);
  }, [teamA, teamB, buildRoster]);

  // ─────────────────────────────────────────────────────────────────
  //  THREE.JS SETUP
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current!;
    const W  = () => el.clientWidth;
    const H  = () => el.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(W(), H());
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x050508);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050508, 0.035);

    const camera = new THREE.PerspectiveCamera(70, W() / H(), 0.1, 200);
    camera.position.set(0, 5, 20); camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0x112233, 1.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(8, 12, 8); dirLight.castShadow = true;
    scene.add(dirLight);
    const ptA = new THREE.PointLight(0x4488ff, 3, 14); scene.add(ptA);
    const ptB = new THREE.PointLight(0xff3344, 3, 14); scene.add(ptB);

    const arenaGeo = new THREE.BoxGeometry(ARENA, ARENA, ARENA);
    scene.add(new THREE.Mesh(arenaGeo, new THREE.MeshBasicMaterial({ color:0x223355, wireframe:true, transparent:true, opacity:0.3 })));
    const grid = new THREE.GridHelper(ARENA, 10, 0x1a2a4a, 0x0d1525);
    grid.position.y = -HALF + 0.01; scene.add(grid);
    scene.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(arenaGeo),
      new THREE.LineBasicMaterial({ color:0x3366cc })
    ));

    // ── Unit body mesh pool ────────────────────────────────────────
    const ballMeshes: THREE.Mesh[]                 = [];
    const ballMats:   THREE.MeshStandardMaterial[] = [];
    const trailPositions: ([number,number,number]|undefined)[][] = [];
    const trailMeshes:    THREE.Mesh[][]           = [];

    for (let i = 0; i < MAX_UNITS; i++) {
      const col = 0x888888;
      const mat = new THREE.MeshStandardMaterial({ color:col, emissive:col, emissiveIntensity:0.5, roughness:0.3, metalness:0.5 });
      ballMats.push(mat);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 20, 20), mat);
      mesh.castShadow = true; mesh.visible = false;
      scene.add(mesh); ballMeshes.push(mesh);
      trailPositions.push([]);
      const tArr: THREE.Mesh[] = [];
      for (let t = 0; t < TRAIL_LEN; t++) {
        const r  = BALL_RADIUS * (1 - t / TRAIL_LEN) * 0.5;
        const tm = new THREE.Mesh(
          new THREE.SphereGeometry(r, 5, 5),
          new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:(1 - t / TRAIL_LEN) * 0.18 })
        );
        tm.visible = false; scene.add(tm); tArr.push(tm);
      }
      trailMeshes.push(tArr);
    }

    // ── Prop mesh pool ─────────────────────────────────────────────
    const propGroups: PropEntry[] = [];
    for (let i = 0; i < MAX_UNITS; i++) {
      const container = new THREE.Group();
      container.visible = false;
      scene.add(container);
      const props: PropSet = {
        sword:    buildSwordMesh(),
        axe:      buildAxeMesh(),
        bow:      buildBowMesh(),
        crown:    buildCrownMesh(),
        spear:    buildSpearMesh(),
        dynamite: buildDynamiteMesh(),
        knife:    buildKnifeMesh(),
        minigun:  buildMinigunMesh(),
        helmet:   buildHelmetMesh(),
      };
      Object.values(props).forEach(p => { container.add(p); p.visible = false; });
      propGroups.push({ container, props });
    }

    // ── Laser ray pool ─────────────────────────────────────────────
    const laserMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < MAX_UNITS; i++) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1, 8),
        new THREE.MeshBasicMaterial({ color:0xff44ff, transparent:true, opacity:0.85 })
      );
      m.visible = false; scene.add(m); laserMeshes.push(m);
    }

    // ── Projectile pool ────────────────────────────────────────────
    const projMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < MAX_PROJ; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 5, 5),
        new THREE.MeshBasicMaterial({ color:0xffff44, transparent:true, opacity:0.9 })
      );
      m.visible = false; scene.add(m); projMeshes.push(m);
    }

    // ── Turret pool ────────────────────────────────────────────────
    const turretMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < MAX_TURRETS; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.55, 0.4),
        new THREE.MeshStandardMaterial({ color:0xffaa22, emissive:0xffaa22, emissiveIntensity:0.35, metalness:0.7 })
      );
      m.visible = false; scene.add(m); turretMeshes.push(m);
    }

    // ── Bomb pool ──────────────────────────────────────────────────
    const bombMeshes: THREE.Group[] = [];
    for (let i = 0; i < MAX_BOMBS; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 10),
        new THREE.MeshStandardMaterial({ color:0x111111, emissive:0xff4400, emissiveIntensity:0.2 })
      );
      const fuse = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4),
        new THREE.MeshBasicMaterial({ color:0x999933 })
      );
      fuse.position.y = 0.28;
      g.add(body); g.add(fuse);
      g.visible = false; scene.add(g); bombMeshes.push(g);
    }

    // ── Explosion flash pool ───────────────────────────────────────
    const explMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < MAX_BOMBS; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(1, 10, 10),
        new THREE.MeshBasicMaterial({ color:0xff6600, transparent:true, opacity:0 })
      );
      m.visible = false; scene.add(m); explMeshes.push(m);
    }
    const explTimers: number[] = new Array<number>(MAX_BOMBS).fill(0);

    // ── Collision flash plane ──────────────────────────────────────
    const flashMat   = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0, depthTest:false });
    const flashPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), flashMat);
    flashPlane.renderOrder = 999; scene.add(flashPlane);

    // ── Input ──────────────────────────────────────────────────────
    const s = stateRef.current;
    const onKeyDown = (e: KeyboardEvent) => { s.keys[e.code] = true;  };
    const onKeyUp   = (e: KeyboardEvent) => { s.keys[e.code] = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup",   onKeyUp);

    const onResize = () => {
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
      renderer.setSize(W(), H());
    };
    window.addEventListener("resize", onResize);

    // ════════════════════════════════════════════════════════════
    //  ANIMATION LOOP
    // ════════════════════════════════════════════════════════════
    let lastTime = performance.now(), globalTime = 0, raf = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      const dt  = Math.min((now - lastTime) / 1000, 0.05);
      lastTime  = now; globalTime += dt;

      const s = stateRef.current;

      // ── Camera ──
      const TURN = 1.4 * dt, ZOOM = 6 * dt;
      if (s.camMode === "FREE") {
        if (s.keys["ArrowLeft"])  s.yaw   += TURN;
        if (s.keys["ArrowRight"]) s.yaw   -= TURN;
        if (s.keys["ArrowUp"])    s.pitch  = clamp(s.pitch + TURN, -1.4, 1.4);
        if (s.keys["ArrowDown"])  s.pitch  = clamp(s.pitch - TURN, -1.4, 1.4);
        if (s.keys["Equal"]    || s.keys["NumpadAdd"])      s.orbitDist = clamp(s.orbitDist - ZOOM, 4, 44);
        if (s.keys["Minus"]    || s.keys["NumpadSubtract"]) s.orbitDist = clamp(s.orbitDist + ZOOM, 4, 44);
        camera.position.set(
          Math.cos(s.pitch) * Math.sin(s.yaw) * s.orbitDist,
          Math.sin(s.pitch) * s.orbitDist,
          Math.cos(s.pitch) * Math.cos(s.yaw) * s.orbitDist
        );
        camera.lookAt(0, 0, 0);
      } else {
        const sc = STATIC_CAMERAS.find(c => c.name === s.camMode);
        if (sc) { camera.position.set(...sc.pos); camera.lookAt(...sc.look); }
      }

      if (!s.simRunning) { renderer.render(scene, camera); return; }

      // ── Physics ──
      const prev = s.balls;
      const next = stepPhysics(prev, dt);

      // ── Collision flash ──
      const anyHit = prev.some((p, i) => next[i] && p.hp !== next[i].hp);
      if (anyHit) { s.collisionFlash = 0.35; setColliding(true); setTimeout(() => setColliding(false), 350); }
      if (s.collisionFlash > 0) { s.collisionFlash -= dt; flashMat.opacity = clamp(s.collisionFlash * 1.2, 0, 0.18); }
      else flashMat.opacity = 0;

      // ── DOT ticks ──
      for (const u of next) tickDots(u, dt);

      // ── Unit behaviours ────────────────────────────────────────
      const newProj:    Projectile[] = [...s.projectiles];
      const spawnUnits: Unit[]       = [];

      for (const u of next) {
        if (u.hp <= 0) continue;

        // SWORDSMAN
        if (u.type === "swordsman") {
          const def = UNIT_DEFS.swordsman;
          u.orbitAngle += def.orbitSpeed * dt;
          const wx = u.x + Math.cos(u.orbitAngle) * def.orbitR;
          const wz = u.z + Math.sin(u.orbitAngle) * def.orbitR;
          for (const e of next) {
            if (e.team === u.team || e.hp <= 0) continue;
            const dx = e.x - wx, dz = e.z - wz;
            if (Math.sqrt(dx * dx + dz * dz) < (e.radius || BALL_RADIUS) + 0.2)
              e.hp = clamp(e.hp - def.swingDmg * dt, 0, e.maxHp);
          }
        }

        // BARBARIAN
        if (u.type === "barbarian") {
          const def = UNIT_DEFS.barbarian;
          const spd = def.axeOrbitSpeedBase * (1 + (1 - u.hp / u.maxHp) * 2.5);
          u.orbitAngle += spd * dt;
          const wx = u.x + Math.cos(u.orbitAngle) * def.axeOrbitR;
          const wz = u.z + Math.sin(u.orbitAngle) * def.axeOrbitR;
          for (const e of next) {
            if (e.team === u.team || e.hp <= 0) continue;
            const dx = e.x - wx, dz = e.z - wz;
            if (Math.sqrt(dx * dx + dz * dz) < (e.radius || BALL_RADIUS) + 0.22)
              e.hp = clamp(e.hp - def.axeDmg * dt, 0, e.maxHp);
          }
        }

        // ARCHER
        if (u.type === "archer") {
          const def = UNIT_DEFS.archer;
          u.fireTimer -= dt;
          if (u.fireTimer <= 0) {
            u.fireTimer = 1 / def.fireRate;
            let nd = Infinity, nt: Unit | null = null;
            for (const e of next) { if (e.team !== u.team && e.hp > 0) { const d = dist3(u, e); if (d < nd) { nd = d; nt = e; } } }
            if (nt) {
              const dx = nt.x - u.x, dy = nt.y - u.y, dz = nt.z - u.z;
              const d  = Math.max(Math.sqrt(dx*dx + dy*dy + dz*dz), 0.01);
              const sp = def.spread;
              newProj.push({ x:u.x, y:u.y, z:u.z,
                vx:(dx/d + rnd(-sp,sp)) * def.projSpeed,
                vy:(dy/d + rnd(0,0.25)) * def.projSpeed,
                vz:(dz/d + rnd(-sp,sp)) * def.projSpeed,
                gravity:def.gravity, dmg:def.projDmg, team:u.team, life:3.5, color:TEAM_HEX[u.team], dot:null });
            }
          }
        }

        // LASER
        if (u.type === "laser") {
          const def = UNIT_DEFS.laser;
          u.laserTimer -= dt;
          if (u.laserTimer <= 0) { u.laserActive = !u.laserActive; u.laserTimer = u.laserActive ? def.active : def.cooldown; }
          if (u.laserActive) {
            u.orbitAngle += 1.5 * dt;
            const rdx = Math.cos(u.orbitAngle), rdz = Math.sin(u.orbitAngle);
            for (const e of next) {
              if (e.team === u.team || e.hp <= 0) continue;
              const ex = e.x - u.x, ez = e.z - u.z;
              const t  = ex * rdx + ez * rdz;
              if (t > 0 && t < 9) {
                const px = ex - t * rdx, pz = ez - t * rdz;
                if (Math.sqrt(px*px + pz*pz) < (e.radius || BALL_RADIUS) + 0.28)
                  e.hp = clamp(e.hp - def.dmgPerSec * dt, 0, e.maxHp);
              }
            }
          }
        }

        // ENGINEER
        if (u.type === "engineer") {
          const def = UNIT_DEFS.engineer;
          u.engineerTimer -= dt;
          if (u.engineerTimer <= 0) {
            u.engineerTimer = def.spawnRate;
            if (s.turrets.length < MAX_TURRETS)
              s.turrets.push({ x:u.x + rnd(-1.2,1.2), y:u.y, z:u.z + rnd(-1.2,1.2), team:u.team, fireTimer:0, alive:true });
          }
        }

        // KING
        if (u.type === "king") {
          const def      = UNIT_DEFS.king;
          const hpRatio  = u.hp / u.maxHp;
          for (const e of next) {
            if (e.team === u.team || e.hp <= 0) continue;
            if (dist3(u, e) < (u.radius || BALL_RADIUS) + (e.radius || BALL_RADIUS) + 0.3)
              e.hp = clamp(e.hp - def.crownDmg * dt, 0, e.maxHp);
          }
          if (u.lastHpRatio - hpRatio >= def.recruitHpThreshold && spawnUnits.length < 6) {
            u.lastHpRatio = hpRatio;
            spawnUnits.push(initUnit(u.x + rnd(-1,1), u.y, u.z + rnd(-1,1), rnd(-3,3), 0, rnd(-3,3), "recruit", u.team, 10));
          }
        }

        // RECRUIT
        if (u.type === "recruit") {
          const def = UNIT_DEFS.recruit;
          u.fireTimer -= dt;
          if (u.fireTimer <= 0) {
            u.fireTimer = 1 / def.spearRate;
            let nd = Infinity, nt: Unit | null = null;
            for (const e of next) { if (e.team !== u.team && e.hp > 0) { const d = dist3(u, e); if (d < nd) { nd = d; nt = e; } } }
            if (nt && nd < def.spearRange + u.radius)
              nt.hp = clamp(nt.hp - def.spearDmg, 0, nt.maxHp);
            if (nt) {
              const dx = nt.x - u.x, dz = nt.z - u.z;
              u.orbitAngle = Math.atan2(dz, dx);
            }
          }
        }

        // BOMBER
        if (u.type === "bomber") {
          const def = UNIT_DEFS.bomber;
          u.bombTimer -= dt;
          if (u.bombTimer <= 0) {
            u.bombTimer = def.bombInterval;
            if (s.bombs.length < MAX_BOMBS)
              s.bombs.push({ x:u.x, y:u.y, z:u.z, timer:3, team:u.team, exploded:false, flashIdx:-1 });
          }
        }

        // TOXIC
        if (u.type === "toxic") {
          const def = UNIT_DEFS.toxic;
          u.orbitAngle += 2.5 * dt;
          const wx = u.x + Math.cos(u.orbitAngle) * def.knifeR;
          const wz = u.z + Math.sin(u.orbitAngle) * def.knifeR;
          for (const e of next) {
            if (e.team === u.team || e.hp <= 0) continue;
            const dx = e.x - wx, dz = e.z - wz;
            if (Math.sqrt(dx*dx + dz*dz) < (e.radius || BALL_RADIUS) + 0.18) {
              e.hp = clamp(e.hp - def.knifeDmg * dt, 0, e.maxHp);
              if (e.dots.filter(d => d.remaining > 0).length < 3)
                e.dots.push({ remaining:def.dotDuration, dmg:def.dotDmg, tickTimer:0 });
            }
          }
        }

        // MACHINEGUNNER
        if (u.type === "machinegunner") {
          const def = UNIT_DEFS.machinegunner;
          u.burstTimer -= dt;
          if (u.burstTimer <= 0 && u.burstShotsLeft === 0) {
            u.burstTimer = def.burstInterval;
            u.burstShotsLeft = def.burstCount;
            u.burstFireTimer = 0;
          }
          if (u.burstShotsLeft > 0) {
            u.burstFireTimer -= dt;
            if (u.burstFireTimer <= 0) {
              u.burstFireTimer = 0.08;
              u.burstShotsLeft--;
              let nd = Infinity, nt: Unit | null = null;
              for (const e of next) { if (e.team !== u.team && e.hp > 0) { const d = dist3(u, e); if (d < nd) { nd = d; nt = e; } } }
              if (nt) {
                const dx = nt.x - u.x, dy = nt.y - u.y, dz = nt.z - u.z;
                const d  = Math.max(Math.sqrt(dx*dx + dy*dy + dz*dz), 0.01);
                const sp = def.bulletSpread;
                newProj.push({ x:u.x, y:u.y + 0.15, z:u.z,
                  vx:(dx/d + rnd(-sp,sp)) * def.bulletSpeed,
                  vy:(dy/d + rnd(-sp*0.5,sp*0.5)) * def.bulletSpeed,
                  vz:(dz/d + rnd(-sp,sp)) * def.bulletSpeed,
                  gravity:-2, dmg:def.bulletDmg, team:u.team, life:2.5, color:TEAM_HEX[u.team], dot:null });
              }
            }
          }
        }
      } // end unit behaviours

      for (const r of spawnUnits) next.push(r);

      // ── Turrets ──
      for (const turret of s.turrets) {
        if (!turret.alive) continue;
        turret.fireTimer -= dt;
        if (turret.fireTimer <= 0) {
          turret.fireTimer = 1.5;
          for (let shot = 0; shot < 2; shot++) {
            const ang = Math.random() * Math.PI * 2;
            newProj.push({ x:turret.x, y:turret.y + 0.3, z:turret.z,
              vx:Math.cos(ang) * 5, vy:rnd(-0.3,0.4) * 5, vz:Math.sin(ang) * 5,
              gravity:-3, dmg:UNIT_DEFS.engineer.turretProjDmg,
              team:turret.team, life:2.5, color:TEAM_HEX[turret.team], dot:null });
          }
        }
      }

      // ── Bombs ──
      for (let bi = 0; bi < s.bombs.length; bi++) {
        const bomb = s.bombs[bi];
        if (bomb.exploded) continue;
        bomb.timer -= dt;
        if (bomb.timer <= 0) {
          bomb.exploded = true;
          const bombDef = UNIT_DEFS.bomber;
          for (const u of next) {
            if (u.hp <= 0) continue;
            const d = dist3(u, bomb);
            if (d < bombDef.bombRadius)
              u.hp = clamp(u.hp - bombDef.bombDmg * (1 - d / bombDef.bombRadius), 0, u.maxHp);
          }
          const fi = bi % MAX_BOMBS;
          explTimers[fi] = 0.45;
          explMeshes[fi].position.set(bomb.x, bomb.y, bomb.z);
          explMeshes[fi].scale.set(bombDef.bombRadius, bombDef.bombRadius, bombDef.bombRadius);
          explMeshes[fi].visible = true;
          s.collisionFlash = 0.4;
        }
      }
      s.bombs = s.bombs.filter(b => b.timer > -1);

      s.projectiles = stepProjectiles(newProj, next, dt);
      s.balls       = next;

      // ── Winner check ──
      if (!winnerRef.current) {
        const aAlive = next.filter(u => u.team === "A" && u.hp > 0).length;
        const bAlive = next.filter(u => u.team === "B" && u.hp > 0).length;
        if (aAlive === 0 || bAlive === 0) {
          const w = aAlive === 0 && bAlive === 0 ? "DRAW" : aAlive === 0 ? "TEAM B WINS" : "TEAM A WINS";
          winnerRef.current = w; setWinner(w); s.simRunning = false;
        }
      }

      // ═══ RENDER SYNC ═════════════════════════════════════════════

      for (let i = 0; i < MAX_UNITS; i++) {
        const u    = next[i];
        const mesh = ballMeshes[i];
        const pg   = propGroups[i];
        if (!u || u.hp <= 0) {
          mesh.visible = false; pg.container.visible = false; laserMeshes[i].visible = false; continue;
        }
        mesh.visible = true;
        mesh.position.set(u.x, u.y, u.z);
        ballMats[i].color.setHex(u.color);
        ballMats[i].emissive.setHex(u.color);
        ballMats[i].emissiveIntensity = 0.3 + 0.7 * (1 - u.hp / u.maxHp);

        trailPositions[i].unshift([u.x, u.y, u.z]);
        if (trailPositions[i].length > TRAIL_LEN) trailPositions[i].pop();
        for (let t = 0; t < TRAIL_LEN; t++) {
          const tp = trailPositions[i][t];
          if (tp) { trailMeshes[i][t].visible = true; trailMeshes[i][t].position.set(tp[0], tp[1], tp[2]); }
          else      trailMeshes[i][t].visible = false;
        }

        const props = pg.props;
        Object.values(props).forEach(p => { p.visible = false; });
        pg.container.visible = true;

        switch (u.type) {
          case "swordsman": {
            props.sword.visible = true;
            const r = UNIT_DEFS.swordsman.orbitR;
            pg.container.position.set(u.x + Math.cos(u.orbitAngle)*r, u.y, u.z + Math.sin(u.orbitAngle)*r);
            pg.container.rotation.y = -u.orbitAngle;
            break;
          }
          case "barbarian": {
            props.axe.visible = true;
            const r = UNIT_DEFS.barbarian.axeOrbitR;
            pg.container.position.set(u.x + Math.cos(u.orbitAngle)*r, u.y, u.z + Math.sin(u.orbitAngle)*r);
            pg.container.rotation.y = -u.orbitAngle;
            break;
          }
          case "archer": {
            props.bow.visible = true;
            pg.container.position.set(u.x + 0.4, u.y, u.z);
            const bowPull = Math.sin(globalTime * UNIT_DEFS.archer.fireRate * Math.PI) * 0.08;
            props.bow.position.x = bowPull;
            break;
          }
          case "engineer": {
            props.helmet.visible = true;
            pg.container.position.set(u.x, u.y + (BALL_RADIUS + 0.15), u.z);
            break;
          }
          case "king": {
            props.crown.visible = true;
            pg.container.position.set(u.x, u.y + (BALL_RADIUS * 1.2 + 0.18), u.z);
            pg.container.rotation.y = globalTime * 0.5;
            break;
          }
          case "recruit": {
            props.spear.visible = true;
            pg.container.position.set(u.x, u.y, u.z);
            pg.container.rotation.y = -u.orbitAngle;
            props.spear.position.set(0.6, 0, 0);
            break;
          }
          case "bomber": {
            props.dynamite.visible = true;
            pg.container.position.set(u.x + 0.4, u.y, u.z);
            const fuseChild = props.dynamite.children[3] as THREE.Mesh | undefined;
            if (fuseChild) {
              (fuseChild.material as THREE.MeshBasicMaterial).color.setHex(
                Math.sin(globalTime * 8) > 0 ? 0xffdd00 : 0x888833
              );
            }
            break;
          }
          case "toxic": {
            props.knife.visible = true;
            const kr = UNIT_DEFS.toxic.knifeR;
            pg.container.position.set(u.x + Math.cos(u.orbitAngle)*kr, u.y, u.z + Math.sin(u.orbitAngle)*kr);
            pg.container.rotation.y = -u.orbitAngle + globalTime * 2;
            break;
          }
          case "machinegunner": {
            props.minigun.visible = true;
            pg.container.position.set(u.x, u.y, u.z);
            if (u.burstShotsLeft > 0) props.minigun.rotation.z += 0.3;
            break;
          }
          case "laser":
          default:
            pg.container.visible = false;
        }

        // Laser ray sync
        const lm = laserMeshes[i];
        if (u.type === "laser" && u.laserActive) {
          const rayLen = 8;
          lm.visible = true;
          lm.position.set(u.x + Math.cos(u.orbitAngle)*rayLen/2, u.y, u.z + Math.sin(u.orbitAngle)*rayLen/2);
          lm.rotation.set(0, -u.orbitAngle, Math.PI / 2);
          lm.scale.set(1, rayLen, 1);
          (lm.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.4 * Math.sin(globalTime * 14);
        } else { lm.visible = false; }
      }

      // ── Point lights follow team leaders ──
      const aLeader = next.find(u => u.team === "A" && u.hp > 0);
      const bLeader = next.find(u => u.team === "B" && u.hp > 0);
      if (aLeader) ptA.position.set(aLeader.x, aLeader.y, aLeader.z);
      if (bLeader) ptB.position.set(bLeader.x, bLeader.y, bLeader.z);

      // ── Projectile meshes ──
      for (let i = 0; i < MAX_PROJ; i++) {
        const p = s.projectiles[i], pm = projMeshes[i];
        if (p) { pm.visible = true; pm.position.set(p.x, p.y, p.z); (pm.material as THREE.MeshBasicMaterial).color.setHex(p.color); }
        else pm.visible = false;
      }

      // ── Turret meshes ──
      for (let i = 0; i < MAX_TURRETS; i++) {
        const t  = s.turrets[i];
        const tm = turretMeshes[i];
        if (t && t.alive) {
          tm.visible = true; tm.position.set(t.x, t.y, t.z);
          const tmat = tm.material as THREE.MeshStandardMaterial;
          tmat.color.setHex(TEAM_HEX[t.team]);
          tmat.emissive.setHex(TEAM_HEX[t.team]);
        } else tm.visible = false;
      }

      // ── Bomb meshes ──
      for (let i = 0; i < MAX_BOMBS; i++) {
        const bomb = s.bombs[i];
        const bm   = bombMeshes[i];
        if (bomb && !bomb.exploded) {
          bm.visible = true; bm.position.set(bomb.x, bomb.y, bomb.z);
          if (bomb.timer < 1.5)
            (bm.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material.emissiveIntensity =
              0.2 + 0.6 * Math.sin(globalTime * 20);
        } else bm.visible = false;

        if (explTimers[i] > 0) {
          explTimers[i] -= dt;
          explMeshes[i].visible = true;
          (explMeshes[i].material as THREE.MeshBasicMaterial).opacity = clamp(explTimers[i] * 2.5, 0, 0.7);
          explMeshes[i].scale.setScalar(UNIT_DEFS.bomber.bombRadius * (1 + (0.45 - explTimers[i]) * 3));
        } else { explMeshes[i].visible = false; }
      }

      // ── HP state ──
      const aAvg = (() => { const a = next.filter(u => u.team === "A"); return a.length ? a.reduce((s,u) => s + u.hp, 0) / a.length : 0; })();
      const bAvg = (() => { const a = next.filter(u => u.team === "B"); return a.length ? a.reduce((s,u) => s + u.hp, 0) / a.length : 0; })();
      setHp(prev => {
        if (Math.abs(prev.A - aAvg) < 0.5 && Math.abs(prev.B - bAvg) < 0.5) return prev;
        return { A: aAvg, B: bAvg };
      });
      setUnitHps(next.map(u => ({ type:u.type, team:u.team, hp:u.hp, maxHp:u.maxHp, dots:u.dots?.length || 0 })));

      flashPlane.position.copy(camera.position);
      flashPlane.quaternion.copy(camera.quaternion);
      flashPlane.translateZ(-0.5);
      flashPlane.scale.set(100, 100, 1);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup",   onKeyUp);
      window.removeEventListener("resize",  onResize);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  //  UI
  // ═══════════════════════════════════════════════════════════════════
  interface HpBarProps {
    label:    string;
    value:    number;
    maxValue: number;
    color:    string;
    dots:     number;
  }

  const HpBar = ({ label, value, maxValue, color, dots }: HpBarProps) => (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display:"flex", justifyContent:"space-between", color:"#aabbcc", fontSize:9, letterSpacing:"0.06em", fontFamily:"'Courier New',monospace", marginBottom:2, textTransform:"uppercase" }}>
        <span>{label}{dots > 0 ? <span style={{ color:"#44ff88", marginLeft:4 }}>●DOT</span> : ""}</span>
        <span>{Math.round(value)}/{Math.round(maxValue || 100)}</span>
      </div>
      <div style={{ width:152, height:4, background:"#0d1a2a", borderRadius:2, overflow:"hidden", border:"1px solid #1a3050" }}>
        <div style={{ width:`${(value / (maxValue || 100)) * 100}%`, height:"100%", background:`linear-gradient(90deg,${color}88,${color})`, borderRadius:2, transition:"width 0.08s", boxShadow:`0 0 4px ${color}` }}/>
      </div>
    </div>
  );

  const addUnit = (team: TeamId, type: UnitType) => {
    const maxPerTeam = 6;
    if (team === "A" && teamA.length < maxPerTeam) setTeamA(prev => [...prev, { type, hp: UNIT_DEFS[type].hp }]);
    if (team === "B" && teamB.length < maxPerTeam) setTeamB(prev => [...prev, { type, hp: UNIT_DEFS[type].hp }]);
  };
  const removeUnit = (team: TeamId, idx: number) => {
    if (team === "A") setTeamA(prev => prev.filter((_, i) => i !== idx));
    if (team === "B") setTeamB(prev => prev.filter((_, i) => i !== idx));
  };
  const changeHp = (team: TeamId, idx: number, val: string) => {
    const v = clamp(parseInt(val) || 10, 5, 999);
    if (team === "A") setTeamA(prev => prev.map((u, i) => i === idx ? { ...u, hp: v } : u));
    if (team === "B") setTeamB(prev => prev.map((u, i) => i === idx ? { ...u, hp: v } : u));
  };

  const panelStyle: React.CSSProperties = {
    position:"absolute", padding:"14px 16px",
    background:"rgba(4,7,14,0.88)", backdropFilter:"blur(12px)",
    border:"1px solid #1a3050", borderRadius:8, userSelect:"none",
  };
  const mono: React.CSSProperties = { fontFamily:"'Courier New',monospace" };

  return (
    <div style={{ width:"100vw", height:"100vh", overflow:"hidden", background:"#050508", position:"relative" }}>
      <div ref={mountRef} style={{ width:"100%", height:"100%" }}/>

      {(configPhase || !simStarted || winner) && (
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", overflowY:"auto", background:"rgba(2,4,10,0.93)", backdropFilter:"blur(8px)", ...mono, zIndex:100, paddingTop:30, paddingBottom:30 }}>

          {winner ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flex:1 }}>
              <div style={{ fontSize:11, color:"#334455", letterSpacing:"0.3em", marginBottom:18 }}>◈ BATTLE RESOLVED</div>
              <div style={{ fontSize:46, fontWeight:"bold", letterSpacing:"0.15em", color:winner.includes("A") ? "#4488ff" : winner.includes("B") ? "#ff3344" : "#ffcc00", textShadow:"0 0 50px currentColor", marginBottom:30 }}>
                {winner}
              </div>
              <button onClick={() => { setSimStarted(false); setConfigPhase(true); setWinner(null); winnerRef.current = null; }}
                style={{ padding:"10px 30px", background:"transparent", border:"1px solid #4488ff", color:"#4488ff", ...mono, fontSize:12, letterSpacing:"0.2em", cursor:"pointer", borderRadius:4, boxShadow:"0 0 20px #4488ff44" }}>
                ◈ REMATCH
              </button>
            </div>

          ) : configPhase ? (
            <>
              <div style={{ fontSize:10, color:"#4488ff", letterSpacing:"0.35em", marginBottom:6, opacity:0.6 }}>◈ ARENA BATTLE SIM v3.0</div>
              <div style={{ fontSize:20, color:"#fff", letterSpacing:"0.18em", marginBottom:28, textShadow:"0 0 28px #4488ff88" }}>ASSEMBLE YOUR ARMIES</div>

              <div style={{ display:"flex", gap:32, marginBottom:28, alignItems:"flex-start", flexWrap:"wrap", justifyContent:"center" }}>
                {(["A","B"] as TeamId[]).map(team => (
                  <div key={team} style={{ minWidth:280 }}>
                    <div style={{ color:TEAM_CSS[team], fontSize:11, letterSpacing:"0.25em", marginBottom:12, textAlign:"center", textTransform:"uppercase" }}>
                      ◈ TEAM {team}
                    </div>
                    <div style={{ marginBottom:10 }}>
                      {(team === "A" ? teamA : teamB).map((cfg, idx) => (
                        <div key={idx} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5, padding:"5px 8px", background:"rgba(255,255,255,0.03)", border:"1px solid #1a3050", borderRadius:4 }}>
                          <span style={{ fontSize:13 }}>{TYPE_ICONS[cfg.type]}</span>
                          <span style={{ color:TYPE_COLORS_CSS[cfg.type], fontSize:10, flex:1, letterSpacing:"0.08em" }}>{cfg.type.toUpperCase()}</span>
                          <span style={{ color:"#445566", fontSize:9 }}>HP:</span>
                          <input type="number" value={cfg.hp} min={5} max={999}
                            onChange={e => changeHp(team, idx, e.target.value)}
                            style={{ width:50, background:"#0a1220", border:"1px solid #1a3050", color:"#88bbff", fontSize:10, padding:"2px 4px", borderRadius:3, ...mono }}/>
                          <button onClick={() => removeUnit(team, idx)}
                            style={{ background:"transparent", border:"1px solid #ff334440", color:"#ff3344", cursor:"pointer", borderRadius:3, padding:"2px 6px", fontSize:10, ...mono }}>✕</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ color:"#223344", fontSize:8, letterSpacing:"0.15em", marginBottom:6, textAlign:"center" }}>+ ADD UNIT (MAX 6)</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4, justifyContent:"center" }}>
                      {ALL_TYPES.map(t => (
                        <button key={t} onClick={() => addUnit(team, t)}
                          style={{ padding:"4px 7px", background:`${TYPE_COLORS_CSS[t]}12`, border:`1px solid ${TYPE_COLORS_CSS[t]}44`, color:TYPE_COLORS_CSS[t], cursor:"pointer", borderRadius:3, fontSize:10, ...mono, letterSpacing:"0.06em" }}>
                          {TYPE_ICONS[t]} {t.slice(0, 4).toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={startCountdown}
                style={{ padding:"13px 44px", background:"transparent", border:"1px solid #4488ff", color:"#4488ff", ...mono, fontSize:14, letterSpacing:"0.22em", cursor:"pointer", borderRadius:4, boxShadow:"0 0 28px #4488ff44", marginBottom:14 }}>
                ▶ START BATTLE
              </button>
              <div style={{ color:"#1a2a3a", fontSize:8, letterSpacing:"0.12em" }}>
                UNIT TYPES: {ALL_TYPES.length} · MAX 6 PER TEAM · HP CONFIGURABLE
              </div>
            </>

          ) : (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flex:1 }}>
              <div style={{ fontSize:12, color:"#4488ff", letterSpacing:"0.3em", marginBottom:24, opacity:0.6 }}>WHO WILL WIN?</div>
              <div style={{ display:"flex", gap:60, marginBottom:32, fontSize:11, letterSpacing:"0.15em" }}>
                <div style={{ color:"#4488ff", textAlign:"center" }}>
                  <div style={{ fontSize:22, marginBottom:8 }}>{teamA.map(u => TYPE_ICONS[u.type]).join(" ")}</div>
                  <div>TEAM A · {teamA.length} UNITS</div>
                </div>
                <div style={{ color:"#334455", alignSelf:"center", fontSize:13 }}>VS</div>
                <div style={{ color:"#ff3344", textAlign:"center" }}>
                  <div style={{ fontSize:22, marginBottom:8 }}>{teamB.map(u => TYPE_ICONS[u.type]).join(" ")}</div>
                  <div>TEAM B · {teamB.length} UNITS</div>
                </div>
              </div>
              <div style={{ fontSize:108, fontWeight:"bold", color:"#fff", lineHeight:1, textShadow:"0 0 80px #4488ff", ...mono }}>
                {countdown}
              </div>
              <div style={{ fontSize:10, color:"#1a2a3a", letterSpacing:"0.25em", marginTop:20 }}>BATTLE COMMENCING</div>
            </div>
          )}
        </div>
      )}

      {simStarted && !winner && (
        <div style={{ ...panelStyle, top:20, left:20, maxHeight:"calc(100vh - 60px)", overflowY:"auto", minWidth:200 }}>
          <div style={{ color:"#4488ff", fontSize:9, letterSpacing:"0.2em", ...mono, marginBottom:10, textTransform:"uppercase", opacity:0.65 }}>◈ ARENA SIM v3.0</div>
          <div style={{ color:"#4488ff", fontSize:8, letterSpacing:"0.15em", ...mono, marginBottom:6, opacity:0.45 }}>── TEAM A ──</div>
          {unitHps.filter(u => u.team === "A").map((u, i) => (
            <HpBar key={`a${i}`} label={`${TYPE_ICONS[u.type]} ${u.type}`} value={u.hp} maxValue={u.maxHp} color="#4488ff" dots={u.dots}/>
          ))}
          <div style={{ borderTop:"1px solid #0d1a2a", margin:"8px 0" }}/>
          <div style={{ color:"#ff3344", fontSize:8, letterSpacing:"0.15em", ...mono, marginBottom:6, opacity:0.45 }}>── TEAM B ──</div>
          {unitHps.filter(u => u.team === "B").map((u, i) => (
            <HpBar key={`b${i}`} label={`${TYPE_ICONS[u.type]} ${u.type}`} value={u.hp} maxValue={u.maxHp} color="#ff3344" dots={u.dots}/>
          ))}
          <div style={{ marginTop:8, fontSize:9, ...mono, color:colliding ? "#ffcc00" : "#1a3050", letterSpacing:"0.1em", transition:"color 0.1s", textAlign:"center" }}>
            {colliding ? "⚡ COLLISION" : "· NOMINAL ·"}
          </div>
        </div>
      )}

      <div style={{ ...panelStyle, top:20, right:20, minWidth:155 }}>
        <div style={{ color:"#4488ff", fontSize:9, letterSpacing:"0.2em", ...mono, marginBottom:10, textTransform:"uppercase", opacity:0.65 }}>◈ CAMERA</div>
        {(["FREE", ...STATIC_CAMERAS.map(c => c.name)] as CameraMode[]).map(name => (
          <button key={name} onClick={() => switchCamera(name)}
            style={{ display:"block", width:"100%", marginBottom:5, padding:"5px 10px", background:camName === name ? "rgba(68,136,255,0.18)" : "transparent", border:camName === name ? "1px solid #4488ff" : "1px solid #1a3050", borderRadius:4, cursor:"pointer", color:camName === name ? "#88bbff" : "#445566", ...mono, fontSize:10, letterSpacing:"0.1em", textAlign:"left", transition:"all 0.15s" }}>
            {camName === name ? "▶ " : "  "}{name}
          </button>
        ))}
        <div style={{ marginTop:8, paddingTop:8, borderTop:"1px solid #0d1a2a", color:"#1a2a3a", fontSize:8, ...mono, lineHeight:"1.9" }}>
          FREE: ← → ↑ ↓ + −
        </div>
      </div>

      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"7px 18px", background:"rgba(5,8,16,0.82)", borderTop:"1px solid #0d1a2a", display:"flex", justifyContent:"space-between", alignItems:"center", ...mono, fontSize:9, color:"#1a2a3a", letterSpacing:"0.1em" }}>
        <span>ARENA 10×10×10 · 10 UNIT TYPES · DOT/AoE/BURST/SUMMON · THREE.JS</span>
        <span style={{ color:colliding ? "#ffcc0055" : "#1a2a3a", transition:"color 0.2s" }}>{colliding ? "IMPACT DETECTED" : "TRACKING..."}</span>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

// ═══════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════
const ARENA       = 5;
const HALF        = ARENA / 2;
const BALL_RADIUS = 0.6;

const INITIAL_SPEED_XZ: [number, number] = [-3, 3];
const INITIAL_SPEED_Y:  [number, number] = [-2, 2];

type TeamId   = "A" | "B";
type UnitType =
  | "swordsman" | "archer"   | "laser"  | "engineer"
  | "barbarian" | "king"     | "recruit"| "bomber"
  | "toxic"     | "machinegunner";

type ProjectileKind = "arrow" | "bullet" | "turret";
type DamageKind = "projectile" | "melee" | "laser" | "explosion" | "dot";
type SoundKind = DamageKind | "impact";

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
  fireTimer:      number;
  laserTimer:     number;
  laserActive:    boolean;
  engineerTimer:  number;
  orbitAngle:     number;
  lastHpRatio:    number;
  recruitTimer:   number;
  bombTimer:      number;
  burstTimer:     number;
  burstShotsLeft: number;
  burstFireTimer: number;
  dots: DotEffect[];
  alive: boolean;
  // target tracking
  targetX?: number;
  targetY?: number;
  targetZ?: number;
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
  kind:  ProjectileKind;
}

interface Turret {
  x: number; y: number; z: number;
  team:      TeamId;
  fireTimer: number;
  alive:     boolean;
  hp:        number;
  maxHp:     number;
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
  yaw:         number;
  pitch:       number;
  orbitDist:   number;
  keys:        Record<string, boolean>;
  collisionFlash: number;
  simRunning:  boolean;
  lastDamageKind: SoundKind | null;
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

const UNIT_DEFS: UnitDefs = {
  swordsman:    { hp:180, radius:BALL_RADIUS,       color:0x44ddff, swingDmg:6,   orbitR:1.2,  orbitSpeed:2.8 },
  archer:       { hp:100, radius:BALL_RADIUS*0.9,   color:0x88ff44, projSpeed:9,  projDmg:14,  fireRate:1.6, spread:0.18, gravity:-4 },
  laser:        { hp:120, radius:BALL_RADIUS,        color:0xff44ff, cooldown:5,   active:5,    dmgPerSec:22 },
  engineer:     { hp:130, radius:BALL_RADIUS,        color:0xffaa22, spawnRate:10, turretProjDmg:8 },
  barbarian:    { hp:150, radius:BALL_RADIUS*1.05,  color:0xff4422, axeOrbitR:1.3, axeOrbitSpeedBase:3.5, axeDmg:0.05 },
  king:         { hp:300, radius:BALL_RADIUS*1.2,   color:0xffcc00, crownDmg:20,  recruitHpThreshold:0.2 },
  recruit:      { hp:10,  radius:BALL_RADIUS*0.7,   color:0xaaddff, spearDmg:3,   spearRange:1.4, spearRate:0.8 },
  bomber:       { hp:90,  radius:BALL_RADIUS,        color:0xff8800, bombInterval:3, bombRadius:3, bombDmg:20 },
  toxic:        { hp:110, radius:BALL_RADIUS,        color:0x44ff88, knifeR:1.1,   knifeDmg:2,  dotDmg:1, dotDuration:5 },
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

const MAX_UNITS   = 32;
const MAX_PROJ    = 160;
const MAX_TURRETS = 16;
const MAX_BOMBS   = 24;
const TRAIL_LEN   = 8;

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

function applyDamage(unit: Unit, amount: number, kind: DamageKind, onDamage?: (kind: DamageKind) => void): void {
  if (amount <= 0 || unit.hp <= 0) return;
  // Swordsman gets 50% damage reduction while hp > 50%
  let actualAmount = amount;
  if (unit.type === "swordsman" && unit.hp / unit.maxHp > 0.5) {
    actualAmount = amount * 0.5;
  }
  const before = unit.hp;
  unit.hp = clamp(unit.hp - actualAmount, 0, unit.maxHp);
  if (unit.hp < before) onDamage?.(kind);
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

function stepPhysics(balls: Unit[], dt: number, onImpact?: () => void): Unit[] {
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
          onImpact?.();
        }
      }
    }
  }
  return next;
}

function stepProjectiles(
  projectiles: Projectile[],
  units:       Unit[],
  turrets:     Turret[],
  dt:          number,
  onDamage?:   (kind: DamageKind) => void
): Projectile[] {
  const next: Projectile[] = projectiles.map(p => ({ ...p })).filter(p => p.life > 0);

  for (const p of next) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.gravity) p.vy += p.gravity * dt;
    p.life -= dt;
    if (Math.abs(p.x) > HALF || Math.abs(p.y) > HALF || Math.abs(p.z) > HALF) {
      p.life = 0; continue;
    }
    // Check turret hits (enemy projectiles can destroy turrets)
    let hitTurret = false;
    for (const t of turrets) {
      if (!t.alive || t.team === p.team) continue;
      if (dist3(t, p) < 0.4) {
        t.hp -= p.dmg;
        if (t.hp <= 0) t.alive = false;
        p.life = 0; hitTurret = true; break;
      }
    }
    if (hitTurret) continue;

    for (const u of units) {
      if (u.team === p.team || u.hp <= 0) continue;
      if (dist3(u, p) < (u.radius || BALL_RADIUS) + 0.15) {
        applyDamage(u, p.dmg, "projectile", onDamage);
        if (p.dot) {
          u.dots.push({ remaining: p.dot.duration, dmg: p.dot.dmg, tickTimer: 0 });
        }
        p.life = 0; break;
      }
    }
  }
  return next.filter(p => p.life > 0);
}

function tickDots(unit: Unit, dt: number, onDamage?: (kind: DamageKind) => void): void {
  if (!unit.dots || unit.dots.length === 0) return;
  unit.dots = unit.dots.filter(d => d.remaining > 0);
  for (const d of unit.dots) {
    d.tickTimer = (d.tickTimer || 0) + dt;
    if (d.tickTimer >= 1) {
      d.tickTimer -= 1;
      applyDamage(unit, d.dmg, "dot", onDamage);
    }
    d.remaining -= dt;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MESH BUILDERS — Enhanced
// ═══════════════════════════════════════════════════════════════════

function buildSwordMesh(): THREE.Group {
  const g = new THREE.Group();
  // Longer, more detailed blade
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.7, 0.05),
    new THREE.MeshStandardMaterial({ color:0xe8f4ff, emissive:0x6688ff, emissiveIntensity:0.7, metalness:0.98, roughness:0.02 })
  );
  blade.position.y = 0.18;
  // Fuller groove
  const fuller = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, 0.5, 0.06),
    new THREE.MeshStandardMaterial({ color:0xaaccff, emissive:0x8899ff, emissiveIntensity:0.5, metalness:1, roughness:0.01 })
  );
  fuller.position.y = 0.18;
  // Cross guard
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.07, 0.06),
    new THREE.MeshStandardMaterial({ color:0xbbbbdd, metalness:0.9, roughness:0.15 })
  );
  guard.position.y = -0.18;
  // Handle
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.035, 0.28, 10),
    new THREE.MeshStandardMaterial({ color:0x6b3a1f, roughness:0.85, metalness:0.1 })
  );
  handle.position.y = -0.35;
  // Pommel
  const pommel = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 8),
    new THREE.MeshStandardMaterial({ color:0xaaaacc, metalness:0.9, roughness:0.1 })
  );
  pommel.position.y = -0.5;
  g.add(blade); g.add(fuller); g.add(guard); g.add(handle); g.add(pommel);
  return g;
}

function buildKnightHelmetMesh(cracked: boolean): THREE.Group {
  const g = new THREE.Group();
  const col = cracked ? 0x887766 : 0xccccdd;
  const emCol = cracked ? 0xff4400 : 0x4466aa;
  // Dome
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS * 1.08, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    new THREE.MeshStandardMaterial({ color: col, emissive: emCol, emissiveIntensity: cracked ? 0.4 : 0.15, metalness: 0.9, roughness: cracked ? 0.6 : 0.15 })
  );
  g.add(dome);
  // Visor slit
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(BALL_RADIUS * 0.7, 0.07, BALL_RADIUS * 0.25),
    new THREE.MeshStandardMaterial({ color: 0x111122, emissive: 0x2244ff, emissiveIntensity: 0.8 })
  );
  visor.position.set(0, -0.05, BALL_RADIUS * 0.88);
  g.add(visor);
  if (cracked) {
    // Crack lines
    for (let i = 0; i < 3; i++) {
      const crack = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.35, 0.03),
        new THREE.MeshBasicMaterial({ color: 0xff6600 })
      );
      crack.position.set(rnd(-0.2, 0.2), rnd(-0.1, 0.1), rnd(0.3, 0.55));
      crack.rotation.z = rnd(-0.5, 0.5);
      g.add(crack);
    }
  }
  return g;
}

function buildAxeMesh(): THREE.Group {
  const g = new THREE.Group();
  // Thick wooden handle
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.045, 1.0, 10),
    new THREE.MeshStandardMaterial({ color:0x4a2200, roughness:0.92, metalness:0.0 })
  );
  // Handle wrap
  for (let i = 0; i < 5; i++) {
    const wrap = new THREE.Mesh(
      new THREE.TorusGeometry(0.06, 0.012, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x333300, roughness: 0.8 })
    );
    wrap.position.y = -0.3 + i * 0.15;
    wrap.rotation.x = Math.PI / 2;
    g.add(wrap);
  }
  // Large axe head
  const headGeo = new THREE.BufferGeometry();
  const verts = new Float32Array([
    // Main blade (crescent-ish)
    0, 0.5, 0,   0.6, 0.35, 0.05,   0.65, -0.1, 0.05,
    0, 0.5, 0,   0.65, -0.1, 0.05,  0.1, -0.35, 0,
    0, 0.5, 0,   0.1, -0.35, 0,     0, 0.0, 0,
    // Back side
    0, 0.5, 0,   0.6, 0.35, -0.05,  0.65, -0.1, -0.05,
    0, 0.5, 0,   0.65, -0.1, -0.05, 0.1, -0.35, 0,
  ]);
  headGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  headGeo.computeVertexNormals();
  const head = new THREE.Mesh(
    headGeo,
    new THREE.MeshStandardMaterial({ color:0x887755, emissive:0xff3300, emissiveIntensity:0.12, metalness:0.85, roughness:0.18, side: THREE.DoubleSide })
  );
  head.position.set(0.12, 0.32, 0);
  // Spike on back
  const spike = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.28, 6),
    new THREE.MeshStandardMaterial({ color:0x888866, metalness:0.85, roughness:0.2 })
  );
  spike.position.set(-0.18, 0.15, 0);
  spike.rotation.z = Math.PI / 2;
  g.add(handle); g.add(head); g.add(spike);
  return g;
}

function buildTartanRobeMesh(hpRatio: number): THREE.Group {
  const g = new THREE.Group();
  // Body robe / kilt
  const glowIntensity = hpRatio > 0.7 ? 0 : (1 - hpRatio) * 0.9;
  const robeColor = hpRatio > 0.7 ? 0x1a1a1a : new THREE.Color().setHSL(0.08, 1, 0.1 + (1 - hpRatio) * 0.35).getHex();
  const robe = new THREE.Mesh(
    new THREE.CylinderGeometry(BALL_RADIUS * 0.85, BALL_RADIUS * 1.1, BALL_RADIUS * 1.2, 14),
    new THREE.MeshStandardMaterial({ color: robeColor, emissive: hpRatio < 0.7 ? 0xff4400 : 0x000000, emissiveIntensity: glowIntensity, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.88 })
  );
  robe.position.y = -BALL_RADIUS * 0.35;
  g.add(robe);
  // Tartan stripes (horizontal bands)
  const stripeColors = [0x3a1a00, 0x003322, 0x2a0000];
  for (let i = 0; i < 3; i++) {
    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(BALL_RADIUS * 0.87, BALL_RADIUS * 1.12, 0.06, 14),
      new THREE.MeshStandardMaterial({ color: hpRatio < 0.5 ? 0xff6600 : stripeColors[i], emissive: hpRatio < 0.5 ? 0xff3300 : 0x000000, emissiveIntensity: hpRatio < 0.5 ? (1 - hpRatio) : 0, transparent: true, opacity: 0.85 })
    );
    stripe.position.y = -BALL_RADIUS * 0.6 + i * 0.18;
    g.add(stripe);
  }
  return g;
}

function buildBowMesh(): THREE.Group {
  const g = new THREE.Group();
  // Longer bow
  const bow = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.035, 8, 18, Math.PI),
    new THREE.MeshStandardMaterial({ color:0x6b3a1f, roughness:0.85, metalness:0.05 })
  );
  bow.rotation.z = Math.PI / 2;
  // String
  const string = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.76, 4),
    new THREE.MeshBasicMaterial({ color:0xeeddcc })
  );
  // Arrow nocked
  const arrowShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6),
    new THREE.MeshStandardMaterial({ color:0x885533, roughness:0.8 })
  );
  arrowShaft.rotation.x = Math.PI / 2;
  arrowShaft.position.set(0, 0, 0.05);
  const arrowTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.04, 0.12, 6),
    new THREE.MeshStandardMaterial({ color:0xddeeff, metalness:0.8, roughness:0.15 })
  );
  arrowTip.rotation.x = Math.PI / 2;
  arrowTip.position.set(0, 0, 0.36);
  g.add(bow); g.add(string); g.add(arrowShaft); g.add(arrowTip);
  return g;
}

function buildRobinHoodHatMesh(): THREE.Group {
  const g = new THREE.Group();
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(BALL_RADIUS * 0.9, BALL_RADIUS * 0.95, 0.06, 14),
    new THREE.MeshStandardMaterial({ color:0x2d5a1b, roughness:0.9 })
  );
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(BALL_RADIUS * 0.7, BALL_RADIUS * 1.1, 14),
    new THREE.MeshStandardMaterial({ color:0x2d5a1b, roughness:0.9 })
  );
  cone.position.y = BALL_RADIUS * 0.55;
  // Feather
  const feather = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.4, 0.02),
    new THREE.MeshStandardMaterial({ color:0xddaa33, roughness:0.7 })
  );
  feather.position.set(BALL_RADIUS * 0.45, BALL_RADIUS * 0.9, 0);
  feather.rotation.z = 0.4;
  g.add(brim); g.add(cone); g.add(feather);
  return g;
}

function buildLaserGunMesh(): THREE.Group {
  const g = new THREE.Group();
  // Futuristic body
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.16, 0.52),
    new THREE.MeshStandardMaterial({ color:0x220044, emissive:0xff00ff, emissiveIntensity:0.35, metalness:0.9, roughness:0.1 })
  );
  // Side fins
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.3, 0.35),
      new THREE.MeshStandardMaterial({ color:0x330066, emissive:0x8800ff, emissiveIntensity:0.5, metalness:0.95, roughness:0.05 })
    );
    fin.position.set(s2 * 0.16, 0, -0.04);
    g.add(fin);
  }
  // Long barrel
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.06, 0.65, 10),
    new THREE.MeshStandardMaterial({ color:0xccaaff, emissive:0xff44ff, emissiveIntensity:1.0, metalness:0.8, roughness:0.05 })
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.48;
  // Glowing tip
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 10, 8),
    new THREE.MeshBasicMaterial({ color:0xff88ff, transparent:true, opacity:0.95 })
  );
  glow.position.z = 0.82;
  // Energy cell
  const cell = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.25, 0.1),
    new THREE.MeshStandardMaterial({ color:0x00ffff, emissive:0x00ffff, emissiveIntensity:0.8, transparent:true, opacity:0.7 })
  );
  cell.position.set(0, -0.19, 0.05);
  g.add(core); g.add(barrel); g.add(glow); g.add(cell);
  return g;
}

function buildAlienRobeMesh(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS * 1.05, 14, 10),
    new THREE.MeshStandardMaterial({ color:0x110022, emissive:0x8800ff, emissiveIntensity:0.25, metalness:0.5, roughness:0.3, transparent:true, opacity:0.82 })
  );
  // Circuit lines
  for (let i = 0; i < 4; i++) {
    const line = new THREE.Mesh(
      new THREE.TorusGeometry(BALL_RADIUS * 0.9, 0.012, 4, 16),
      new THREE.MeshBasicMaterial({ color:0x00ffff })
    );
    line.rotation.x = (i / 4) * Math.PI;
    g.add(line);
  }
  g.add(body);
  return g;
}

function buildCrownMesh(): THREE.Group {
  const g = new THREE.Group();
  // Large ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.1, 8, 20),
    new THREE.MeshStandardMaterial({ color:0xffcc00, emissive:0xffaa00, emissiveIntensity:0.8, metalness:0.95, roughness:0.08 })
  );
  // Many tall spikes
  for (let i = 0; i < 7; i++) {
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.55, 6),
      new THREE.MeshStandardMaterial({ color:0xffcc00, emissive:0xffee00, emissiveIntensity:0.6, metalness:0.95 })
    );
    const angle = i * (Math.PI * 2 / 7);
    spike.position.set(Math.cos(angle) * 0.48, 0.3, Math.sin(angle) * 0.48);
    // Gem on spike
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.07),
      new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xff0044 : 0x0044ff, emissive: i % 2 === 0 ? 0xff0044 : 0x0044ff, emissiveIntensity:1, metalness:0.5 })
    );
    gem.position.set(Math.cos(angle) * 0.48, 0.7, Math.sin(angle) * 0.48);
    g.add(spike); g.add(gem);
  }
  g.add(ring);
  return g;
}

function buildKingRobeMesh(): THREE.Group {
  const g = new THREE.Group();
  // Long royal robe
  const robe = new THREE.Mesh(
    new THREE.CylinderGeometry(BALL_RADIUS * 0.85, BALL_RADIUS * 1.25, BALL_RADIUS * 1.4, 16),
    new THREE.MeshStandardMaterial({ color:0x550022, emissive:0x880044, emissiveIntensity:0.15, roughness:0.85 })
  );
  robe.position.y = -BALL_RADIUS * 0.4;
  // Gold trim
  const trim = new THREE.Mesh(
    new THREE.CylinderGeometry(BALL_RADIUS * 0.88, BALL_RADIUS * 1.27, 0.09, 16),
    new THREE.MeshStandardMaterial({ color:0xffcc00, emissive:0xffaa00, emissiveIntensity:0.4, metalness:0.9 })
  );
  trim.position.y = -BALL_RADIUS * 0.9;
  // Ermine spots
  for (let i = 0; i < 8; i++) {
    const spot = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 6),
      new THREE.MeshStandardMaterial({ color:0x111111 })
    );
    const a = i * Math.PI / 4;
    spot.position.set(Math.cos(a) * BALL_RADIUS * 1.0, -BALL_RADIUS * 0.3, Math.sin(a) * BALL_RADIUS * 1.0);
    g.add(spot);
  }
  g.add(robe); g.add(trim);
  return g;
}

function buildSpearMesh(): THREE.Group {
  const g = new THREE.Group();
  // Long shaft
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.03, 1.4, 8),
    new THREE.MeshStandardMaterial({ color:0x5a3010, roughness:0.9 })
  );
  // Large tip
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.4, 8),
    new THREE.MeshStandardMaterial({ color:0xccccdd, metalness:0.85, roughness:0.15, emissive:0x8899aa, emissiveIntensity:0.2 })
  );
  tip.position.y = 0.9;
  // Cross piece
  const cross = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.04, 0.04),
    new THREE.MeshStandardMaterial({ color:0xaaaacc, metalness:0.8 })
  );
  cross.position.y = 0.65;
  g.add(shaft); g.add(tip); g.add(cross);
  return g;
}

function buildWoodenArmorMesh(): THREE.Group {
  const g = new THREE.Group();
  // Wooden chest plates
  const chest = new THREE.Mesh(
    new THREE.BoxGeometry(BALL_RADIUS * 1.2, BALL_RADIUS * 0.9, BALL_RADIUS * 0.5),
    new THREE.MeshStandardMaterial({ color:0x8b5a2b, roughness:0.95, metalness:0 })
  );
  chest.position.z = BALL_RADIUS * 0.55;
  // Wood grain lines
  for (let i = 0; i < 4; i++) {
    const grain = new THREE.Mesh(
      new THREE.BoxGeometry(BALL_RADIUS * 1.22, 0.025, 0.015),
      new THREE.MeshBasicMaterial({ color:0x6b3a1f })
    );
    grain.position.set(0, -BALL_RADIUS * 0.35 + i * 0.22, BALL_RADIUS * 0.72);
    g.add(grain);
  }
  // Shoulder pads
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    const pad = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color:0x7a4a20, roughness:0.9 })
    );
    pad.position.set(s2 * BALL_RADIUS * 0.85, BALL_RADIUS * 0.2, 0);
    pad.rotation.z = s2 * Math.PI / 2;
    g.add(pad);
  }
  g.add(chest);
  return g;
}

function buildDynamiteMesh(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.42, 10),
      new THREE.MeshStandardMaterial({ color:0xcc2200, roughness:0.75, emissive:0x880000, emissiveIntensity:0.2 })
    );
    stick.position.set((i - 1) * 0.2, 0, 0);
    stick.rotation.z = rnd(-0.15, 0.15);
    // Band
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.04, 10),
      new THREE.MeshStandardMaterial({ color:0x333300, roughness:0.8 })
    );
    band.position.set((i - 1) * 0.2, 0.15, 0);
    g.add(stick); g.add(band);
  }
  const fuse = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4),
    new THREE.MeshBasicMaterial({ color:0x888833 })
  );
  fuse.position.set(0, 0.35, 0);
  g.add(fuse);
  return g;
}

function buildMinerOutfitMesh(): THREE.Group {
  const g = new THREE.Group();
  // Overalls
  const overalls = new THREE.Mesh(
    new THREE.CylinderGeometry(BALL_RADIUS * 0.88, BALL_RADIUS * 1.05, BALL_RADIUS * 1.3, 14),
    new THREE.MeshStandardMaterial({ color:0x1a2e44, roughness:0.9 })
  );
  overalls.position.y = -BALL_RADIUS * 0.3;
  // Suspenders
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, BALL_RADIUS * 1.0, 0.03),
      new THREE.MeshStandardMaterial({ color:0x334466, roughness:0.9 })
    );
    strap.position.set(s2 * 0.18, BALL_RADIUS * 0.05, BALL_RADIUS * 0.6);
    g.add(strap);
  }
  // Hard hat (larger)
  const hat = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS * 1.12, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color:0xffcc00, emissive:0xffaa00, emissiveIntensity:0.3, metalness:0.5, roughness:0.4 })
  );
  hat.position.y = BALL_RADIUS * 0.12;
  // Hat brim
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(BALL_RADIUS * 1.18, BALL_RADIUS * 1.18, 0.06, 14),
    new THREE.MeshStandardMaterial({ color:0xffcc00, emissive:0xffaa00, emissiveIntensity:0.2, metalness:0.5 })
  );
  brim.position.y = BALL_RADIUS * 0.0;
  // Reflective vest strips
  for (let i = 0; i < 2; i++) {
    const strip = new THREE.Mesh(
      new THREE.CylinderGeometry(BALL_RADIUS * 0.9, BALL_RADIUS * 1.07, 0.07, 14),
      new THREE.MeshStandardMaterial({ color:0xffdd00, emissive:0xffff00, emissiveIntensity:0.6, metalness:0.2 })
    );
    strip.position.y = -BALL_RADIUS * 0.15 + i * 0.3;
    g.add(strip);
  }
  g.add(overalls); g.add(hat); g.add(brim);
  return g;
}

function buildKnifeMesh(): THREE.Group {
  const g = new THREE.Group();
  // Long, wider blade with poison sheen
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.55, 0.04),
    new THREE.MeshStandardMaterial({ color:0x88ff44, emissive:0x8800ff, emissiveIntensity:0.65, metalness:0.85, roughness:0.08 })
  );
  blade.rotation.z = 0.2;
  // Serrations
  for (let i = 0; i < 4; i++) {
    const serration = new THREE.Mesh(
      new THREE.ConeGeometry(0.025, 0.07, 4),
      new THREE.MeshStandardMaterial({ color:0x55ff22, emissive:0x9900ff, emissiveIntensity:0.5 })
    );
    serration.position.set(0.06, -0.1 + i * 0.14, 0);
    serration.rotation.z = Math.PI / 2;
    g.add(serration);
  }
  // Poison drip
  const drip = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 6, 6),
    new THREE.MeshBasicMaterial({ color:0xaa00ff, transparent:true, opacity:0.8 })
  );
  drip.position.set(0, -0.32, 0);
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.04, 0.22, 8),
    new THREE.MeshStandardMaterial({ color:0x111122, roughness:0.8, emissive:0x330066, emissiveIntensity:0.3 })
  );
  handle.position.y = -0.38;
  g.add(blade); g.add(drip); g.add(handle);
  return g;
}

function buildAssassinHoodMesh(): THREE.Group {
  const g = new THREE.Group();
  const hood = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS * 1.07, 14, 10),
    new THREE.MeshStandardMaterial({ color:0x0a0a14, emissive:0x440088, emissiveIntensity:0.1, roughness:0.92 })
  );
  // Shadow around face
  const shadow = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS * 0.62, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.75 })
  );
  shadow.position.set(0, 0, BALL_RADIUS * 0.55);
  shadow.rotation.x = Math.PI / 2;
  // Glowing eyes
  for (let ex = -1; ex <= 1; ex += 2) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 6, 6),
      new THREE.MeshBasicMaterial({ color:0xaa00ff })
    );
    eye.position.set(ex * 0.14, 0.08, BALL_RADIUS * 0.88);
    g.add(eye);
  }
  g.add(hood); g.add(shadow);
  return g;
}

function buildMinigunMesh(): THREE.Group {
  const g = new THREE.Group();
  // Body / receiver
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.14, 0.45),
    new THREE.MeshStandardMaterial({ color:0x444466, metalness:0.85, roughness:0.15, emissive:0x222244, emissiveIntensity:0.2 })
  );
  // 6 rotating barrels
  const barrelGroup = new THREE.Group();
  barrelGroup.name = "barrelGroup";
  for (let i = 0; i < 6; i++) {
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.52, 8),
      new THREE.MeshStandardMaterial({ color:0x888888, metalness:0.95, roughness:0.05 })
    );
    barrel.rotation.x = Math.PI / 2;
    const a = i * Math.PI / 3;
    barrel.position.set(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0.22);
    barrelGroup.add(barrel);
  }
  // Ammo drum
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.16, 14),
    new THREE.MeshStandardMaterial({ color:0x333355, metalness:0.75, roughness:0.2 })
  );
  drum.position.set(0, -0.17, 0);
  drum.rotation.x = Math.PI / 2;
  g.add(body); g.add(barrelGroup); g.add(drum);
  return g;
}

function buildModernHelmetMesh(): THREE.Group {
  const g = new THREE.Group();
  // MICH-style helmet
  const helm = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS * 1.12, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
    new THREE.MeshStandardMaterial({ color:0x3a4a2a, roughness:0.85, metalness:0.1 })
  );
  // Brim
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(BALL_RADIUS * 1.18, BALL_RADIUS * 1.15, 0.08, 16),
    new THREE.MeshStandardMaterial({ color:0x2e3a1e, roughness:0.85 })
  );
  brim.position.y = -BALL_RADIUS * 0.05;
  // NVG mount
  const mount = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.08, 0.08),
    new THREE.MeshStandardMaterial({ color:0x222222, metalness:0.7 })
  );
  mount.position.set(0, BALL_RADIUS * 0.3, BALL_RADIUS * 0.9);
  g.add(helm); g.add(brim); g.add(mount);
  return g;
}

function buildWorkerVestMesh(): THREE.Group {
  const g = new THREE.Group();
  const vest = new THREE.Mesh(
    new THREE.CylinderGeometry(BALL_RADIUS * 0.87, BALL_RADIUS * 1.05, BALL_RADIUS * 1.2, 14),
    new THREE.MeshStandardMaterial({ color:0xff6600, roughness:0.88 })
  );
  vest.position.y = -BALL_RADIUS * 0.28;
  // Reflective strips (bright)
  for (let i = 0; i < 2; i++) {
    const strip = new THREE.Mesh(
      new THREE.CylinderGeometry(BALL_RADIUS * 0.89, BALL_RADIUS * 1.07, 0.07, 14),
      new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xffffff, emissiveIntensity:0.9, metalness:0.3 })
    );
    strip.position.y = -BALL_RADIUS * 0.1 + i * 0.32;
    g.add(strip);
  }
  g.add(vest);
  return g;
}

// Turret with HP
function buildTurretMesh(teamColor: number): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.35, 0.25, 12),
    new THREE.MeshStandardMaterial({ color:teamColor, metalness:0.8, roughness:0.2 })
  );
  const body2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    new THREE.MeshStandardMaterial({ color:teamColor, emissive:teamColor, emissiveIntensity:0.2, metalness:0.7 })
  );
  body2.position.y = 0.33;
  // 4 barrels pointing in 4 directions
  const dirs = [[0,0,1],[0,0,-1],[1,0,0],[-1,0,0]];
  dirs.forEach(([dx2,,dz2]) => {
    const barrel2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.35, 6),
      new THREE.MeshStandardMaterial({ color:0x888888, metalness:0.9 })
    );
    barrel2.rotation.x = Math.PI / 2;
    barrel2.position.set(dx2 * 0.3, 0.33, dz2 * 0.3);
    barrel2.lookAt(dx2 * 10, 0.33, dz2 * 10);
    barrel2.rotateX(Math.PI / 2);
    g.add(barrel2);
  });
  g.add(base); g.add(body2);
  return g;
}

// ═══════════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function ArenaSim() {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SimState>({
    balls: [], projectiles: [], turrets: [], bombs: [],
    yaw: 0, pitch: 0.3, orbitDist: 20,
    keys: {}, collisionFlash: 0, simRunning: false, lastDamageKind: null,
  });

  const [hp,         setHp]         = useState<Record<TeamId, number>>({ A: 100, B: 100 });
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

  const buildRoster = useCallback((teamAcfg: UnitConfig[], teamBcfg: UnitConfig[]): Unit[] => {
    const units: Unit[] = [];
    const positions: [number, number, number][] = [
      [-3.5,0,-3.5],[-2,0,-3],[-3.5,0,0],[-2,0,3],[-3.5,0,3.5],
      [3.5,0,3.5],[2,0,3],[3.5,0,0],[2,0,-3],[3.5,0,-3.5],
    ];
    teamAcfg.forEach((cfg, i) => {
      const p = positions[i] ?? ([rnd(-4,4), 0, rnd(-4,4)] as [number,number,number]);
      units.push(initUnit(p[0], p[1], p[2], rnd(...INITIAL_SPEED_XZ), rnd(...INITIAL_SPEED_Y), rnd(...INITIAL_SPEED_XZ), cfg.type, "A", cfg.hp));
    });
    teamBcfg.forEach((cfg, i) => {
      const p = positions[5 + i] ?? ([rnd(-4,4), 0, rnd(-4,4)] as [number,number,number]);
      units.push(initUnit(p[0], p[1], p[2], rnd(...INITIAL_SPEED_XZ), rnd(...INITIAL_SPEED_Y), rnd(...INITIAL_SPEED_XZ), cfg.type, "B", cfg.hp));
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

    // ── Outfit/prop mesh pool per unit ─────────────────────────────
    // Each unit slot: container holds all decorative meshes
    interface UnitVisuals {
      outfitGroup: THREE.Group;    // clothes/armor worn on ball
      weaponGroup: THREE.Group;    // weapon that orbits
      helmetGroup: THREE.Group;    // separate breakable helmet
    }
    const unitVisuals: UnitVisuals[] = [];

    for (let i = 0; i < MAX_UNITS; i++) {
      const outfitGroup  = new THREE.Group(); outfitGroup.visible  = false; scene.add(outfitGroup);
      const weaponGroup  = new THREE.Group(); weaponGroup.visible  = false; scene.add(weaponGroup);
      const helmetGroup  = new THREE.Group(); helmetGroup.visible  = false; scene.add(helmetGroup);
      unitVisuals.push({ outfitGroup, weaponGroup, helmetGroup });
    }

    // Store built meshes per unit to avoid rebuilding every frame
    const builtOutfits: Map<number, { type: UnitType; cracked: boolean; tartanRatio: number }> = new Map();

    function rebuildUnitVisuals(idx: number, u: Unit, globalTime: number) {
      const vis = unitVisuals[idx];
      const hpRatio = u.hp / u.maxHp;
      const cacheKey = { type: u.type, cracked: hpRatio <= 0.5, tartanRatio: Math.floor(hpRatio * 5) };
      const cached = builtOutfits.get(idx);

      // Check if needs rebuild
      const needsRebuild = !cached ||
        cached.type !== u.type ||
        (u.type === "swordsman" && cached.cracked !== (hpRatio <= 0.5)) ||
        (u.type === "barbarian" && cached.tartanRatio !== cacheKey.tartanRatio);

      if (!needsRebuild) return;

      // Clear old children
      while (vis.outfitGroup.children.length) vis.outfitGroup.remove(vis.outfitGroup.children[0]);
      while (vis.weaponGroup.children.length) vis.weaponGroup.remove(vis.weaponGroup.children[0]);
      while (vis.helmetGroup.children.length) vis.helmetGroup.remove(vis.helmetGroup.children[0]);

      switch (u.type) {
        case "swordsman": {
          const sword = buildSwordMesh(); sword.scale.setScalar(1.4);
          vis.weaponGroup.add(sword);
          const helmet = buildKnightHelmetMesh(hpRatio <= 0.5);
          vis.helmetGroup.add(helmet);
          break;
        }
        case "barbarian": {
          const axe = buildAxeMesh(); axe.scale.setScalar(1.3);
          vis.weaponGroup.add(axe);
          const robe = buildTartanRobeMesh(hpRatio);
          vis.outfitGroup.add(robe);
          break;
        }
        case "archer": {
          const bow = buildBowMesh(); bow.scale.setScalar(1.2);
          vis.weaponGroup.add(bow);
          const hat = buildRobinHoodHatMesh();
          vis.helmetGroup.add(hat);
          break;
        }
        case "laser": {
          const gun = buildLaserGunMesh(); gun.scale.setScalar(1.2);
          vis.weaponGroup.add(gun);
          const robe = buildAlienRobeMesh();
          vis.outfitGroup.add(robe);
          break;
        }
        case "king": {
          const crown = buildCrownMesh(); crown.scale.setScalar(1.0);
          vis.helmetGroup.add(crown);
          const robe = buildKingRobeMesh();
          vis.outfitGroup.add(robe);
          break;
        }
        case "recruit": {
          const spear = buildSpearMesh(); spear.scale.setScalar(1.3);
          vis.weaponGroup.add(spear);
          const armor = buildWoodenArmorMesh();
          vis.outfitGroup.add(armor);
          break;
        }
        case "bomber": {
          const dyn = buildDynamiteMesh(); dyn.scale.setScalar(1.2);
          vis.weaponGroup.add(dyn);
          const outfit = buildMinerOutfitMesh();
          vis.outfitGroup.add(outfit);
          break;
        }
        case "toxic": {
          const knife = buildKnifeMesh(); knife.scale.setScalar(1.4);
          vis.weaponGroup.add(knife);
          const hood = buildAssassinHoodMesh();
          vis.outfitGroup.add(hood);
          break;
        }
        case "machinegunner": {
          const minigun = buildMinigunMesh(); minigun.scale.setScalar(1.1);
          vis.weaponGroup.add(minigun);
          const helmet2 = buildModernHelmetMesh();
          vis.helmetGroup.add(helmet2);
          break;
        }
        case "engineer": {
          const vest = buildWorkerVestMesh();
          vis.outfitGroup.add(vest);
          break;
        }
      }

      builtOutfits.set(idx, { type: u.type, cracked: hpRatio <= 0.5, tartanRatio: cacheKey.tartanRatio });
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
    const projMeshes: THREE.Group[] = [];
    for (let i = 0; i < MAX_PROJ; i++) {
      const g = new THREE.Group();
      const arrow = new THREE.Group(); arrow.name = "arrow";
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.42, 6),
        new THREE.MeshStandardMaterial({ color:0x8b5a2b, roughness:0.8 })
      );
      shaft.rotation.x = Math.PI / 2;
      const head = new THREE.Mesh(
        new THREE.ConeGeometry(0.07, 0.18, 8),
        new THREE.MeshStandardMaterial({ color:0xddeeff, metalness:0.75, roughness:0.2 })
      );
      head.rotation.x = Math.PI / 2; head.position.z = 0.3;
      arrow.add(shaft); arrow.add(head);
      const bullet = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 6, 6),
        new THREE.MeshBasicMaterial({ color:0xffff44, transparent:true, opacity:0.9 })
      );
      bullet.name = "bullet";
      g.add(arrow); g.add(bullet);
      g.visible = false; scene.add(g); projMeshes.push(g);
    }

    // ── Turret mesh pool (now using Groups) ────────────────────────
    const turretGroups: THREE.Group[] = [];
    const turretHpBars: THREE.Mesh[] = [];
    for (let i = 0; i < MAX_TURRETS; i++) {
      const tg = buildTurretMesh(0xffaa22);
      tg.visible = false; scene.add(tg); turretGroups.push(tg);
      // HP bar above turret
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.07, 0.05),
        new THREE.MeshBasicMaterial({ color:0x00ff44 })
      );
      bar.visible = false; scene.add(bar); turretHpBars.push(bar);
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

    let audioCtx: AudioContext | null = null;
    const soundCooldowns: Record<SoundKind, number> = { projectile:0, melee:0, laser:0, explosion:0, dot:0, impact:0 };
    const playDamageSound = (kind: SoundKind) => {
      const nowSec = performance.now() / 1000;
      if (nowSec < soundCooldowns[kind]) return;
      soundCooldowns[kind] = nowSec + (kind === "laser" || kind === "dot" ? 0.22 : 0.08);
      audioCtx ??= new AudioContext();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();
      const freq: Record<SoundKind, number> = { projectile:720, melee:180, laser:1040, explosion:90, dot:360, impact:260 };
      const wave: Record<SoundKind, OscillatorType> = { projectile:"triangle", melee:"sawtooth", laser:"square", explosion:"sine", dot:"sine", impact:"triangle" };
      osc.type = wave[kind];
      osc.frequency.setValueAtTime(freq[kind], audioCtx.currentTime);
      if (kind === "explosion") osc.frequency.exponentialRampToValueAtTime(38, audioCtx.currentTime + 0.28);
      if (kind === "laser") osc.frequency.linearRampToValueAtTime(1320, audioCtx.currentTime + 0.12);
      filter.type = kind === "explosion" || kind === "impact" ? "lowpass" : "bandpass";
      filter.frequency.value = kind === "explosion" ? 420 : kind === "impact" ? 700 : 1400;
      gain.gain.setValueAtTime(kind === "explosion" ? 0.18 : kind === "impact" ? 0.05 : 0.07, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (kind === "explosion" ? 0.35 : 0.13));
      osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + (kind === "explosion" ? 0.36 : 0.14));
      stateRef.current.lastDamageKind = kind;
    };

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      const dt  = Math.min((now - lastTime) / 1000, 0.05);
      lastTime  = now; globalTime += dt;

      const s = stateRef.current;

      // ── Camera (FREE only) ──
      const TURN = 1.4 * dt, ZOOM = 6 * dt;
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

      if (!s.simRunning) { renderer.render(scene, camera); return; }

      // ── Physics ──
      const prev = s.balls;
      let anyImpact = false;
      const next = stepPhysics(prev, dt, () => { anyImpact = true; playDamageSound("impact"); });

      const anyHit = prev.some((p, i) => next[i] && p.hp !== next[i].hp);
      if (anyImpact || anyHit) { s.collisionFlash = 0.35; setColliding(true); setTimeout(() => setColliding(false), 350); }
      if (s.collisionFlash > 0) { s.collisionFlash -= dt; flashMat.opacity = clamp(s.collisionFlash * 1.2, 0, 0.18); }
      else flashMat.opacity = 0;

      for (const u of next) tickDots(u, dt, playDamageSound);

      const newProj:    Projectile[] = [...s.projectiles];
      const spawnUnits: Unit[]       = [];

      for (const u of next) {
        if (u.hp <= 0) continue;

        // Track nearest enemy for targeting
        let nearestEnemy: Unit | null = null;
        let nearestDist = Infinity;
        for (const e of next) {
          if (e.team !== u.team && e.hp > 0) {
            const d = dist3(u, e);
            if (d < nearestDist) { nearestDist = d; nearestEnemy = e; }
          }
        }
        if (nearestEnemy) { u.targetX = nearestEnemy.x; u.targetY = nearestEnemy.y; u.targetZ = nearestEnemy.z; }

        if (u.type === "swordsman") {
          const def = UNIT_DEFS.swordsman;
          u.orbitAngle += def.orbitSpeed * dt;
          const wx = u.x + Math.cos(u.orbitAngle) * def.orbitR;
          const wz = u.z + Math.sin(u.orbitAngle) * def.orbitR;
          for (const e of next) {
            if (e.team === u.team || e.hp <= 0) continue;
            const dx = e.x - wx, dz = e.z - wz;
            if (Math.sqrt(dx * dx + dz * dz) < (e.radius || BALL_RADIUS) + 0.2)
              applyDamage(e, def.swingDmg * dt, "melee", playDamageSound);
          }
        }

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
              applyDamage(e, def.axeDmg, "melee", playDamageSound);
          }
        }

        if (u.type === "archer") {
          const def = UNIT_DEFS.archer;
          // Orbit angle slowly tracks enemy direction
          if (nearestEnemy) {
            const dx = nearestEnemy.x - u.x, dz = nearestEnemy.z - u.z;
            const targetAngle = Math.atan2(dz, dx);
            let angleDiff = targetAngle - u.orbitAngle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            u.orbitAngle += angleDiff * 4 * dt;
          }
          u.fireTimer -= dt;
          if (u.fireTimer <= 0) {
            u.fireTimer = 1 / def.fireRate;
            if (nearestEnemy) {
              const dx = nearestEnemy.x - u.x, dy = nearestEnemy.y - u.y, dz = nearestEnemy.z - u.z;
              const d  = Math.max(Math.sqrt(dx*dx + dy*dy + dz*dz), 0.01);
              const sp = def.spread;
              newProj.push({ x:u.x, y:u.y, z:u.z,
                vx:(dx/d + rnd(-sp,sp)) * def.projSpeed,
                vy:(dy/d + rnd(0,0.25)) * def.projSpeed,
                vz:(dz/d + rnd(-sp,sp)) * def.projSpeed,
                gravity:def.gravity, dmg:def.projDmg, team:u.team, life:3.5, color:TEAM_HEX[u.team], dot:null, kind:"arrow" });
            }
          }
        }

        if (u.type === "laser") {
          const def = UNIT_DEFS.laser;
          // Track enemy direction
          if (nearestEnemy) {
            const dx = nearestEnemy.x - u.x, dz = nearestEnemy.z - u.z;
            const targetAngle = Math.atan2(dz, dx);
            let angleDiff = targetAngle - u.orbitAngle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            u.orbitAngle += angleDiff * 3 * dt;
          } else {
            u.orbitAngle += 1.5 * dt;
          }
          u.laserTimer -= dt;
          if (u.laserTimer <= 0) { u.laserActive = !u.laserActive; u.laserTimer = u.laserActive ? def.active : def.cooldown; }
          if (u.laserActive) {
            const rdx = Math.cos(u.orbitAngle), rdz = Math.sin(u.orbitAngle);
            for (const e of next) {
              if (e.team === u.team || e.hp <= 0) continue;
              const ex = e.x - u.x, ez = e.z - u.z;
              const t  = ex * rdx + ez * rdz;
              if (t > 0 && t < 9) {
                const px = ex - t * rdx, pz = ez - t * rdz;
                if (Math.sqrt(px*px + pz*pz) < (e.radius || BALL_RADIUS) + 0.28)
                  applyDamage(e, def.dmgPerSec * dt, "laser", playDamageSound);
              }
            }
          }
        }

        if (u.type === "engineer") {
          const def = UNIT_DEFS.engineer;
          u.engineerTimer -= dt;
          if (u.engineerTimer <= 0) {
            u.engineerTimer = def.spawnRate;
            if (s.turrets.length < MAX_TURRETS)
              s.turrets.push({ x:u.x + rnd(-1.2,1.2), y:u.y, z:u.z + rnd(-1.2,1.2), team:u.team, fireTimer:0, alive:true, hp:30, maxHp:30 });
          }
        }

        if (u.type === "king") {
          const def      = UNIT_DEFS.king;
          const hpRatio  = u.hp / u.maxHp;
          for (const e of next) {
            if (e.team === u.team || e.hp <= 0) continue;
            if (dist3(u, e) < (u.radius || BALL_RADIUS) + (e.radius || BALL_RADIUS) + 0.3)
              applyDamage(e, def.crownDmg * dt, "melee", playDamageSound);
          }
          if (u.lastHpRatio - hpRatio >= def.recruitHpThreshold && spawnUnits.length < 6) {
            u.lastHpRatio = hpRatio;
            spawnUnits.push(initUnit(u.x + rnd(-1,1), u.y, u.z + rnd(-1,1), rnd(...INITIAL_SPEED_XZ), 0, rnd(...INITIAL_SPEED_XZ), "recruit", u.team, 10));
          }
        }

        if (u.type === "recruit") {
          const def = UNIT_DEFS.recruit;
          u.fireTimer -= dt;
          if (u.fireTimer <= 0) {
            u.fireTimer = 1 / def.spearRate;
            if (nearestEnemy && nearestDist < def.spearRange + u.radius) {
              applyDamage(nearestEnemy, def.spearDmg, "melee", playDamageSound);
            }
            if (nearestEnemy) {
              const dx = nearestEnemy.x - u.x, dz = nearestEnemy.z - u.z;
              u.orbitAngle = Math.atan2(dz, dx);
            }
          }
        }

        if (u.type === "bomber") {
          const def = UNIT_DEFS.bomber;
          u.orbitAngle += 1.8 * dt; // orbit the dynamite
          u.bombTimer -= dt;
          if (u.bombTimer <= 0) {
            u.bombTimer = def.bombInterval;
            if (s.bombs.length < MAX_BOMBS)
              s.bombs.push({ x:u.x, y:u.y, z:u.z, timer:3, team:u.team, exploded:false, flashIdx:-1 });
          }
        }

        if (u.type === "toxic") {
          const def = UNIT_DEFS.toxic;
          u.orbitAngle += 2.5 * dt;
          const wx = u.x + Math.cos(u.orbitAngle) * def.knifeR;
          const wz = u.z + Math.sin(u.orbitAngle) * def.knifeR;
          for (const e of next) {
            if (e.team === u.team || e.hp <= 0) continue;
            const dx = e.x - wx, dz = e.z - wz;
            if (Math.sqrt(dx*dx + dz*dz) < (e.radius || BALL_RADIUS) + 0.18) {
              applyDamage(e, def.knifeDmg * dt, "melee", playDamageSound);
              if (e.dots.filter(d => d.remaining > 0).length < 3)
                e.dots.push({ remaining:def.dotDuration, dmg:def.dotDmg, tickTimer:0 });
            }
          }
        }

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
              if (nearestEnemy) {
                const dx = nearestEnemy.x - u.x, dy = nearestEnemy.y - u.y, dz = nearestEnemy.z - u.z;
                const d  = Math.max(Math.sqrt(dx*dx + dy*dy + dz*dz), 0.01);
                // Update facing angle
                u.orbitAngle = Math.atan2(dz, dx);
                const sp = def.bulletSpread;
                newProj.push({ x:u.x, y:u.y + 0.15, z:u.z,
                  vx:(dx/d + rnd(-sp,sp)) * def.bulletSpeed,
                  vy:(dy/d + rnd(-sp*0.5,sp*0.5)) * def.bulletSpeed,
                  vz:(dz/d + rnd(-sp,sp)) * def.bulletSpeed,
                  gravity:-2, dmg:def.bulletDmg, team:u.team, life:2.5, color:TEAM_HEX[u.team], dot:null, kind:"bullet" });
              }
            }
          }
        }
      }

      for (const r of spawnUnits) next.push(r);

      // ── Turrets (4-directional, shoot every 3 sec) ──
      for (const turret of s.turrets) {
        if (!turret.alive) continue;
        turret.fireTimer -= dt;
        if (turret.fireTimer <= 0) {
          turret.fireTimer = 3.0;
          // Shoot in 4 horizontal directions
          const dirs4 = [[1,0],[0,1],[-1,0],[0,-1]];
          for (const [tdx, tdz] of dirs4) {
            newProj.push({ x:turret.x, y:turret.y + 0.33, z:turret.z,
              vx:tdx * 6, vy:0, vz:tdz * 6,
              gravity:-2, dmg:UNIT_DEFS.engineer.turretProjDmg,
              team:turret.team, life:3.0, color:TEAM_HEX[turret.team], dot:null, kind:"turret" });
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
              applyDamage(u, bombDef.bombDmg, "explosion", playDamageSound);
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

      s.projectiles = stepProjectiles(newProj, next, s.turrets, dt, playDamageSound);
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
        const vis  = unitVisuals[i];
        if (!u || u.hp <= 0) {
          mesh.visible = false;
          vis.outfitGroup.visible = false;
          vis.weaponGroup.visible = false;
          vis.helmetGroup.visible = false;
          laserMeshes[i].visible = false;
          continue;
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

        // Rebuild visuals if needed (lazy rebuild)
        rebuildUnitVisuals(i, u, globalTime);

        const hpRatio = u.hp / u.maxHp;

        // Position outfits on ball
        vis.outfitGroup.visible = true;
        vis.outfitGroup.position.set(u.x, u.y, u.z);

        // Update tartan glow dynamically for barbarian
        if (u.type === "barbarian") {
          const robe = vis.outfitGroup.children[0] as THREE.Group;
          if (robe) {
            robe.children.forEach((child) => {
              const mesh2 = child as THREE.Mesh;
              if (mesh2.material) {
                const mat2 = mesh2.material as THREE.MeshStandardMaterial;
                if (hpRatio < 0.7) {
                  const glowV = (1 - hpRatio) * 0.8;
                  mat2.emissiveIntensity = glowV;
                  mat2.emissive.setHex(0xff4400);
                }
              }
            });
          }
        }

        switch (u.type) {
          case "swordsman": {
            const orbitR = UNIT_DEFS.swordsman.orbitR;
            vis.weaponGroup.visible = true;
            vis.weaponGroup.position.set(
              u.x + Math.cos(u.orbitAngle) * orbitR,
              u.y,
              u.z + Math.sin(u.orbitAngle) * orbitR
            );
            vis.weaponGroup.rotation.y = -u.orbitAngle;
            if (vis.weaponGroup.children[0]) {
              vis.weaponGroup.children[0].rotation.y = globalTime * 9;
              (vis.weaponGroup.children[0] as THREE.Object3D).rotation.z = Math.sin(globalTime * 8) * 0.4;
            }
            // Helmet: on ball, cracked below 50% HP
            vis.helmetGroup.visible = hpRatio > 0.5; // helmet falls off
            vis.helmetGroup.position.set(u.x, u.y, u.z);
            break;
          }
          case "barbarian": {
            const orbitR = UNIT_DEFS.barbarian.axeOrbitR;
            vis.weaponGroup.visible = true;
            vis.weaponGroup.position.set(
              u.x + Math.cos(u.orbitAngle) * orbitR,
              u.y,
              u.z + Math.sin(u.orbitAngle) * orbitR
            );
            vis.weaponGroup.rotation.y = -u.orbitAngle;
            if (vis.weaponGroup.children[0]) {
              (vis.weaponGroup.children[0] as THREE.Object3D).rotation.z = Math.sin(globalTime * 3) * 0.3;
            }
            vis.helmetGroup.visible = false;
            break;
          }
          case "archer": {
            // Bow orbits at distance, aimed at enemy
            const bowR = 1.2;
            vis.weaponGroup.visible = true;
            vis.weaponGroup.position.set(
              u.x + Math.cos(u.orbitAngle) * bowR,
              u.y,
              u.z + Math.sin(u.orbitAngle) * bowR
            );
            vis.weaponGroup.rotation.y = -u.orbitAngle + Math.PI / 2;
            vis.helmetGroup.visible = true;
            vis.helmetGroup.position.set(u.x, u.y + BALL_RADIUS * 0.7, u.z);
            break;
          }
          case "laser": {
            // Gun held at distance, pointing at enemy
            const gunR = 0.85;
            vis.weaponGroup.visible = true;
            vis.weaponGroup.position.set(
              u.x + Math.cos(u.orbitAngle) * gunR,
              u.y + 0.1,
              u.z + Math.sin(u.orbitAngle) * gunR
            );
            vis.weaponGroup.rotation.y = -u.orbitAngle;
            vis.helmetGroup.visible = false;
            break;
          }
          case "king": {
            vis.weaponGroup.visible = false;
            vis.helmetGroup.visible = true;
            vis.helmetGroup.position.set(u.x, u.y + BALL_RADIUS * 1.2 + 0.1, u.z);
            vis.helmetGroup.rotation.y = globalTime * 0.4;
            break;
          }
          case "recruit": {
            // Spear points toward enemy
            const spearR = 0.9;
            vis.weaponGroup.visible = true;
            vis.weaponGroup.position.set(
              u.x + Math.cos(u.orbitAngle) * spearR,
              u.y,
              u.z + Math.sin(u.orbitAngle) * spearR
            );
            // Point spear toward enemy (rotate so tip faces outward)
            vis.weaponGroup.rotation.y = -u.orbitAngle - Math.PI / 2;
            vis.weaponGroup.rotation.x = -0.3;
            vis.helmetGroup.visible = false;
            break;
          }
          case "bomber": {
            // Dynamite orbits around ball
            const dynR = 1.0;
            vis.weaponGroup.visible = true;
            vis.weaponGroup.position.set(
              u.x + Math.cos(u.orbitAngle) * dynR,
              u.y,
              u.z + Math.sin(u.orbitAngle) * dynR
            );
            vis.weaponGroup.rotation.y = -u.orbitAngle;
            // Fuse flicker
            if (vis.weaponGroup.children[0]) {
              const dyn = vis.weaponGroup.children[0] as THREE.Group;
              const fuseChild = dyn.children[dyn.children.length - 1] as THREE.Mesh;
              if (fuseChild && fuseChild.material) {
                (fuseChild.material as THREE.MeshBasicMaterial).color.setHex(
                  Math.sin(globalTime * 10) > 0 ? 0xffdd00 : 0x888833
                );
              }
            }
            vis.helmetGroup.visible = false;
            break;
          }
          case "toxic": {
            const knifeR = UNIT_DEFS.toxic.knifeR;
            vis.weaponGroup.visible = true;
            vis.weaponGroup.position.set(
              u.x + Math.cos(u.orbitAngle) * knifeR,
              u.y,
              u.z + Math.sin(u.orbitAngle) * knifeR
            );
            vis.weaponGroup.rotation.y = -u.orbitAngle + globalTime * 3;
            vis.helmetGroup.visible = false;
            break;
          }
          case "machinegunner": {
            // Gun held in front, facing enemy
            const gunOffset = 0.7;
            vis.weaponGroup.visible = true;
            vis.weaponGroup.position.set(
              u.x + Math.cos(u.orbitAngle) * gunOffset,
              u.y + 0.05,
              u.z + Math.sin(u.orbitAngle) * gunOffset
            );
            vis.weaponGroup.rotation.y = -u.orbitAngle;
            // Spin barrels when firing
            if (u.burstShotsLeft > 0) {
              const bg = vis.weaponGroup.children[0]?.getObjectByName("barrelGroup");
              if (bg) bg.rotation.z += 0.35;
            }
            vis.helmetGroup.visible = true;
            vis.helmetGroup.position.set(u.x, u.y, u.z);
            break;
          }
          case "engineer": {
            vis.weaponGroup.visible = false;
            vis.helmetGroup.visible = false;
            break;
          }
          default:
            vis.weaponGroup.visible = false;
            vis.helmetGroup.visible = false;
        }

        // Laser ray from gun tip
        const lm = laserMeshes[i];
        if (u.type === "laser" && u.laserActive) {
          const rayLen = 8;
          const gunX = u.x + Math.cos(u.orbitAngle) * 0.85;
          const gunZ = u.z + Math.sin(u.orbitAngle) * 0.85;
          lm.visible = true;
          lm.position.set(
            gunX + Math.cos(u.orbitAngle) * rayLen / 2,
            u.y + 0.1,
            gunZ + Math.sin(u.orbitAngle) * rayLen / 2
          );
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
        if (p) {
          pm.visible = true;
          pm.position.set(p.x, p.y, p.z);
          pm.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
          const arrow = pm.getObjectByName("arrow") as THREE.Group | undefined;
          const bullet = pm.getObjectByName("bullet") as THREE.Mesh | undefined;
          if (arrow) arrow.visible = p.kind === "arrow";
          if (bullet) {
            bullet.visible = p.kind !== "arrow";
            (bullet.material as THREE.MeshBasicMaterial).color.setHex(p.color);
            bullet.scale.setScalar(p.kind === "bullet" ? 0.75 : 1);
          }
        } else pm.visible = false;
      }

      // ── Turret meshes with HP bars ──
      for (let i = 0; i < MAX_TURRETS; i++) {
        const t  = s.turrets[i];
        const tg = turretGroups[i];
        const hb = turretHpBars[i];
        if (t && t.alive) {
          tg.visible = true;
          tg.position.set(t.x, t.y, t.z);
          // Color by team
          tg.traverse(child => {
            const m = child as THREE.Mesh;
            if (m.isMesh && m.material) {
              const mat2 = m.material as THREE.MeshStandardMaterial;
              if (mat2.color) mat2.color.setHex(TEAM_HEX[t.team]);
              if (mat2.emissive) mat2.emissive.setHex(TEAM_HEX[t.team]);
            }
          });
          // HP bar
          hb.visible = true;
          hb.position.set(t.x, t.y + 0.85, t.z);
          hb.scale.x = t.hp / t.maxHp;
          (hb.material as THREE.MeshBasicMaterial).color.setHex(
            t.hp / t.maxHp > 0.5 ? 0x00ff44 : t.hp / t.maxHp > 0.25 ? 0xffaa00 : 0xff3300
          );
          hb.lookAt(camera.position);
        } else {
          tg.visible = false;
          hb.visible = false;
        }
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
      const aAvg = (() => { const a = next.filter(u => u.team === "A"); return a.length ? a.reduce((s2,u) => s2 + u.hp, 0) / a.length : 0; })();
      const bAvg = (() => { const a = next.filter(u => u.team === "B"); return a.length ? a.reduce((s2,u) => s2 + u.hp, 0) / a.length : 0; })();
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
              <div style={{ fontSize:10, color:"#4488ff", letterSpacing:"0.35em", marginBottom:6, opacity:0.6 }}>◈ ARENA BATTLE SIM v4.0</div>
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
                UNIT TYPES: {ALL_TYPES.length} · MAX 6 PER TEAM · HP CONFIGURABLE · TURRETS DESTRUCTIBLE
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
          <div style={{ color:"#4488ff", fontSize:9, letterSpacing:"0.2em", ...mono, marginBottom:10, textTransform:"uppercase", opacity:0.65 }}>◈ ARENA SIM v4.0</div>
          <div style={{ color:"#4488ff", fontSize:8, letterSpacing:"0.15em", ...mono, marginBottom:6, opacity:0.45 }}>── TEAM A · AVG {Math.round(hp.A)} ──</div>
          {unitHps.filter(u => u.team === "A").map((u, i) => (
            <HpBar key={`a${i}`} label={`${TYPE_ICONS[u.type]} ${u.type}`} value={u.hp} maxValue={u.maxHp} color="#4488ff" dots={u.dots}/>
          ))}
          <div style={{ borderTop:"1px solid #0d1a2a", margin:"8px 0" }}/>
          <div style={{ color:"#ff3344", fontSize:8, letterSpacing:"0.15em", ...mono, marginBottom:6, opacity:0.45 }}>── TEAM B · AVG {Math.round(hp.B)} ──</div>
          {unitHps.filter(u => u.team === "B").map((u, i) => (
            <HpBar key={`b${i}`} label={`${TYPE_ICONS[u.type]} ${u.type}`} value={u.hp} maxValue={u.maxHp} color="#ff3344" dots={u.dots}/>
          ))}
          <div style={{ marginTop:8, fontSize:9, ...mono, color:colliding ? "#ffcc00" : "#1a3050", letterSpacing:"0.1em", transition:"color 0.1s", textAlign:"center" }}>
            {colliding ? "⚡ COLLISION" : "· NOMINAL ·"}
          </div>
        </div>
      )}

      <div style={{ ...panelStyle, top:20, right:20, minWidth:155 }}>
        <div style={{ color:"#4488ff", fontSize:9, letterSpacing:"0.2em", ...mono, marginBottom:10, textTransform:"uppercase", opacity:0.65 }}>◈ CAMERA · FREE</div>
        <div style={{ color:"#1a2a3a", fontSize:8, ...mono, lineHeight:"1.9" }}>
          ← → ↑ ↓ rotate<br/>
          + − zoom
        </div>
      </div>

      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"7px 18px", background:"rgba(5,8,16,0.82)", borderTop:"1px solid #0d1a2a", display:"flex", justifyContent:"space-between", alignItems:"center", ...mono, fontSize:9, color:"#1a2a3a", letterSpacing:"0.1em" }}>
        <span>ARENA 10×10×10 · 10 UNIT TYPES · TURRETS 30HP · SWORDSMAN ARMOR · THREE.JS</span>
        <span style={{ color:colliding ? "#ffcc0055" : "#1a2a3a", transition:"color 0.2s" }}>{colliding ? "IMPACT DETECTED" : "TRACKING..."}</span>
      </div>
    </div>
  );
}
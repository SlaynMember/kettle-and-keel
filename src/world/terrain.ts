/**
 * Procedural islands. Deterministic seed so the world is the same every
 * session (and, later, the same for every player in co-op).
 * heightAt() is analytic — player movement and object placement sample the
 * same function the meshes were built from, so nothing ever sinks or floats.
 *
 * v3: the world is two islands. Island 1 is home; island 2 sits ~340 units
 * west-northwest across open water, with a few sandbars along the crossing
 * that low tide exposes. heightAt() is the max of both island functions,
 * so every system that ever sampled it keeps working unchanged.
 */
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

export const SEA_LEVEL = 0;
export const ISLAND_RADIUS = 62;

/** island 2: smaller, steeper, mossier — the reason you build the boat */
export const ISLAND2_CENTER = new THREE.Vector2(-300, -120);
export const ISLAND2_RADIUS = 52;

const SEA_FLOOR = -7.5;
const DEEP_FLOOR = new THREE.Color(0x1f4550); // must match buildOceanFloor()

/** deterministic PRNG (mulberry32) */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noise2D = createNoise2D(makeRng(20260703));

function fbm(x: number, y: number): number {
  let v = 0;
  let amp = 0.55;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    v += amp * noise2D(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2.1;
  }
  return v;
}

interface IslandCfg {
  cx: number;
  cz: number;
  radius: number;
  /** noise sample offset so the two islands aren't twins */
  nx: number;
  nz: number;
  baseAmp: number;
  baseLift: number;
}

const ISLAND1: IslandCfg = { cx: 0, cz: 0, radius: ISLAND_RADIUS, nx: 0, nz: 0, baseAmp: 9, baseLift: 5.5 };
const ISLAND2: IslandCfg = {
  cx: ISLAND2_CENTER.x,
  cz: ISLAND2_CENTER.y,
  radius: ISLAND2_RADIUS,
  nx: 210,
  nz: -170,
  baseAmp: 11.5,
  baseLift: 6.2,
};

function islandHeight(x: number, z: number, cfg: IslandCfg): number {
  const lx = x - cfg.cx;
  const lz = z - cfg.cz;
  const d = Math.hypot(lx, lz) / cfg.radius;
  // radial falloff: 1 at center, 0 at radius, negative beyond (sea floor)
  const falloff = 1 - d * d;
  const base = fbm((lx + cfg.nx) * 0.016, (lz + cfg.nz) * 0.016) * cfg.baseAmp + cfg.baseLift;
  const detail = fbm((lx + cfg.nx) * 0.06 + 40, (lz + cfg.nz) * 0.06 + 40) * 1.4;
  const h = (base + detail) * falloff - 1.6;
  // beyond the island the seafloor blends to a CONSTANT depth: with
  // transparent water, any bumpy noise out there reads as phantom dark
  // mesas through the surface
  if (d > 1) {
    const t = Math.min(1, (d - 1) * 1.8);
    return THREE.MathUtils.lerp(Math.min(h, -1.2), SEA_FLOOR, t);
  }
  return h;
}

/**
 * Sandbars along the crossing: gentle gaussian domes that crest just below
 * SEA_LEVEL, so low tide (~-0.55) walks on them and high tide swallows them.
 * Placed by hand along the island1 -> island2 line — deterministic, no rng.
 */
interface Sandbar {
  x: number;
  z: number;
  radius: number;
  crest: number;
}

// positions chosen so each bar's little mesh square stays clear of both
// island meshes (island 1: |x|,|z| < 85 · island 2: x -375..-225, z -195..-45)
export const SANDBARS: Sandbar[] = [
  { x: -112, z: -40, radius: 13, crest: -0.15 },
  { x: -168, z: -72, radius: 16, crest: -0.1 },
  { x: -205, z: -100, radius: 12, crest: -0.2 },
];

function sandbarHeight(x: number, z: number): number {
  let best = -Infinity;
  for (const s of SANDBARS) {
    const d = Math.hypot(x - s.x, z - s.z) / s.radius;
    if (d >= 1.6) continue;
    // smooth dome rising from the seafloor to the crest
    const dome = THREE.MathUtils.lerp(SEA_FLOOR, s.crest, Math.max(0, 1 - d * d));
    if (dome > best) best = dome;
  }
  return best;
}

/** world-space terrain height at (x, z) */
export function heightAt(x: number, z: number): number {
  const h = Math.max(islandHeight(x, z, ISLAND1), islandHeight(x, z, ISLAND2));
  const bar = sandbarHeight(x, z);
  return bar > h ? bar : h;
}

/** distance-squared helper: which island center is closer to a point */
export function nearerIsland(x: number, z: number): 1 | 2 {
  const d1 = x * x + z * z;
  const dx = x - ISLAND2.cx;
  const dz = z - ISLAND2.cz;
  return dx * dx + dz * dz < d1 ? 2 : 1;
}

/** soft world bound: a big disc around the midpoint of the two islands */
const BOUND_CX = ISLAND2.cx / 2;
const BOUND_CZ = ISLAND2.cz / 2;
const BOUND_R = Math.hypot(ISLAND2.cx / 2, ISLAND2.cz / 2) + 105;
export function insideWorld(x: number, z: number): boolean {
  return Math.hypot(x - BOUND_CX, z - BOUND_CZ) < BOUND_R;
}

/** approximate terrain slope (0 flat .. ~1+ steep) */
export function slopeAt(x: number, z: number): number {
  const e = 0.9;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

interface Palette {
  sand: number;
  sandWet: number;
  grassA: number;
  grassB: number;
  rock: number;
  rockHigh: number;
}

const PALETTE1: Palette = {
  sand: 0xe7d7a7,
  sandWet: 0xd4bd8d,
  grassA: 0x86b85c,
  grassB: 0x6da24d,
  rock: 0x8d8577,
  rockHigh: 0x9c948a,
};

// island 2 reads mossier and stonier — a new place at first sight
const PALETTE2: Palette = {
  sand: 0xe3d3ae,
  sandWet: 0xcbb794,
  grassA: 0x6fa96b,
  grassB: 0x54905a,
  rock: 0x7d7a72,
  rockHigh: 0x93918c,
};

function buildIslandMesh(cfg: IslandCfg, palette: Palette, size: number, segments: number): THREE.Mesh {
  let geo: THREE.BufferGeometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  geo.translate(cfg.cx, 0, cfg.cz);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }

  // non-indexed so each triangle can hold a single flat color — the chunky look
  geo = geo.toNonIndexed();
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  const sand = new THREE.Color(palette.sand);
  const sandWet = new THREE.Color(palette.sandWet);
  const grassA = new THREE.Color(palette.grassA);
  const grassB = new THREE.Color(palette.grassB);
  const rock = new THREE.Color(palette.rock);
  const rockHigh = new THREE.Color(palette.rockHigh);

  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const slope = slopeAt(cx, cz);
    const jitter = noise2D(cx * 0.2, cz * 0.2); // -1..1, stable per location

    if (cy < 0.4) {
      // underwater: wet sand grading down to the deep-floor tone, so every
      // mesh edge that reaches the seafloor matches the ocean plane exactly
      c.copy(sandWet).lerp(DEEP_FLOOR, THREE.MathUtils.clamp((0.4 - cy) / (0.4 - SEA_FLOOR), 0, 1));
    } else if (cy < 1.4) {
      c.copy(sand);
    } else if (slope > 0.75 || cy > 12.5) {
      c.copy(cy > 10 ? rockHigh : rock);
    } else {
      c.lerpColors(grassA, grassB, (jitter + 1) / 2);
    }
    // subtle per-facet value variation sells low-poly
    const v = 1 + jitter * 0.045;
    for (let j = 0; j < 3; j++) {
      colors[(i + j) * 3] = c.r * v;
      colors[(i + j) * 3 + 1] = c.g * v;
      colors[(i + j) * 3 + 2] = c.b * v;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

/** one small mesh per sandbar — they sit outside both island meshes,
 *  so there is never coplanar overlap (z-fighting) with island geometry */
function buildSandbarMeshes(): THREE.Mesh[] {
  return SANDBARS.map((s) => {
    const cfg: IslandCfg = { cx: s.x, cz: s.z, radius: 0, nx: 0, nz: 0, baseAmp: 0, baseLift: 0 };
    return buildIslandMesh(cfg, PALETTE1, s.radius * 3.4, 26);
  });
}

/** flat dark plane far below everything — open ocean is never a void */
function buildOceanFloor(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(1400, 1400);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({ color: 0x1f4550, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(BOUND_CX, SEA_FLOOR - 0.4, BOUND_CZ);
  return mesh;
}

export function buildTerrain(): THREE.Group {
  const g = new THREE.Group();
  g.add(buildIslandMesh(ISLAND1, PALETTE1, 170, 130));
  g.add(buildIslandMesh(ISLAND2, PALETTE2, 150, 115));
  for (const m of buildSandbarMeshes()) g.add(m);
  g.add(buildOceanFloor());
  return g;
}

/**
 * Procedural starter island. Deterministic seed so the island is the same
 * every session (and, later, the same for every player in co-op).
 * heightAt() is analytic — player movement and object placement sample the
 * same function the mesh was built from, so nothing ever sinks or floats.
 */
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

export const SEA_LEVEL = 0;
export const ISLAND_RADIUS = 62;

const SIZE = 170; // world units, square
const SEGMENTS = 130;

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

/** world-space terrain height at (x, z) */
export function heightAt(x: number, z: number): number {
  const d = Math.hypot(x, z) / ISLAND_RADIUS;
  // radial falloff: 1 at center, 0 at radius, negative beyond (sea floor)
  const falloff = 1 - d * d;
  const base = fbm(x * 0.016, z * 0.016) * 9 + 5.5;
  const detail = fbm(x * 0.06 + 40, z * 0.06 + 40) * 1.4;
  const h = (base + detail) * falloff - 1.6;
  // beyond the island radius the noise can poke back above sea level and
  // silhouette as a dark ridge on the horizon — force open ocean instead
  if (d > 1) return Math.min(h, -1.2 - (d - 1) * 6);
  return h;
}

/** approximate terrain slope (0 flat .. ~1+ steep) */
export function slopeAt(x: number, z: number): number {
  const e = 0.9;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

const C_SAND = new THREE.Color(0xe7d7a7);
const C_SAND_WET = new THREE.Color(0xd4bd8d);
const C_GRASS_A = new THREE.Color(0x86b85c);
const C_GRASS_B = new THREE.Color(0x6da24d);
const C_ROCK = new THREE.Color(0x8d8577);
const C_ROCK_HIGH = new THREE.Color(0x9c948a);

export function buildTerrain(): THREE.Mesh {
  let geo: THREE.BufferGeometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }

  // non-indexed so each triangle can hold a single flat color — the chunky look
  geo = geo.toNonIndexed();
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const slope = slopeAt(cx, cz);
    const jitter = noise2D(cx * 0.2, cz * 0.2); // -1..1, stable per location

    if (cy < 0.4) {
      c.copy(C_SAND_WET);
    } else if (cy < 1.4) {
      c.copy(C_SAND);
    } else if (slope > 0.75 || cy > 12.5) {
      c.copy(cy > 10 ? C_ROCK_HIGH : C_ROCK);
    } else {
      c.lerpColors(C_GRASS_A, C_GRASS_B, (jitter + 1) / 2);
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

/**
 * Ambient drifting leaves: a small flock of flat, tumbling planes blown
 * along a fixed wind, falling slowly, recycled near the player so the
 * effect stays visible without simulating the whole island.
 */
import * as THREE from 'three';
import { heightAt, makeRng } from './terrain';

const COUNT = 36;
const COLORS = [0xa8c66c, 0xc9b458, 0x8fb573];
const WIND = new THREE.Vector3(0.6, 0, 0.8).normalize().multiplyScalar(0.5);
const FALL_SPEED = 0.18;
const PLACE_RADIUS = 30;
const RECYCLE_DIST = 35;

const rng = makeRng(6301);

interface Leaf {
  mesh: THREE.Mesh;
  swayPhase: number;
  swaySpeed: number;
  swayAmp: number;
  tumbleX: number;
  tumbleZ: number;
}

export class DriftingLeaves {
  readonly group = new THREE.Group();
  private leaves: Leaf[] = [];
  private clock = 0;

  constructor() {
    const geo = new THREE.PlaneGeometry(0.14, 0.1);
    for (let i = 0; i < COUNT; i++) {
      const mat = new THREE.MeshLambertMaterial({
        color: COLORS[Math.floor(rng() * COLORS.length)],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
        flatShading: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * PLACE_RADIUS;
      mesh.position.set(Math.cos(a) * r, 1 + rng() * 6, Math.sin(a) * r);
      mesh.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
      this.group.add(mesh);
      this.leaves.push({
        mesh,
        swayPhase: rng() * Math.PI * 2,
        swaySpeed: 0.6 + rng() * 0.8,
        swayAmp: 0.25 + rng() * 0.35,
        tumbleX: (rng() - 0.5) * 2.4,
        tumbleZ: (rng() - 0.5) * 2.4,
      });
    }
  }

  private recycle(leaf: Leaf, playerPos: THREE.Vector3) {
    const a = rng() * Math.PI * 2;
    const r = 8 + rng() * 20;
    const x = playerPos.x + Math.cos(a) * r;
    const z = playerPos.z + Math.sin(a) * r;
    leaf.mesh.position.set(x, heightAt(x, z) + 4 + rng() * 4, z);
  }

  update(dt: number, playerPos: THREE.Vector3) {
    this.clock += dt;
    for (const leaf of this.leaves) {
      const m = leaf.mesh;
      const phase = this.clock * leaf.swaySpeed + leaf.swayPhase;
      m.position.x += (WIND.x + Math.cos(phase) * leaf.swayAmp) * dt;
      m.position.z += (WIND.z + Math.sin(phase) * leaf.swayAmp) * dt;
      m.position.y -= FALL_SPEED * dt;
      m.rotation.x += leaf.tumbleX * dt;
      m.rotation.z += leaf.tumbleZ * dt;

      const dist = Math.hypot(m.position.x - playerPos.x, m.position.z - playerPos.z);
      if (m.position.y < heightAt(m.position.x, m.position.z) + 0.15 || dist > RECYCLE_DIST) {
        this.recycle(leaf, playerPos);
      }
    }
  }
}

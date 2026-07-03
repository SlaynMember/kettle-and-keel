/**
 * Gatherable herb clusters, driven entirely by the data registry.
 * Nearest-in-range cluster glows; gathering shrinks it, banks the item,
 * and regrows it after the herb's respawn time.
 */
import * as THREE from 'three';
import { HERBS, type HerbDef } from '../data/items';
import { heightAt, slopeAt, makeRng, ISLAND_RADIUS } from '../world/terrain';
import { store } from '../core/store';
import { audio } from '../audio/audio';

const GATHER_RANGE = 2.6;

interface HerbCluster {
  def: HerbDef;
  group: THREE.Group;
  blossoms: THREE.Mesh[];
  basePos: THREE.Vector3;
  swayPhase: number;
  state: 'grown' | 'gathering' | 'regrowing';
  timer: number;
}

const rng = makeRng(31337);

function buildCluster(def: HerbDef): { group: THREE.Group; blossoms: THREE.Mesh[] } {
  const group = new THREE.Group();
  const blossoms: THREE.Mesh[] = [];
  const leafMat = new THREE.MeshLambertMaterial({ color: def.color, flatShading: true });
  const blossomMat = new THREE.MeshLambertMaterial({
    color: def.blossom,
    emissive: def.blossom,
    emissiveIntensity: 0.12,
    flatShading: true,
  });
  const stems = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < stems; i++) {
    const h = 0.5 + rng() * 0.4;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16, h, 5), leafMat);
    leaf.position.set((rng() - 0.5) * 0.6, h / 2, (rng() - 0.5) * 0.6);
    leaf.rotation.z = (rng() - 0.5) * 0.5;
    group.add(leaf);
    if (rng() > 0.4) {
      const blossom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), blossomMat);
      blossom.position.set(leaf.position.x, h + 0.02, leaf.position.z);
      group.add(blossom);
      blossoms.push(blossom);
    }
  }
  return { group, blossoms };
}

export class HerbField {
  readonly group = new THREE.Group();
  private clusters: HerbCluster[] = [];
  private nearest: HerbCluster | null = null;
  private clock = 0;

  constructor() {
    for (const def of HERBS) {
      for (let i = 0; i < def.count; i++) {
        const pos = this.scatter(def);
        if (!pos) continue;
        const { group, blossoms } = buildCluster(def);
        group.position.copy(pos);
        this.group.add(group);
        this.clusters.push({
          def,
          group,
          blossoms,
          basePos: pos,
          swayPhase: rng() * Math.PI * 2,
          state: 'grown',
          timer: 0,
        });
      }
    }
  }

  private scatter(def: HerbDef): THREE.Vector3 | null {
    for (let tries = 0; tries < 60; tries++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * ISLAND_RADIUS * 0.9;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const h = heightAt(x, z);
      if (h >= def.minH && h <= def.maxH && slopeAt(x, z) < 0.85) {
        return new THREE.Vector3(x, h - 0.03, z);
      }
    }
    return null;
  }

  /** the herb currently in gather range, if any */
  get target(): HerbDef | null {
    return this.nearest?.def ?? null;
  }

  tryGather(): boolean {
    const c = this.nearest;
    if (!c || c.state !== 'grown') return false;
    c.state = 'gathering';
    c.timer = 0;
    store.addItem(c.def.id);
    audio.sfx('sfx-pickup');
    this.nearest = null;
    return true;
  }

  update(dt: number, playerPos: THREE.Vector3) {
    this.clock += dt;

    // nearest grown cluster in range
    let best: HerbCluster | null = null;
    let bestD = GATHER_RANGE;
    for (const c of this.clusters) {
      if (c.state !== 'grown') continue;
      const d = c.basePos.distanceTo(playerPos);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    this.nearest = best;

    for (const c of this.clusters) {
      // gentle sway, all off the same clock
      c.group.rotation.z = Math.sin(this.clock * 1.4 + c.swayPhase) * 0.06;

      if (c.state === 'gathering') {
        c.timer += dt;
        const s = Math.max(0.01, 1 - c.timer * 4);
        c.group.scale.setScalar(s);
        if (c.timer >= 0.28) {
          c.state = 'regrowing';
          c.timer = 0;
          c.group.visible = false;
        }
      } else if (c.state === 'regrowing') {
        c.timer += dt;
        if (c.timer >= c.def.respawn) {
          c.state = 'grown';
          c.group.visible = true;
          c.group.scale.setScalar(0.01);
        }
      } else if (c.group.scale.x < 1) {
        c.group.scale.setScalar(Math.min(1, c.group.scale.x + dt * 1.5));
      }

      // highlight pulse on the targeted cluster
      const isTarget = c === this.nearest;
      for (const b of c.blossoms) {
        const m = b.material as THREE.MeshLambertMaterial;
        m.emissiveIntensity = isTarget ? 0.55 + Math.sin(this.clock * 6) * 0.3 : 0.12;
      }
    }
  }
}

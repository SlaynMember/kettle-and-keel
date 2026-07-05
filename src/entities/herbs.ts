/**
 * Gatherable herb clusters, driven entirely by the data registry.
 * Registered on the shared interaction system; the active cluster glows.
 */
import * as THREE from 'three';
import { HERBS, type HerbDef } from '../data/items';
import { heightAt, slopeAt, makeRng, ISLAND_RADIUS } from '../world/terrain';
import { store } from '../core/store';
import { audio } from '../audio/audio';
import { interactions, type Interactable } from '../core/interact';

interface HerbCluster {
  def: HerbDef;
  group: THREE.Group;
  blossoms: THREE.Mesh[];
  basePos: THREE.Vector3;
  swayPhase: number;
  state: 'grown' | 'gathering' | 'regrowing';
  timer: number;
  inter: Interactable;
}

const rng = makeRng(31337);

/** low bushy beach mint: thin stems, paired rounded leaves, tiny flower spikes */
function buildSeamint(def: HerbDef): { group: THREE.Group; blossoms: THREE.Mesh[] } {
  const group = new THREE.Group();
  const blossoms: THREE.Mesh[] = [];
  const stemMat = new THREE.MeshLambertMaterial({ color: def.color, flatShading: true });
  const blossomMat = new THREE.MeshLambertMaterial({
    color: def.blossom,
    emissive: def.blossom,
    emissiveIntensity: 0.12,
    flatShading: true,
  });

  const stemCount = 2 + Math.floor(rng() * 3); // 2-4
  for (let s = 0; s < stemCount; s++) {
    const h = 0.34 + rng() * 0.18;
    const stemGroup = new THREE.Group();
    stemGroup.position.set((rng() - 0.5) * 0.24, 0, (rng() - 0.5) * 0.24);
    stemGroup.rotation.z = (rng() - 0.5) * 0.4;
    stemGroup.rotation.x = (rng() - 0.5) * 0.3;

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.024, h, 5), stemMat);
    stem.position.y = h / 2;
    stemGroup.add(stem);

    const pairCount = 2 + Math.floor(rng() * 2); // 2-3 pairs, alternating up the stem
    for (let p = 0; p < pairCount; p++) {
      const leafY = ((p + 1) / (pairCount + 1)) * h;
      for (const dir of [-1, 1]) {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08 + rng() * 0.02, 0), stemMat);
        leaf.scale.y = 0.4;
        leaf.position.set(dir * (0.11 + rng() * 0.03), leafY, 0);
        leaf.rotation.z = dir * (1.0 + rng() * 0.3);
        leaf.rotation.y = rng() * Math.PI;
        stemGroup.add(leaf);
      }
    }

    const tipCount = 2 + Math.floor(rng() * 2); // 2-3 tiny spheres per spike
    for (let t = 0; t < tipCount; t++) {
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.042, 6, 5), blossomMat);
      bloom.position.set((rng() - 0.5) * 0.06, h + 0.03 + t * 0.04, (rng() - 0.5) * 0.06);
      stemGroup.add(bloom);
      blossoms.push(bloom);
    }

    group.add(stemGroup);
  }

  return { group, blossoms };
}

/** highland flower: broad rosette leaves at the base, daisy-like flower heads on rising stems */
function buildEmberbloom(def: HerbDef): { group: THREE.Group; blossoms: THREE.Mesh[] } {
  const group = new THREE.Group();
  const blossoms: THREE.Mesh[] = [];
  const leafMat = new THREE.MeshLambertMaterial({ color: def.color, flatShading: true });
  const stemMat = new THREE.MeshLambertMaterial({ color: def.color, flatShading: true });
  const centerMat = new THREE.MeshLambertMaterial({
    color: 0xf4b860,
    emissive: 0xf4b860,
    emissiveIntensity: 0.12,
    flatShading: true,
  });
  const petalMat = new THREE.MeshLambertMaterial({
    color: def.blossom,
    emissive: def.blossom,
    emissiveIntensity: 0.12,
    flatShading: true,
  });

  // base rosette
  const leafCount = 4 + Math.floor(rng() * 2); // 4-5
  for (let i = 0; i < leafCount; i++) {
    const a = (i / leafCount) * Math.PI * 2 + rng() * 0.3;
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15 + rng() * 0.02, 0), leafMat);
    leaf.scale.y = 0.3;
    leaf.position.set(Math.cos(a) * 0.1, 0.06, Math.sin(a) * 0.1);
    leaf.rotation.y = -a;
    leaf.rotation.x = -0.35 - rng() * 0.15; // angled slightly up
    group.add(leaf);
  }

  // flower stems rising from the rosette
  const stemCount = 2 + Math.floor(rng() * 2); // 2-3
  for (let s = 0; s < stemCount; s++) {
    const h = 0.5 + rng() * 0.18;
    const stemGroup = new THREE.Group();
    stemGroup.position.set((rng() - 0.5) * 0.14, 0, (rng() - 0.5) * 0.14);
    stemGroup.rotation.z = (rng() - 0.5) * 0.2;
    stemGroup.rotation.x = (rng() - 0.5) * 0.2;

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, h, 5), stemMat);
    stem.position.y = h / 2;
    stemGroup.add(stem);

    const headGroup = new THREE.Group();
    headGroup.position.y = h;

    const center = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), centerMat);
    headGroup.add(center);
    blossoms.push(center);

    const petalCount = 5 + Math.floor(rng() * 2); // 5-6
    for (let p = 0; p < petalCount; p++) {
      const pa = (p / petalCount) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), petalMat);
      petal.scale.y = 0.25;
      petal.position.set(Math.cos(pa) * 0.09, 0.01, Math.sin(pa) * 0.09);
      petal.rotation.z = Math.cos(pa) * 0.5;
      petal.rotation.x = Math.sin(pa) * 0.5;
      petal.rotation.y = pa;
      headGroup.add(petal);
      blossoms.push(petal);
    }

    stemGroup.add(headGroup);
    group.add(stemGroup);
  }

  return { group, blossoms };
}

function buildCluster(def: HerbDef): { group: THREE.Group; blossoms: THREE.Mesh[] } {
  return def.id === 'seamint' ? buildSeamint(def) : buildEmberbloom(def);
}

export class HerbField {
  readonly group = new THREE.Group();
  private clusters: HerbCluster[] = [];
  private clock = 0;

  constructor(private onGather: () => void, private toast: (msg: string) => void) {
    for (const def of HERBS) {
      for (let i = 0; i < def.count; i++) {
        const pos = this.scatter(def);
        if (!pos) continue;
        const { group, blossoms } = buildCluster(def);
        group.position.copy(pos);
        this.group.add(group);
        const cluster: HerbCluster = {
          def,
          group,
          blossoms,
          basePos: pos,
          swayPhase: rng() * Math.PI * 2,
          state: 'grown',
          timer: 0,
          inter: null as never,
        };
        cluster.inter = {
          label: () => (cluster.state === 'grown' ? `Gather ${def.name}` : null),
          position: pos,
          range: 2.6,
          priority: 0,
          action: () => this.gather(cluster),
        };
        interactions.add(cluster.inter);
        this.clusters.push(cluster);
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

  private gather(c: HerbCluster) {
    if (c.state !== 'grown') return;
    c.state = 'gathering';
    c.timer = 0;
    store.addItem(c.def.id);
    audio.sfx('sfx-pickup');
    this.onGather();
    this.toast(`+1 ${c.def.name}`);
  }

  update(dt: number) {
    this.clock += dt;
    for (const c of this.clusters) {
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

      const isTarget = interactions.active === c.inter;
      for (const b of c.blossoms) {
        const m = b.material as THREE.MeshLambertMaterial;
        m.emissiveIntensity = isTarget ? 0.55 + Math.sin(this.clock * 6) * 0.3 : 0.12;
      }
    }
  }
}

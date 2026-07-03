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

/**
 * Life past the reef (v3). Three kinds of seafloor content, all reached by
 * diving (entities/player.ts breath system):
 *   kelp forests — tall swaying ribbons, gatherable, respawn
 *   oysters      — pry a pearl loose, long respawn
 *   sunken cargo — three one-time crates along the crossing, persisted
 * Everything registers on the shared interaction system; proximity is 3D
 * distance, so the prompts only appear once you've actually dived down.
 */
import * as THREE from 'three';
import { heightAt, makeRng, ISLAND_RADIUS, ISLAND2_CENTER, ISLAND2_RADIUS } from '../world/terrain';
import { interactions } from '../core/interact';
import { store } from '../core/store';
import { audio } from '../audio/audio';

const rng = makeRng(70503);

const KELP_RESPAWN = 75;
const OYSTER_RESPAWN = 240;

interface FloorNode {
  kind: 'kelp' | 'oyster';
  group: THREE.Group;
  basePos: THREE.Vector3;
  swayPhase: number;
  state: 'alive' | 'gone';
  timer: number;
}

/** deterministic ring scatter around an island, constrained to a depth band */
function scatterRing(
  cx: number,
  cz: number,
  radius: number,
  rMin: number,
  rMax: number,
  minH: number,
  maxH: number
): THREE.Vector3 | null {
  for (let tries = 0; tries < 50; tries++) {
    const a = rng() * Math.PI * 2;
    const r = radius * (rMin + rng() * (rMax - rMin));
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    const h = heightAt(x, z);
    if (h >= minH && h <= maxH) return new THREE.Vector3(x, h, z);
  }
  return null;
}

function buildKelp(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x2e7d5b, flatShading: true });
  const matLight = new THREE.MeshLambertMaterial({ color: 0x3f9a6e, flatShading: true });
  const ribbons = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < ribbons; i++) {
    const h = 1.8 + rng() * 1.6;
    const ribbon = new THREE.Mesh(new THREE.ConeGeometry(0.16, h, 4), rng() > 0.5 ? mat : matLight);
    ribbon.scale.z = 0.35; // flattened cone reads as a ribbon
    ribbon.position.set((rng() - 0.5) * 0.9, h / 2, (rng() - 0.5) * 0.9);
    ribbon.rotation.y = rng() * Math.PI;
    ribbon.rotation.z = (rng() - 0.5) * 0.25;
    g.add(ribbon);
  }
  return g;
}

function buildOyster(): THREE.Group {
  const g = new THREE.Group();
  const shellMat = new THREE.MeshLambertMaterial({ color: 0x9a8f7d, flatShading: true });
  const lower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 0), shellMat);
  lower.scale.y = 0.35;
  lower.position.y = 0.1;
  const upper = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), shellMat);
  upper.scale.y = 0.3;
  upper.position.y = 0.26;
  upper.rotation.z = 0.35; // slightly agape — something gleams inside
  const pearl = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xf6f0e6, emissive: 0xd8cfc0, emissiveIntensity: 0.35 })
  );
  pearl.position.set(0.1, 0.2, 0);
  pearl.name = 'pearl';
  g.add(lower, upper, pearl);
  return g;
}

function buildCrate(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x6b5233, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x51402a, flatShading: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.9), wood);
  body.position.y = 0.4;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.14, 0.96), dark);
  lid.position.y = 0.85;
  lid.name = 'lid';
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.12, 0.94), dark);
  band.position.y = 0.4;
  g.add(body, lid, band);
  g.rotation.y = 0.7;
  g.rotation.z = 0.12; // settled crooked into the sand
  return g;
}

interface CargoDef {
  x: number;
  z: number;
  contents: Partial<Record<string, number>>;
  note: string;
}

/** along the crossing, shallow to deep — the deep one holds the pearls */
const CARGO: CargoDef[] = [
  { x: -72, z: -18, contents: { wood: 8 }, note: 'Good planks, barely swollen. +8 Wood' },
  { x: -160, z: -68, contents: { stone: 6 }, note: 'Ballast stones, still dry inside. +6 Stone' },
  { x: -240, z: -100, contents: { pearl: 2, algae: 3 }, note: 'A pearl merchant’s loss. +2 Pearl, +3 Algae' },
];

export class Seafloor {
  readonly group = new THREE.Group();
  private nodes: FloorNode[] = [];
  private crates: Array<{ group: THREE.Group; index: number }> = [];
  private clock = 0;

  constructor(private onGather: () => void, toast: (msg: string) => void) {
    // kelp forests: island 1 reef ring + a few off island 2 + near the bars
    for (let i = 0; i < 14; i++) {
      const p = scatterRing(0, 0, ISLAND_RADIUS, 1.06, 1.32, -5.2, -1.5);
      if (p) this.addNode('kelp', buildKelp(), p, toast);
    }
    for (let i = 0; i < 7; i++) {
      const p = scatterRing(ISLAND2_CENTER.x, ISLAND2_CENTER.y, ISLAND2_RADIUS, 1.06, 1.3, -5.2, -1.5);
      if (p) this.addNode('kelp', buildKelp(), p, toast);
    }

    // oysters: deeper than kelp — earn the pearl
    for (let i = 0; i < 7; i++) {
      const p = scatterRing(0, 0, ISLAND_RADIUS, 1.15, 1.4, -6.5, -2.5);
      if (p) this.addNode('oyster', buildOyster(), p, toast);
    }
    for (let i = 0; i < 4; i++) {
      const p = scatterRing(ISLAND2_CENTER.x, ISLAND2_CENTER.y, ISLAND2_RADIUS, 1.12, 1.35, -6.5, -2.5);
      if (p) this.addNode('oyster', buildOyster(), p, toast);
    }

    // sunken cargo: three fixed crates, one-time, persisted
    CARGO.forEach((def, index) => {
      const g = buildCrate();
      const y = heightAt(def.x, def.z);
      g.position.set(def.x, y, def.z);
      this.group.add(g);
      this.crates.push({ group: g, index });
      if (store.get().cargoCollected.includes(index)) this.openLid(g);
      interactions.add({
        label: () => (store.get().cargoCollected.includes(index) ? null : 'Open the sodden crate'),
        position: g.position,
        range: 2.6,
        priority: 2,
        action: () => {
          if (store.get().cargoCollected.includes(index)) return;
          for (const [id, qty] of Object.entries(def.contents)) store.addItem(id, qty ?? 0);
          store.set({ cargoCollected: [...store.get().cargoCollected, index] });
          this.openLid(g);
          this.onGather();
          audio.sfx('sfx-levelup');
          toast(def.note);
        },
      });
    });
  }

  private openLid(crate: THREE.Group) {
    const lid = crate.getObjectByName('lid');
    if (lid) {
      lid.rotation.x = -1.1;
      lid.position.z = -0.55;
      lid.position.y = 0.7;
    }
  }

  private addNode(kind: 'kelp' | 'oyster', mesh: THREE.Group, p: THREE.Vector3, toast: (msg: string) => void) {
    mesh.position.copy(p);
    this.group.add(mesh);
    const node: FloorNode = { kind, group: mesh, basePos: p.clone(), swayPhase: rng() * Math.PI * 2, state: 'alive', timer: 0 };
    interactions.add({
      label: () => (node.state === 'alive' ? (kind === 'kelp' ? 'Gather Kelp' : 'Pry Pearl') : null),
      position: node.basePos,
      range: 2.7,
      priority: 1,
      action: () => {
        if (node.state !== 'alive') return;
        node.state = 'gone';
        node.timer = 0;
        node.group.visible = false;
        store.addItem(kind === 'kelp' ? 'kelp' : 'pearl', 1);
        this.onGather();
        audio.sfx('sfx-pickup');
        toast(kind === 'kelp' ? '+1 Kelp' : '+1 Pearl — cold and perfect');
      },
    });
    this.nodes.push(node);
  }

  update(dt: number) {
    this.clock += dt;
    for (const n of this.nodes) {
      if (n.state === 'gone') {
        n.timer += dt;
        if (n.timer >= (n.kind === 'kelp' ? KELP_RESPAWN : OYSTER_RESPAWN)) {
          n.state = 'alive';
          n.group.visible = true;
          n.group.scale.setScalar(0.01);
        }
      } else if (n.group.scale.x < 1) {
        n.group.scale.setScalar(Math.min(1, n.group.scale.x + dt * 1.2));
      }
      if (n.kind === 'kelp' && n.state === 'alive') {
        n.group.rotation.z = Math.sin(this.clock * 0.9 + n.swayPhase) * 0.16;
        n.group.rotation.x = Math.cos(this.clock * 0.7 + n.swayPhase) * 0.1;
      }
    }
  }
}

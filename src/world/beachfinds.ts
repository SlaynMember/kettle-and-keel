/**
 * One small washed-ashore find spawns on the beach at dawn each in-game day.
 * Deterministic per day (makeRng), same spirit as props.ts's wreck: same find,
 * same spot, for every player on that day. Four kinds award items outright;
 * the bottle opens a note (ui/cards.ts) instead. All animation off this
 * system's own clock.
 */
import * as THREE from 'three';
import { heightAt, makeRng } from './terrain';
import { interactions } from '../core/interact';
import { store } from '../core/store';
import { ITEM_BY_ID, type ItemId } from '../data/items';
import { BOTTLE_NOTES } from '../data/dialogue';
import { audio } from '../audio/audio';

type FindKind = 'driftwood' | 'bottle' | 'algae' | 'crate' | 'pouch';

const KINDS: FindKind[] = ['driftwood', 'bottle', 'algae', 'crate', 'pouch'];

const FIND_CFG: Record<FindKind, { blurb: string; reward: Partial<Record<ItemId, number>>; prompt: string }> = {
  driftwood: {
    blurb: 'Dawn nudges a bundle of driftwood onto the sand. The sea claims it was always there.',
    reward: { wood: 2 },
    prompt: 'Gather driftwood',
  },
  bottle: {
    blurb: 'A sealed bottle knocks against the beach rocks until someone notices.',
    reward: {},
    prompt: 'Open the bottle',
  },
  algae: {
    blurb: 'The tide leaves a ribbon of algae across the shallows, slick and shining.',
    reward: { algae: 2 },
    prompt: 'Gather the algae ribbon',
  },
  crate: {
    blurb: 'A cracked crate washes in with one good plank and several bad smells.',
    reward: { wood: 1, stone: 1 },
    prompt: 'Pry open the crate',
  },
  pouch: {
    blurb: 'A damp pouch lies above the tide line, full of sand and one useful stone.',
    reward: { sand: 1, stone: 1 },
    prompt: 'Pick up the pouch',
  },
};

function buildDriftwoodMesh(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x8a5a3b, flatShading: true });
  for (let i = 0; i < 3; i++) {
    const plank = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.85 + i * 0.12, 5), mat);
    plank.rotation.z = Math.PI / 2;
    plank.rotation.y = (i - 1) * 0.4;
    plank.position.set((i - 1) * 0.14, 0.08, (i - 1) * 0.08);
    g.add(plank);
  }
  return g;
}

function buildBottleMesh(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({
    color: 0x6f9d84,
    flatShading: true,
    emissive: 0x6f9d84,
    emissiveIntensity: 0.08,
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.42, 8), mat);
  body.position.y = 0.14;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.22, 7), mat);
  neck.position.set(0.24, 0.27, 0);
  neck.rotation.z = Math.PI / 2.3;
  g.add(body, neck);
  g.rotation.z = Math.PI / 2.8; // lying tilted
  return g;
}

function buildAlgaeFindMesh(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x2f6b4f, flatShading: true });
  for (let i = 0; i < 3; i++) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.95 - i * 0.16, 0.03, 0.16), mat);
    strip.position.set(0, 0.02, (i - 1) * 0.14);
    strip.rotation.y = (i - 1) * 0.3;
    g.add(strip);
  }
  return g;
}

function buildCrateMesh(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x8a5a3b, flatShading: true });
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.55), mat);
  bottom.position.y = 0.03;
  const front = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.06), mat);
  front.position.set(0, 0.23, 0.27);
  const back = front.clone();
  back.position.z = -0.27;
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.55), mat);
  left.position.set(-0.27, 0.23, 0);
  // right side torn off — shorter, tilted, the missing corner
  const rightBroken = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.38), mat);
  rightBroken.position.set(0.27, 0.15, -0.06);
  rightBroken.rotation.z = 0.3;
  g.add(bottom, front, back, left, rightBroken);
  g.rotation.y = 0.4;
  return g;
}

function buildPouchMesh(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x8a7350, flatShading: true });
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat);
  sack.scale.set(1, 0.72, 1);
  sack.position.y = 0.16;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.14, 6), mat);
  neck.position.y = 0.34;
  g.add(sack, neck);
  return g;
}

function buildFindMesh(kind: FindKind): THREE.Group {
  if (kind === 'driftwood') return buildDriftwoodMesh();
  if (kind === 'bottle') return buildBottleMesh();
  if (kind === 'algae') return buildAlgaeFindMesh();
  if (kind === 'crate') return buildCrateMesh();
  return buildPouchMesh();
}

/**
 * Ring-scan for a sand-height spot, same pattern as props.ts's findWreckSpot:
 * walk outward from a target point until a cell lands in the beach band.
 * The target sits `dist` out from `anchor` along a deterministic angle, so
 * the result stays a short walk (never underfoot) without ever touching
 * Math.random.
 */
function findBeachSpot(anchor: THREE.Vector3, angle: number): THREE.Vector3 | null {
  const DIST = 20;
  const targetX = anchor.x + Math.cos(angle) * DIST;
  const targetZ = anchor.z + Math.sin(angle) * DIST;
  const step = 1.5;
  for (let ring = 0; ring < 14; ring++) {
    for (let dz = -ring; dz <= ring; dz++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        const x = targetX + dx * step;
        const z = targetZ + dz * step;
        const h = heightAt(x, z);
        if (h < 0.8 || h > 1.5) continue;
        if (Math.hypot(x - anchor.x, z - anchor.z) <= 8) continue;
        return new THREE.Vector3(x, h, z);
      }
    }
  }
  return null;
}

export class BeachFinds {
  readonly group = new THREE.Group();
  /** fired for the bottle kind; main.ts wires this to cards.note(...) */
  onNote: ((text: string) => void) | null = null;

  private mesh: THREE.Group | null = null;
  private meshKind: FindKind | null = null;
  private meshBasePos = new THREE.Vector3();
  private removeInteract: (() => void) | null = null;
  private clock = 0;

  constructor(private toast: (msg: string) => void) {
    const saved = store.get().beachFind;
    if (saved && saved.day === store.get().day && !saved.collected && (KINDS as string[]).includes(saved.kind)) {
      const pos = new THREE.Vector3(saved.x, heightAt(saved.x, saved.z), saved.z);
      this.spawnMesh(saved.kind as FindKind, pos);
    }
  }

  /** call once per frame; only does work in the dawn window and once per day */
  spawnIfDue(day: number, time: number, anchor: THREE.Vector3) {
    if (time < 0.25 || time >= 0.32) return;
    const existing = store.get().beachFind;
    if (existing && existing.day === day) return; // already spawned (or collected) today

    this.despawnMesh(); // the tide takes back whatever the previous day left

    const rng = makeRng(day * 7919 + 11);
    const kind = KINDS[Math.floor(rng() * KINDS.length)];
    const angle = rng() * Math.PI * 2;
    const spot = findBeachSpot(anchor, angle);
    if (!spot) return;

    store.set({ beachFind: { day, kind, x: spot.x, z: spot.z, collected: false } });
    this.spawnMesh(kind, spot);
    this.toast(FIND_CFG[kind].blurb);
  }

  update(dt: number) {
    if (!this.mesh) return;
    this.clock += dt;
    this.mesh.position.y = this.meshBasePos.y + Math.sin(this.clock * 1.4) * 0.03;
  }

  private spawnMesh(kind: FindKind, pos: THREE.Vector3) {
    const mesh = buildFindMesh(kind);
    mesh.position.copy(pos);
    mesh.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    this.group.add(mesh);
    this.mesh = mesh;
    this.meshKind = kind;
    this.meshBasePos = pos.clone();
    const interactPos = mesh.position;
    this.removeInteract = interactions.add({
      label: () => FIND_CFG[kind].prompt,
      position: interactPos,
      range: 2.6,
      priority: 1,
      action: () => this.collect(kind),
    });
  }

  private despawnMesh() {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh = null;
    }
    this.removeInteract?.();
    this.removeInteract = null;
    this.meshKind = null;
  }

  private collect(kind: FindKind) {
    const data = store.get().beachFind;
    if (!data || data.collected || this.meshKind !== kind) return;

    if (kind === 'bottle') {
      const note = BOTTLE_NOTES[(data.day * 13 + 5) % BOTTLE_NOTES.length];
      this.onNote?.(note);
      audio.sfx('sfx-ui-click');
    } else {
      const reward = FIND_CFG[kind].reward;
      const parts: string[] = [];
      for (const [id, qty] of Object.entries(reward)) {
        store.addItem(id, qty);
        parts.push(`+${qty} ${ITEM_BY_ID.get(id as ItemId)?.name ?? id}`);
      }
      audio.sfx('sfx-pickup');
      this.toast(parts.join(', '));
    }

    store.set({ beachFind: { ...data, collected: true } });
    this.despawnMesh();
  }
}

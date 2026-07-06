/**
 * Sharks (v3) — the reason the boat matters. Deep water only, and strictly
 * cozy-with-stakes: a bump costs you one floating item and a shove toward
 * safety. No health bar, no death, no blood. On the boat you are invisible
 * to them; on a sandbar you are safe; past the reef on your own lungs,
 * you are a curiosity.
 */
import * as THREE from 'three';
import { heightAt, makeRng, ISLAND2_CENTER } from '../world/terrain';
import { getWaterLevel } from '../world/tide';
import { interactions } from '../core/interact';
import { store } from '../core/store';
import { audio } from '../audio/audio';
import { ITEM_BY_ID, type ItemId } from '../data/items';
import type { Player } from './player';

const rng = makeRng(66604);

// patrols live in the open crossing, NOT on the islands' reef rings — the
// home reef is where you learn to dive; the deep gap is where it costs you
const PATROLS = [
  { cx: -112, cz: -42, r: 13, speed: 3.6 },
  { cx: -162, cz: -70, r: 24, speed: 4.2 },
  { cx: -222, cz: -95, r: 18, speed: 3.9 },
];

const HUNT_RANGE = 26;
const HUNT_SPEED = 7.5;
const DEEP_WATER = 3.2; // seafloor at least this far under the surface
const BUMP_DIST = 1.5;
const GLOBAL_COOLDOWN = 9; // seconds between bumps, across all sharks
const SHOVE_STRENGTH = 9;
const SHOVE_DECAY = 2.2;

/** what a shark can knock out of your satchel — floaty things first */
const DROPPABLE: ItemId[] = ['wood', 'kelp', 'algae', 'sand', 'dirt', 'stone', 'loam'];

interface Shark {
  group: THREE.Group;
  patrol: (typeof PATROLS)[number];
  angle: number;
  state: 'patrol' | 'hunt';
  pos: THREE.Vector3;
}

interface FloatingDrop {
  group: THREE.Group;
  itemId: ItemId;
  remove: () => void;
  bobPhase: number;
}

function buildShark(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x5c6c74, flatShading: true });
  const finMat = new THREE.MeshLambertMaterial({ color: 0x46545c, flatShading: true });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 2.2, 3, 7), bodyMat);
  body.rotation.z = Math.PI / 2; // long axis along +x (travel)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 6), bodyMat);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 1.55;
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.85, 4), finMat);
  fin.scale.z = 0.4;
  fin.position.y = 0.75;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 4), finMat);
  tail.scale.z = 0.35;
  tail.position.set(-1.65, 0.15, 0);
  tail.rotation.z = 0.6;
  g.add(body, nose, fin, tail);
  return g;
}

function buildDropMesh(emoji: string): THREE.Group {
  // a little bobbing crate-let with the item riding on top is overkill;
  // a pale flotsam bundle reads fine and any item can wear it
  const g = new THREE.Group();
  const bundle = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.32, 0),
    new THREE.MeshLambertMaterial({ color: 0xd9c9a3, flatShading: true })
  );
  bundle.scale.y = 0.6;
  bundle.position.y = 0.05;
  g.add(bundle);
  void emoji;
  return g;
}

export class Sharks {
  readonly group = new THREE.Group();
  private sharks: Shark[] = [];
  private drops: FloatingDrop[] = [];
  private shove = new THREE.Vector3();
  private cooldown = 0;
  private clock = 0;
  /** main.ts flips this while the player is aboard the boat */
  playerAboard = false;

  constructor(private player: Player, private toast: (msg: string) => void) {
    for (const patrol of PATROLS) {
      const g = buildShark();
      g.rotation.order = 'YXZ';
      const shark: Shark = { group: g, patrol, angle: rng() * Math.PI * 2, state: 'patrol', pos: new THREE.Vector3() };
      shark.pos.set(patrol.cx + Math.cos(shark.angle) * patrol.r, 0, patrol.cz + Math.sin(shark.angle) * patrol.r);
      this.group.add(g);
      this.sharks.push(shark);
    }
  }

  /** is the player currently fair game? */
  private playerExposed(): boolean {
    if (this.playerAboard || !this.player.swimming) return false;
    const p = this.player.position;
    return heightAt(p.x, p.z) < getWaterLevel() - DEEP_WATER;
  }

  /** nearest safety: island 1, island 2, or the moored boat */
  private refugeDirection(): THREE.Vector3 {
    const p = this.player.position;
    const targets: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(ISLAND2_CENTER.x, 0, ISLAND2_CENTER.y)];
    const b = store.get().boat;
    if (b.stage === 2) targets.push(new THREE.Vector3(b.x, 0, b.z));
    let best = targets[0];
    let bestD = Infinity;
    for (const t of targets) {
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return new THREE.Vector3(best.x - p.x, 0, best.z - p.z).normalize();
  }

  private bump(shark: Shark) {
    this.cooldown = GLOBAL_COOLDOWN;
    shark.state = 'patrol';
    this.shove.copy(this.refugeDirection()).multiplyScalar(SHOVE_STRENGTH);

    const dropId = DROPPABLE.find((id) => store.count(id) > 0);
    if (dropId) {
      store.addItem(dropId, -1);
      const def = ITEM_BY_ID.get(dropId)!;
      const g = buildDropMesh(def.emoji);
      const p = this.player.position;
      g.position.set(p.x + (rng() - 0.5) * 4, getWaterLevel(), p.z + (rng() - 0.5) * 4);
      this.group.add(g);
      const drop: FloatingDrop = { group: g, itemId: dropId, bobPhase: rng() * Math.PI * 2, remove: () => {} };
      drop.remove = interactions.add({
        label: () => `Scoop up ${def.name}`,
        position: g.position,
        range: 3.0,
        priority: 2,
        action: () => {
          store.addItem(dropId, 1);
          audio.sfx('sfx-pickup');
          this.toast(`+1 ${def.name}, barely salvaged`);
          this.group.remove(g);
          drop.remove();
          this.drops = this.drops.filter((d) => d !== drop);
        },
      });
      this.drops.push(drop);
      this.toast(`A grey shadow barrels past! Your ${def.name.toLowerCase()} bobs away…`);
    } else {
      this.toast('A grey shadow shoulders you toward the shallows!');
    }
    audio.sfx('sfx-cast');
  }

  update(dt: number) {
    this.clock += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const water = getWaterLevel();

    // apply and decay the bump shove
    if (this.shove.lengthSq() > 0.01) {
      this.player.position.x += this.shove.x * dt;
      this.player.position.z += this.shove.z * dt;
      this.shove.multiplyScalar(Math.max(0, 1 - SHOVE_DECAY * dt));
    }

    const exposed = this.playerExposed();
    for (const s of this.sharks) {
      if (s.state === 'patrol') {
        s.angle += (s.patrol.speed / s.patrol.r) * dt;
        const tx = s.patrol.cx + Math.cos(s.angle) * s.patrol.r;
        const tz = s.patrol.cz + Math.sin(s.angle) * s.patrol.r;
        const heading = Math.atan2(tx - s.pos.x, tz - s.pos.z);
        s.pos.set(tx, 0, tz);
        s.group.rotation.y = heading - Math.PI / 2;
        if (exposed && this.cooldown <= 0) {
          const d = Math.hypot(this.player.position.x - s.pos.x, this.player.position.z - s.pos.z);
          if (d < HUNT_RANGE) s.state = 'hunt';
        }
      } else {
        // hunt: straight run at the swimmer; break off if they reach safety
        if (!exposed || this.cooldown > 0) {
          s.state = 'patrol';
        } else {
          const p = this.player.position;
          const dx = p.x - s.pos.x;
          const dz = p.z - s.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < BUMP_DIST) {
            this.bump(s);
          } else {
            s.pos.x += (dx / d) * HUNT_SPEED * dt;
            s.pos.z += (dz / d) * HUNT_SPEED * dt;
            s.group.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
          }
        }
      }
      // ride just under the surface, fin proud of it; sink to the swimmer's depth mid-hunt
      const targetY = s.state === 'hunt' ? Math.min(water - 0.7, this.player.position.y + 0.2) : water - 0.55;
      s.pos.y = THREE.MathUtils.lerp(s.pos.y || targetY, targetY, Math.min(1, 2.5 * dt));
      s.group.position.copy(s.pos);
      // lazy tail-swish roll
      s.group.rotation.z = Math.sin(this.clock * 3 + s.patrol.cx) * 0.06;
    }

    // drops bob on the surface
    for (const d of this.drops) {
      d.group.position.y = water + Math.sin(this.clock * 1.6 + d.bobPhase) * 0.12;
    }
  }
}

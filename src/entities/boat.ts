/**
 * The keel half of the game's name (v3). One system owns the whole arc:
 *   stage 0 — the wreck on the west beach (flavor lines, then a rebuild prompt)
 *   stage 1 — hull rebuilt on the sand, waiting for a mast and sail
 *   stage 2 — launched: moored offshore, boardable, sailable
 * Sailing is boat-relative steering (forward = thrust, sideways = rudder),
 * the hull bobs on the same wave function the water shader displaces with,
 * and running aground just stops the keel — cozy, never punishing.
 */
import * as THREE from 'three';
import { heightAt, insideWorld } from '../world/terrain';
import { getWaterLevel } from '../world/tide';
import { interactions } from '../core/interact';
import { store } from '../core/store';
import { audio } from '../audio/audio';
import type { Water } from '../world/water';
import type { Wreck } from '../world/props';
import type { Player } from './player';

const HULL_COST = { wood: 14, stone: 4 };
const RIG_COST = { wood: 6, algae: 8 };

const MAX_SPEED = 12;
const REVERSE_SPEED = 2.5;
const ACCEL = 4.5;
const DRAG = 1.6;
const TURN_RATE = 1.25;
const DRAFT = 0.7; // min water under the keel; shallower = aground
const BOB_DRAFT = 0.2; // how deep the hull sits below the bobbing surface

const WRECK_LINES = [
  "The hull's split like old bread. She won't sail today.",
  'Good keel under the barnacles. Worth saving.',
  "You'll need wood. A lot of it. And a reason.",
  'The gull left a feather on the bow. Sentimental, or littering.',
];

const WOOD = new THREE.MeshLambertMaterial({ color: 0x8a5a3b, flatShading: true });
const WOOD_DARK = new THREE.MeshLambertMaterial({ color: 0x54341e, flatShading: true });
const SAIL = new THREE.MeshLambertMaterial({ color: 0xf2e9d8, flatShading: true, side: THREE.DoubleSide });

function buildBoatMesh(withRig: boolean): { group: THREE.Group; sail: THREE.Mesh | null } {
  const g = new THREE.Group();

  // keel line, bow to stern along +x
  const keel = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.26, 0.26), WOOD_DARK);
  keel.position.y = 0.12;
  g.add(keel);

  // hull sides: two strakes per side, flaring outward
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const len = 4.2 - i * 0.5;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(len, 0.36, 0.1), i % 2 ? WOOD_DARK : WOOD);
      plank.position.set(0, 0.32 + i * 0.32, side * (0.42 + i * 0.14));
      plank.rotation.x = side * -0.42;
      g.add(plank);
    }
  }
  // bow + stern posts
  const bow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.2, 0.28), WOOD_DARK);
  bow.position.set(2.2, 0.55, 0);
  bow.rotation.z = -0.3;
  const stern = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.85, 0.9), WOOD);
  stern.position.set(-2.1, 0.5, 0);
  g.add(bow, stern);

  // deck boards + a little seat at the tiller
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 0.95), WOOD);
  deck.position.y = 0.42;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.95), WOOD_DARK);
  seat.position.set(-1.55, 0.62, 0);
  g.add(deck, seat);

  let sail: THREE.Mesh | null = null;
  if (withRig) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.4, 6), WOOD);
    mast.position.set(0.5, 2.1, 0);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 5), WOOD);
    boom.rotation.z = Math.PI / 2;
    boom.position.set(-0.65, 1.05, 0);
    // the algae-woven sail: a simple triangle between mast top and boom end
    const sailGeo = new THREE.BufferGeometry();
    sailGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([
          0.5, 3.6, 0, // mast top
          0.5, 1.05, 0, // mast at boom
          -1.8, 1.05, 0, // boom end
        ]),
        3
      )
    );
    sailGeo.computeVertexNormals();
    sail = new THREE.Mesh(sailGeo, SAIL);
    g.add(mast, boom, sail);

    const tiller = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.0, 5), WOOD_DARK);
    tiller.position.set(-2.0, 0.85, 0);
    tiller.rotation.z = 0.7;
    g.add(tiller);
  }

  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { group: g, sail };
}

export class Boat {
  readonly group = new THREE.Group();
  /** true while the player is aboard; main.ts routes input here instead of the player */
  sailing = false;
  readonly position = new THREE.Vector3();
  heading = 0;
  private speed = 0;
  private hull: THREE.Group | null = null; // stage 1: on the sand
  private vessel: THREE.Group | null = null; // stage 2: afloat
  private sail: THREE.Mesh | null = null;
  private wreckLineIndex = 0;
  private persistTimer = 0;
  private agroundToastCooldown = 0;

  /** main.ts: player boarded/left — gate the world's input routing on this */
  onBoardChange: ((aboard: boolean) => void) | null = null;

  constructor(
    private wreck: Wreck | null,
    private water: Water,
    private player: Player,
    private toast: (msg: string) => void
  ) {
    const b = store.get().boat;
    if (b.stage >= 1 && wreck) this.showHullOnSand();
    if (b.stage === 2) this.launch(b.x, b.z, b.heading, true);

    // one interactable owns the whole wreck-site arc (stage 0 and 1)
    if (wreck) {
      interactions.add({
        label: () => this.wreckLabel(),
        position: wreck.position,
        range: 3.4,
        priority: 2,
        action: () => this.useWreckSite(),
      });
    }
  }

  private get stage(): 0 | 1 | 2 {
    return store.get().boat.stage;
  }

  private wreckLabel(): string | null {
    if (this.stage === 0) {
      return store.count('wood') >= HULL_COST.wood && store.count('stone') >= HULL_COST.stone
        ? 'Rebuild the hull (14 wood, 4 stone)'
        : 'Inspect the wreck';
    }
    if (this.stage === 1) return 'Rig mast & sail (6 wood, 8 algae)';
    return null; // stage 2: she's in the water now
  }

  private useWreckSite() {
    if (this.stage === 0) {
      if (store.spend(HULL_COST)) {
        store.set({ boat: { ...store.get().boat, stage: 1 } });
        this.showHullOnSand();
        audio.sfx('sfx-levelup');
        this.toast('The keel remembers. Hull rebuilt.');
      } else {
        this.toast(WRECK_LINES[this.wreckLineIndex % WRECK_LINES.length]);
        this.wreckLineIndex++;
        audio.sfx('sfx-ui-click');
      }
      return;
    }
    if (this.stage === 1) {
      if (store.spend(RIG_COST)) {
        const mooring = this.findMooring();
        store.set({ boat: { stage: 2, x: mooring.x, z: mooring.z, heading: mooring.heading } });
        this.launch(mooring.x, mooring.z, mooring.heading, false);
        audio.sfx('sfx-levelup');
        this.toast('She floats! The sail smells like the shallows.');
      } else {
        this.toast('Not yet — she needs 6 wood and 8 algae for the rig.');
        audio.sfx('sfx-ui-click');
      }
    }
  }

  private showHullOnSand() {
    if (!this.wreck || this.hull) return;
    this.wreck.group.visible = false;
    const { group } = buildBoatMesh(false);
    group.position.copy(this.wreck.position);
    group.position.y = heightAt(this.wreck.position.x, this.wreck.position.z) + 0.1;
    group.rotation.y = 0.4;
    group.rotation.z = 0.08; // propped on the sand, listing gently
    this.group.add(group);
    this.hull = group;
  }

  /** walk seaward from the wreck until there's honest water under the keel */
  private findMooring(): { x: number; z: number; heading: number } {
    const from = this.wreck?.position ?? new THREE.Vector3(-40, 0, 40);
    const dir = new THREE.Vector2(from.x, from.z).normalize(); // away from island 1's center
    const water = getWaterLevel();
    for (let d = 2; d < 60; d += 1.5) {
      const x = from.x + dir.x * d;
      const z = from.z + dir.y * d;
      if (heightAt(x, z) < water - 1.3) {
        return { x: x + dir.x * 2, z: z + dir.y * 2, heading: Math.atan2(dir.x, dir.y) };
      }
    }
    return { x: from.x, z: from.z, heading: 0 };
  }

  private launch(x: number, z: number, heading: number, restoring: boolean) {
    if (this.hull) {
      this.group.remove(this.hull);
      this.hull = null;
    }
    if (this.wreck) this.wreck.group.visible = false;
    if (!restoring && this.stage !== 2) return; // guard: only launch at stage 2
    const { group, sail } = buildBoatMesh(true);
    group.rotation.order = 'YXZ'; // yaw first, then wave pitch/roll compose on top
    this.vessel = group;
    this.sail = sail;
    this.position.set(x, getWaterLevel(), z);
    this.heading = heading;
    this.group.add(group);

    interactions.add({
      label: () => (this.stage === 2 && !this.sailing ? 'Board the boat' : null),
      position: this.position,
      range: 3.6,
      priority: 3,
      action: () => this.embark(),
    });
  }

  private embark() {
    if (this.sailing || this.stage !== 2) return;
    this.sailing = true;
    this.speed = 0;
    this.toast('Hand on the tiller. The sea is listening.');
    audio.sfx('sfx-cast');
    this.onBoardChange?.(true);
  }

  /** label for the HUD while sailing: ashore when shallow, overboard when not */
  disembarkLabel(): string {
    const side = this.sidePoint();
    return heightAt(side.x, side.z) > getWaterLevel() - 1.0 ? 'Step ashore' : 'Dive overboard';
  }

  private sidePoint(): THREE.Vector3 {
    // whichever side is shallower — step out toward the shore, not the deep
    const rx = Math.cos(this.heading);
    const rz = -Math.sin(this.heading);
    const starboard = new THREE.Vector3(this.position.x + rx * 2.1, 0, this.position.z + rz * 2.1);
    const port = new THREE.Vector3(this.position.x - rx * 2.1, 0, this.position.z - rz * 2.1);
    return heightAt(starboard.x, starboard.z) >= heightAt(port.x, port.z) ? starboard : port;
  }

  disembark() {
    if (!this.sailing) return;
    this.sailing = false;
    this.speed = 0;
    const side = this.sidePoint();
    this.player.position.set(side.x, Math.max(heightAt(side.x, side.z), getWaterLevel() - 0.85), side.z);
    this.persist();
    audio.sfx('sfx-cast');
    this.onBoardChange?.(false);
  }

  private persist() {
    store.set({ boat: { stage: 2, x: this.position.x, z: this.position.z, heading: this.heading } });
  }

  /** sailing physics + player-on-deck placement; runs every frame at stage 2 */
  update(dt: number, move: { x: number; y: number }) {
    if (!this.vessel) return;
    const water = getWaterLevel();

    if (this.sailing) {
      // thrust and rudder, boat-relative
      if (move.y > 0.05) this.speed = Math.min(MAX_SPEED, this.speed + ACCEL * dt * move.y);
      else if (move.y < -0.05) this.speed = Math.max(-REVERSE_SPEED, this.speed - ACCEL * dt * -move.y * 0.6);
      else this.speed = THREE.MathUtils.lerp(this.speed, 0, Math.min(1, DRAG * dt * 0.4));
      // the rudder needs way on the boat to bite
      const bite = 0.35 + 0.65 * Math.min(1, Math.abs(this.speed) / (MAX_SPEED * 0.5));
      this.heading -= move.x * TURN_RATE * bite * dt * Math.sign(this.speed || 1);

      const fx = Math.sin(this.heading);
      const fz = Math.cos(this.heading);
      const nx = this.position.x + fx * this.speed * dt;
      const nz = this.position.z + fz * this.speed * dt;
      // aground check a half-length ahead of travel
      const probeX = nx + fx * Math.sign(this.speed) * 1.8;
      const probeZ = nz + fz * Math.sign(this.speed) * 1.8;
      if (heightAt(probeX, probeZ) > water - DRAFT || !insideWorld(nx, nz)) {
        if (Math.abs(this.speed) > 4 && this.agroundToastCooldown <= 0) {
          this.toast('The keel kisses sand.');
          this.agroundToastCooldown = 4;
        }
        this.speed = 0;
      } else {
        this.position.x = nx;
        this.position.z = nz;
      }
      this.agroundToastCooldown -= dt;

      this.persistTimer += dt;
      if (this.persistTimer > 5) {
        this.persistTimer = 0;
        this.persist();
      }

      // the player rides the deck; position tracks the boat for camera + interactions
      this.player.position.set(this.position.x, water + 0.55, this.position.z);
      this.player.group.position.set(this.position.x - fx * 1.3, water + 0.45, this.position.z - fz * 1.3);
      this.player.group.rotation.set(0, this.heading, 0);
      this.player.group.scale.y = 1;
    }

    // bob on the same waves the shader draws, pitch with the swell
    const bob = this.water.waveAt(this.position.x, this.position.z) * 0.6;
    this.position.y = water + bob - BOB_DRAFT;
    this.vessel.position.copy(this.position);
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const fore = this.water.waveAt(this.position.x + fx * 2, this.position.z + fz * 2);
    const aft = this.water.waveAt(this.position.x - fx * 2, this.position.z - fz * 2);
    this.vessel.rotation.set((aft - fore) * 0.22, this.heading - Math.PI / 2, (aft - fore) * 0.08);

    // sail billows with speed
    if (this.sail) {
      const billow = 0.12 + Math.min(1, Math.abs(this.speed) / MAX_SPEED) * 0.35;
      this.sail.scale.z = 1;
      this.sail.rotation.x = billow * 0.4;
    }
  }
}

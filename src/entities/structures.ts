/**
 * Placeable structures. v1: the drying rack (fresh herbs -> dried leaves over
 * real time). The placement-ghost flow here is the seam shack building
 * extends later: craft kit -> ghost follows player -> place on valid ground.
 */
import * as THREE from 'three';
import { heightAt, slopeAt } from '../world/terrain';
import { interactions } from '../core/interact';
import { store, type PlacedStructure } from '../core/store';
import { ITEMS, DRY_SECONDS } from '../data/items';
import { audio } from '../audio/audio';

function buildRackMesh(): { group: THREE.Group; bundles: THREE.Mesh[] } {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x8a5a3b, flatShading: true });
  for (const side of [-1, 1]) {
    const legA = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.5, 5), wood);
    legA.position.set(side * 0.9, 0.7, 0.25);
    legA.rotation.x = 0.32;
    const legB = legA.clone();
    legB.position.z = -0.25;
    legB.rotation.x = -0.32;
    g.add(legA, legB);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 5), wood);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 1.32;
  g.add(bar);

  // herb bundles hang from the bar; hidden until loaded
  const bundles: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.42, 5),
      new THREE.MeshLambertMaterial({ color: 0x86b85c, flatShading: true })
    );
    b.rotation.x = Math.PI; // hang point-down
    b.position.set(-0.66 + i * 0.44, 1.05, 0);
    b.visible = false;
    g.add(b);
    bundles.push(b);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { group: g, bundles };
}

interface LiveRack {
  data: PlacedStructure;
  group: THREE.Group;
  bundles: THREE.Mesh[];
  remove: () => void;
}

const FRESH_DRYABLE = ITEMS.filter((i) => i.driesTo);

export class Structures {
  readonly group = new THREE.Group();
  private racks: LiveRack[] = [];
  private persistTimer = 0;

  // placement mode
  private ghost: THREE.Group | null = null;
  private ghostValid = false;
  private onToast: (msg: string) => void = () => {};

  constructor(toast: (msg: string) => void) {
    this.onToast = toast;
    for (const s of store.get().structures) this.spawnRack(s);
  }

  get placing(): boolean {
    return this.ghost !== null;
  }

  /** label for the HUD action button while in placement mode */
  placementLabel(): string {
    return this.ghostValid ? 'Place Rack Here' : 'Too steep / too close';
  }

  startPlacement() {
    if (this.ghost) return;
    const { group } = buildRackMesh();
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const m = (o.material as THREE.MeshLambertMaterial).clone();
        m.transparent = true;
        m.opacity = 0.55;
        o.material = m;
        o.castShadow = false;
      }
    });
    this.ghost = group;
    this.group.add(group);
  }

  cancelPlacement() {
    if (!this.ghost) return;
    this.group.remove(this.ghost);
    this.ghost = null;
  }

  /** returns true if placed */
  confirmPlacement(): boolean {
    if (!this.ghost || !this.ghostValid) return false;
    if (!store.spend({ drying_rack_kit: 1 })) {
      this.cancelPlacement();
      return false;
    }
    const data: PlacedStructure = {
      type: 'drying_rack',
      x: this.ghost.position.x,
      z: this.ghost.position.z,
      drying: null,
      secondsLeft: 0,
    };
    store.set({ structures: [...store.get().structures, data] });
    this.cancelPlacement();
    this.spawnRack(data);
    audio.sfx('sfx-levelup');
    this.onToast('Drying rack placed');
    return true;
  }

  private spawnRack(data: PlacedStructure) {
    const { group, bundles } = buildRackMesh();
    group.position.set(data.x, heightAt(data.x, data.z), data.z);
    this.group.add(group);
    const rack: LiveRack = { data, group, bundles, remove: () => {} };
    rack.remove = interactions.add({
      label: () => this.rackLabel(rack),
      position: group.position,
      range: 2.8,
      priority: 2,
      action: () => this.useRack(rack),
    });
    this.racks.push(rack);
    this.syncBundles(rack);
  }

  private rackLabel(rack: LiveRack): string | null {
    const d = rack.data;
    if (d.drying && d.secondsLeft <= 0) return 'Collect Dried Leaves';
    if (d.drying) return null; // busy drying — no prompt
    const hasFresh = FRESH_DRYABLE.some((i) => store.count(i.id) > 0);
    return hasFresh ? 'Hang Herbs to Dry' : null;
  }

  private useRack(rack: LiveRack) {
    const d = rack.data;
    if (d.drying && d.secondsLeft <= 0) {
      // collect: fresh -> dried
      const collected: string[] = [];
      for (const [id, count] of Object.entries(d.drying)) {
        const def = ITEMS.find((i) => i.id === id);
        if (def?.driesTo) {
          store.addItem(def.driesTo, count);
          collected.push(`${count} ${ITEMS.find((i) => i.id === def.driesTo)?.name}`);
        }
      }
      d.drying = null;
      this.persist();
      this.syncBundles(rack);
      audio.sfx('sfx-pickup');
      this.onToast(`Collected ${collected.join(', ')}`);
      return;
    }
    if (d.drying) return;
    // load up to 4 fresh herbs (mixed), spend from inventory
    const load: Record<string, number> = {};
    let slots = 4;
    for (const item of FRESH_DRYABLE) {
      const take = Math.min(slots, store.count(item.id));
      if (take > 0) {
        load[item.id] = take;
        slots -= take;
      }
      if (slots === 0) break;
    }
    if (Object.keys(load).length === 0) return;
    if (!store.spend(load)) return;
    d.drying = load;
    d.secondsLeft = DRY_SECONDS;
    this.persist();
    this.syncBundles(rack);
    audio.sfx('sfx-cast');
    this.onToast(`Herbs hung to dry (~${DRY_SECONDS}s)`);
  }

  private syncBundles(rack: LiveRack) {
    const d = rack.data;
    const total = d.drying ? Object.values(d.drying).reduce((a, b) => a + b, 0) : 0;
    rack.bundles.forEach((b, i) => {
      b.visible = i < total;
      const dry = d.drying !== null && d.secondsLeft <= 0;
      (b.material as THREE.MeshLambertMaterial).color.set(dry ? 0xb08a4f : 0x86b85c);
    });
  }

  private persist() {
    store.set({ structures: this.racks.map((r) => r.data) });
  }

  update(dt: number, playerPos: THREE.Vector3, playerHeading: number) {
    // placement ghost tracks a spot in front of the player
    if (this.ghost) {
      const gx = playerPos.x + Math.sin(playerHeading) * 3;
      const gz = playerPos.z + Math.cos(playerHeading) * 3;
      const gy = heightAt(gx, gz);
      this.ghost.position.set(gx, gy, gz);
      this.ghost.rotation.y = playerHeading + Math.PI / 2;
      const clearOfOthers = this.racks.every((r) => Math.hypot(r.data.x - gx, r.data.z - gz) > 2.5);
      this.ghostValid = gy > 0.9 && slopeAt(gx, gz) < 0.5 && clearOfOthers;
      this.ghost.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          (o.material as THREE.MeshLambertMaterial).color.set(this.ghostValid ? 0x86b85c : 0xd9534f);
        }
      });
    }

    // drying timers
    let dirty = false;
    for (const rack of this.racks) {
      const d = rack.data;
      if (d.drying && d.secondsLeft > 0) {
        d.secondsLeft -= dt;
        if (d.secondsLeft <= 0) {
          d.secondsLeft = 0;
          this.syncBundles(rack);
          this.onToast('Herbs are dry!');
          dirty = true;
        }
      }
    }
    this.persistTimer += dt;
    if (dirty || this.persistTimer > 5) {
      this.persistTimer = 0;
      this.persist();
    }
  }
}

/**
 * Placeable structures. v1: the drying rack (fresh herbs -> dried leaves over
 * real time). v2 companions: the bird bath (pour a warm brew -> a gull visits).
 * The placement-ghost flow here is the seam shack building extends later:
 * craft kit -> ghost follows player -> place on valid ground.
 */
import * as THREE from 'three';
import { heightAt, slopeAt } from '../world/terrain';
import { interactions } from '../core/interact';
import { store, type PlacedStructure, type RackStructure, type BathStructure } from '../core/store';
import { ITEMS, DRY_SECONDS } from '../data/items';
import { audio } from '../audio/audio';

type StructureKind = PlacedStructure['type'];

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

const STONE = new THREE.MeshLambertMaterial({ color: 0x8d867b, flatShading: true });
const WATER_COOL = new THREE.Color(0x7fb8c9);
const WATER_TEA = new THREE.Color(0x9ec78a);

function buildBathMesh(): { group: THREE.Group; water: THREE.Mesh } {
  const g = new THREE.Group();
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.85, 8), STONE);
  pedestal.position.y = 0.425;
  // basin rim: outer wall, spans 0.85 (pedestal top) to 0.99
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.14, 10), STONE);
  basin.position.y = 0.92;
  // basin floor: recessed inner disc sitting below the rim so the bowl reads as concave
  const basinInner = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.44, 0.06, 10), STONE);
  basinInner.position.y = 0.9;
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.44, 10),
    new THREE.MeshLambertMaterial({ color: WATER_COOL, transparent: true, opacity: 0.9 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.955; // just above the basin floor, below the rim
  g.add(pedestal, basin, basinInner, water);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { group: g, water };
}

interface LiveRack {
  data: RackStructure;
  group: THREE.Group;
  bundles: THREE.Mesh[];
}

interface LiveBath {
  data: BathStructure;
  group: THREE.Group;
  water: THREE.Mesh;
}

const FRESH_DRYABLE = ITEMS.filter((i) => i.driesTo);

const FRESH_COLOR = new THREE.Color(0x86b85c);
const DRIED_COLOR = new THREE.Color(0xb08a4f);

const KIT_BY_KIND: Record<StructureKind, string> = {
  drying_rack: 'drying_rack_kit',
  bird_bath: 'bird_bath_kit',
};

export class Structures {
  readonly group = new THREE.Group();
  private racks: LiveRack[] = [];
  private baths: LiveBath[] = [];
  private persistTimer = 0;

  // placement mode
  private ghost: THREE.Group | null = null;
  private ghostKind: StructureKind | null = null;
  private ghostValid = false;
  private onToast: (msg: string) => void = () => {};

  /** fired when the player pours a warm brew into a bird bath */
  onTeaPoured: ((bathPosition: THREE.Vector3) => void) | null = null;

  constructor(toast: (msg: string) => void) {
    this.onToast = toast;
    for (const s of store.get().structures) {
      if (s.type === 'drying_rack') this.spawnRack(s);
      else this.spawnBath(s);
    }
  }

  get placing(): boolean {
    return this.ghost !== null;
  }

  /** label for the HUD action button while in placement mode */
  placementLabel(): string {
    if (!this.ghostValid) return 'Too steep / too close';
    return this.ghostKind === 'bird_bath' ? 'Place Bird Bath Here' : 'Place Rack Here';
  }

  startPlacement(kind: StructureKind) {
    if (this.ghost) return;
    const { group } = kind === 'bird_bath' ? buildBathMesh() : buildRackMesh();
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
    this.ghostKind = kind;
    this.group.add(group);
  }

  cancelPlacement() {
    if (!this.ghost) return;
    this.group.remove(this.ghost);
    this.ghost = null;
    this.ghostKind = null;
  }

  /** returns true if placed */
  confirmPlacement(): boolean {
    if (!this.ghost || !this.ghostKind || !this.ghostValid) return false;
    const kind = this.ghostKind;
    if (!store.spend({ [KIT_BY_KIND[kind]]: 1 })) {
      this.cancelPlacement();
      return false;
    }
    const x = this.ghost.position.x;
    const z = this.ghost.position.z;
    if (kind === 'bird_bath') {
      const data: BathStructure = { type: 'bird_bath', x, z, teaLoaded: false };
      store.set({ structures: [...store.get().structures, data] });
      this.cancelPlacement();
      this.spawnBath(data);
      audio.sfx('sfx-levelup');
      this.onToast('Bird bath placed');
    } else {
      const data: RackStructure = { type: 'drying_rack', x, z, drying: null, secondsLeft: 0 };
      store.set({ structures: [...store.get().structures, data] });
      this.cancelPlacement();
      this.spawnRack(data);
      audio.sfx('sfx-levelup');
      this.onToast('Drying rack placed');
    }
    return true;
  }

  private spawnRack(data: RackStructure) {
    const { group, bundles } = buildRackMesh();
    group.position.set(data.x, heightAt(data.x, data.z), data.z);
    this.group.add(group);
    const rack: LiveRack = { data, group, bundles };
    interactions.add({
      label: () => this.rackLabel(rack),
      position: group.position,
      range: 2.8,
      priority: 2,
      action: () => this.useRack(rack),
    });
    this.racks.push(rack);
    this.syncBundles(rack);
  }

  private spawnBath(data: BathStructure) {
    const { group, water } = buildBathMesh();
    group.position.set(data.x, heightAt(data.x, data.z), data.z);
    this.group.add(group);
    const bath: LiveBath = { data, group, water };
    interactions.add({
      label: () => this.bathLabel(bath),
      position: group.position,
      range: 3,
      priority: 2,
      action: () => this.useBath(bath),
    });
    this.baths.push(bath);
    this.tintWater(bath);
  }

  private rackLabel(rack: LiveRack): string | null {
    const d = rack.data;
    if (d.drying && d.secondsLeft <= 0) return 'Collect Dried Leaves';
    if (d.drying) return `Drying… ${Math.ceil(d.secondsLeft)}s`;
    const hasFresh = FRESH_DRYABLE.some((i) => store.count(i.id) > 0);
    return hasFresh ? 'Hang Herbs to Dry' : 'Drying Rack (gather fresh herbs)';
  }

  private bathLabel(bath: LiveBath): string | null {
    const d = bath.data;
    if (d.teaLoaded) return null; // the gull takes over from here
    return store.count('seamint_tea') > 0 ? 'Pour Seamint Tea' : 'Needs a warm brew (Seamint Tea)';
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
    this.onToast(`Herbs hung to dry — ready in ${DRY_SECONDS}s, watch them turn brown`);
  }

  private useBath(bath: LiveBath) {
    const d = bath.data;
    if (d.teaLoaded) return;
    if (store.count('seamint_tea') <= 0) return;
    if (!store.spend({ seamint_tea: 1 })) return;
    d.teaLoaded = true;
    this.persist();
    this.tintWater(bath);
    audio.sfx('sfx-cast');
    this.onToast('Warm steam drifts off on the breeze…');
    this.onTeaPoured?.(bath.group.position.clone());
  }

  private syncBundles(rack: LiveRack) {
    const d = rack.data;
    const total = d.drying ? Object.values(d.drying).reduce((a, b) => a + b, 0) : 0;
    rack.bundles.forEach((b, i) => {
      b.visible = i < total;
    });
    this.tintBundles(rack);
  }

  /** bundles shade green -> brown as drying progresses, so the wait is visible */
  private tintBundles(rack: LiveRack) {
    const d = rack.data;
    const progress = d.drying ? 1 - Math.max(0, d.secondsLeft) / DRY_SECONDS : 0;
    for (const b of rack.bundles) {
      const m = b.material as THREE.MeshLambertMaterial;
      m.color.copy(FRESH_COLOR).lerp(DRIED_COLOR, progress);
    }
  }

  private tintWater(bath: LiveBath) {
    const m = bath.water.material as THREE.MeshLambertMaterial;
    m.color.copy(bath.data.teaLoaded ? WATER_TEA : WATER_COOL);
  }

  private persist() {
    store.set({ structures: [...this.racks.map((r) => r.data), ...this.baths.map((b) => b.data)] });
  }

  update(dt: number, playerPos: THREE.Vector3, playerHeading: number) {
    // placement ghost tracks a spot in front of the player
    if (this.ghost) {
      const gx = playerPos.x + Math.sin(playerHeading) * 3;
      const gz = playerPos.z + Math.cos(playerHeading) * 3;
      const gy = heightAt(gx, gz);
      this.ghost.position.set(gx, gy, gz);
      this.ghost.rotation.y = playerHeading + Math.PI / 2;
      const clearOfOthers =
        this.racks.every((r) => Math.hypot(r.data.x - gx, r.data.z - gz) > 2.5) &&
        this.baths.every((b) => Math.hypot(b.data.x - gx, b.data.z - gz) > 2.5);
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
        this.tintBundles(rack);
        if (d.secondsLeft <= 0) {
          d.secondsLeft = 0;
          this.onToast('Herbs are dry — collect them at the rack!');
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

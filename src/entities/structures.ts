/**
 * Placeable structures. v1: the drying rack (fresh herbs -> dried leaves over
 * real time). v2 companions: the bird bath (pour a warm brew -> a gull visits).
 * v2 homestead: the garden bed (plant a fresh herb -> harvest 3 later) and the
 * lean-to (a sleepable camp that upgrades lean-to -> shack -> cottage).
 * The placement-ghost flow here is the seam all of these share: craft kit ->
 * ghost follows player -> place on valid ground.
 */
import * as THREE from 'three';
import { heightAt, slopeAt } from '../world/terrain';
import { interactions } from '../core/interact';
import {
  store,
  type PlacedStructure,
  type RackStructure,
  type BathStructure,
  type GardenStructure,
  type CampStructure,
} from '../core/store';
import { ITEMS, DRY_SECONDS, GROW_SECONDS, ITEM_BY_ID, HERB_BY_ID, type ItemId } from '../data/items';
import { buildSeamint, buildEmberbloom } from './herbs';
import { readyBucket } from '../core/worldtime';
import { audio } from '../audio/audio';

type StructureKind = PlacedStructure['type'];

/** "ready by evening", or the shorter "ready soon" when we're already in the projected bucket */
function readyPhrase(bucket: string): string {
  return bucket === 'soon' ? 'ready soon' : `ready by ${bucket}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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

const BED_WOOD = new THREE.MeshLambertMaterial({ color: 0x8a5a3b, flatShading: true });
const BED_SOIL = new THREE.MeshLambertMaterial({ color: 0x4a3628, flatShading: true });

function buildGardenBedMesh(): THREE.Group {
  const g = new THREE.Group();
  const railFront = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.1), BED_WOOD);
  railFront.position.set(0, 0.07, 0.42);
  const railBack = railFront.clone();
  railBack.position.z = -0.42;
  const railLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.85), BED_WOOD);
  railLeft.position.set(-0.5, 0.07, 0);
  const railRight = railLeft.clone();
  railRight.position.x = 0.5;
  const soil = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.75), BED_SOIL);
  soil.position.y = 0.05;
  g.add(railFront, railBack, railLeft, railRight, soil);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}

const CAMP_WOOD = new THREE.MeshLambertMaterial({ color: 0x8a5a3b, flatShading: true });
const CAMP_ROOF = new THREE.MeshLambertMaterial({ color: 0xb0563c, flatShading: true });
const CAMP_STONE = new THREE.MeshLambertMaterial({ color: 0x8d867b, flatShading: true });

/** stage 1: two posts, a slanted plank roof leaning down to the ground, a few support sticks */
function buildLeanToStage1(): THREE.Group {
  const g = new THREE.Group();
  const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.6, 6);
  const postL = new THREE.Mesh(postGeo, CAMP_WOOD);
  postL.position.set(-0.8, 0.8, -0.8);
  const postR = postL.clone();
  postR.position.x = 0.8;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 1.9), CAMP_WOOD);
  roof.position.set(0, 0.85, 0.25);
  roof.rotation.x = THREE.MathUtils.degToRad(35);
  const stickGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.6, 5);
  const sticks = [-0.4, 0, 0.4].map((x) => {
    const s = new THREE.Mesh(stickGeo, CAMP_WOOD);
    s.position.set(x, 0.72, 0.35);
    s.rotation.x = THREE.MathUtils.degToRad(35);
    return s;
  });
  g.add(postL, postR, roof, ...sticks);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}

/** stage 2: four corner posts, three plank walls (open front), a pitched two-plane roof */
function buildLeanToStage2(): THREE.Group {
  const g = new THREE.Group();
  const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 2.0, 6);
  for (const [x, z] of [
    [-1.2, -1.2],
    [1.2, -1.2],
    [-1.2, 1.2],
    [1.2, 1.2],
  ]) {
    const post = new THREE.Mesh(postGeo, CAMP_WOOD);
    post.position.set(x, 1.0, z);
    g.add(post);
  }
  const wallBack = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.1), CAMP_WOOD);
  wallBack.position.set(0, 1.0, -1.2);
  const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 2.4), CAMP_WOOD);
  wallLeft.position.set(-1.2, 1.0, 0);
  const wallRight = wallLeft.clone();
  wallRight.position.x = 1.2;
  const roofL = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.5), CAMP_WOOD);
  roofL.position.set(0, 2.15, -0.65);
  roofL.rotation.x = THREE.MathUtils.degToRad(-22);
  const roofR = roofL.clone();
  roofR.position.z = 0.65;
  roofR.rotation.x = THREE.MathUtils.degToRad(22);
  g.add(wallBack, wallLeft, wallRight, roofL, roofR);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}

/** stage 3: a stone base ring, wood walls, a warm pitched roof, a small chimney block */
function buildLeanToStage3(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.0, 0.3, 10), CAMP_STONE);
  base.position.y = 0.15;
  const postGeo = new THREE.CylinderGeometry(0.1, 0.12, 2.2, 6);
  for (const [x, z] of [
    [-1.35, -1.35],
    [1.35, -1.35],
    [-1.35, 1.35],
    [1.35, 1.35],
  ]) {
    const post = new THREE.Mesh(postGeo, CAMP_WOOD);
    post.position.set(x, 1.3, z);
    g.add(post);
  }
  const wallBack = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.6, 0.12), CAMP_WOOD);
  wallBack.position.set(0, 1.2, -1.35);
  const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 2.7), CAMP_WOOD);
  wallLeft.position.set(-1.35, 1.2, 0);
  const wallRight = wallLeft.clone();
  wallRight.position.x = 1.35;
  const roofL = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.1, 1.7), CAMP_ROOF);
  roofL.position.set(0, 2.5, -0.7);
  roofL.rotation.x = THREE.MathUtils.degToRad(-24);
  const roofR = roofL.clone();
  roofR.position.z = 0.7;
  roofR.rotation.x = THREE.MathUtils.degToRad(24);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), CAMP_STONE);
  chimney.position.set(0.9, 2.9, -0.5);
  g.add(base, wallBack, wallLeft, wallRight, roofL, roofR, chimney);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}

function buildLeanToMesh(stage: 1 | 2 | 3): THREE.Group {
  if (stage === 1) return buildLeanToStage1();
  if (stage === 2) return buildLeanToStage2();
  return buildLeanToStage3();
}

/** the real plant mesh from herbs.ts, scaled down for the sprout stage by the caller */
function buildPlantMesh(cropId: string): THREE.Group {
  const def = HERB_BY_ID.get(cropId as ItemId);
  if (!def) return new THREE.Group();
  const built = cropId === 'emberbloom' ? buildEmberbloom(def) : buildSeamint(def);
  return built.group;
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

interface LiveGarden {
  data: GardenStructure;
  group: THREE.Group;
  plantMesh: THREE.Group | null;
}

interface LiveCamp {
  data: CampStructure;
  group: THREE.Group;
  mesh: THREE.Group;
}

const FRESH_DRYABLE = ITEMS.filter((i) => i.driesTo);

const FRESH_COLOR = new THREE.Color(0x86b85c);
const DRIED_COLOR = new THREE.Color(0xb08a4f);

const KIT_BY_KIND: Record<StructureKind, string> = {
  drying_rack: 'drying_rack_kit',
  bird_bath: 'bird_bath_kit',
  garden_bed: 'garden_bed_kit',
  lean_to: 'lean_to_kit',
};

const PLACEMENT_LABEL: Record<StructureKind, string> = {
  drying_rack: 'Place Rack Here',
  bird_bath: 'Place Bird Bath Here',
  garden_bed: 'Place Garden Bed Here',
  lean_to: 'Place Lean-To Here',
};

export class Structures {
  readonly group = new THREE.Group();
  private racks: LiveRack[] = [];
  private baths: LiveBath[] = [];
  private gardens: LiveGarden[] = [];
  private camps: LiveCamp[] = [];
  private persistTimer = 0;

  // placement mode
  private ghost: THREE.Group | null = null;
  private ghostKind: StructureKind | null = null;
  private ghostValid = false;
  private onToast: (msg: string) => void = () => {};

  /** spots placement must keep clear of (the campfire/kettle) — main.ts fills this */
  avoid: THREE.Vector3[] = [];

  /** fired when the player pours a warm brew into a bird bath */
  onTeaPoured: ((bathPosition: THREE.Vector3) => void) | null = null;
  /** fired when a lean-to's "Sleep until morning" prompt is used; main.ts drives the actual fade */
  onSleep: (() => void) | null = null;
  /** wired from main so lean-to prompts know if it's dark out, without structures owning the sky */
  getDaylight: () => number = () => 1;
  /** wired from main so drying/growing/sleep prompts can phrase "ready by evening" */
  getTime: () => number = () => 0.5;

  constructor(toast: (msg: string) => void) {
    this.onToast = toast;
    for (const s of store.get().structures) {
      if (s.type === 'drying_rack') this.spawnRack(s);
      else if (s.type === 'bird_bath') this.spawnBath(s);
      else if (s.type === 'garden_bed') this.spawnGarden(s);
      else this.spawnCamp(s);
    }
  }

  get placing(): boolean {
    return this.ghost !== null;
  }

  /** label for the HUD action button while in placement mode */
  placementLabel(): string {
    if (!this.ghostValid) return 'Too steep / too close';
    return PLACEMENT_LABEL[this.ghostKind!];
  }

  startPlacement(kind: StructureKind) {
    if (this.ghost) return;
    const group =
      kind === 'bird_bath'
        ? buildBathMesh().group
        : kind === 'garden_bed'
          ? buildGardenBedMesh()
          : kind === 'lean_to'
            ? buildLeanToMesh(1)
            : buildRackMesh().group;
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
    } else if (kind === 'garden_bed') {
      const data: GardenStructure = { type: 'garden_bed', x, z, crop: null, secondsLeft: 0 };
      store.set({ structures: [...store.get().structures, data] });
      this.cancelPlacement();
      this.spawnGarden(data);
      audio.sfx('sfx-levelup');
      this.onToast('Garden bed placed');
    } else if (kind === 'lean_to') {
      const data: CampStructure = { type: 'lean_to', x, z, stage: 1 };
      store.set({ structures: [...store.get().structures, data] });
      this.cancelPlacement();
      this.spawnCamp(data);
      audio.sfx('sfx-levelup');
      this.onToast('Lean-to raised');
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

  private spawnGarden(data: GardenStructure) {
    const bed = buildGardenBedMesh();
    const group = new THREE.Group();
    group.add(bed);
    group.position.set(data.x, heightAt(data.x, data.z), data.z);
    this.group.add(group);
    const garden: LiveGarden = { data, group, plantMesh: null };
    interactions.add({
      label: () => this.gardenLabel(garden),
      position: group.position,
      range: 2.8,
      priority: 2,
      action: () => this.useGarden(garden),
    });
    this.gardens.push(garden);
    this.syncPlant(garden);
  }

  private spawnCamp(data: CampStructure) {
    const mesh = buildLeanToMesh(data.stage);
    const group = new THREE.Group();
    group.add(mesh);
    group.position.set(data.x, heightAt(data.x, data.z), data.z);
    this.group.add(group);
    const camp: LiveCamp = { data, group, mesh };
    interactions.add({
      label: () => this.campLabel(camp),
      position: group.position,
      range: 3.2,
      priority: 2,
      action: () => this.useCamp(camp),
    });
    this.camps.push(camp);
  }

  private rackLabel(rack: LiveRack): string | null {
    const d = rack.data;
    if (d.drying && d.secondsLeft <= 0) return 'Collect Dried Leaves';
    if (d.drying) return `Drying… ${readyPhrase(readyBucket(this.getTime(), d.secondsLeft))}`;
    const hasFresh = FRESH_DRYABLE.some((i) => store.count(i.id) > 0);
    return hasFresh ? 'Hang Herbs to Dry' : 'Drying Rack (gather fresh herbs)';
  }

  private bathLabel(bath: LiveBath): string | null {
    const d = bath.data;
    if (d.teaLoaded) return null; // the gull takes over from here
    return store.count('seamint_tea') > 0 ? 'Pour Seamint Tea' : 'Needs a warm brew (Seamint Tea)';
  }

  private gardenLabel(g: LiveGarden): string | null {
    const d = g.data;
    if (d.crop == null) {
      const item = FRESH_DRYABLE.find((i) => store.count(i.id) > 0);
      return item ? `Plant ${item.name}` : 'Garden Bed (needs fresh herbs)';
    }
    if (d.secondsLeft > 0) return `Growing… ${readyPhrase(readyBucket(this.getTime(), d.secondsLeft))}`;
    const cropDef = ITEM_BY_ID.get(d.crop as ItemId);
    return `Harvest ${cropDef?.name ?? d.crop}`;
  }

  private campLabel(c: LiveCamp): string | null {
    const d = c.data;
    if (this.getDaylight() < 0.35) return 'Sleep until morning';
    if (d.stage === 1) {
      return store.count('wood') >= 10 && store.count('stone') >= 6 ? 'Upgrade to Shack (10 wood, 6 stone)' : null;
    }
    if (d.stage === 2) {
      return store.count('wood') >= 16 && store.count('stone') >= 10 && store.count('loam') >= 2
        ? 'Upgrade to Cottage (16 wood, 10 stone, 2 loam)'
        : null;
    }
    return null; // stage 3, daytime: nothing left to do here
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
    this.onToast(`Herbs hung to dry. ${capitalize(readyPhrase(readyBucket(this.getTime(), DRY_SECONDS)))}.`);
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

  private useGarden(g: LiveGarden) {
    const d = g.data;
    if (d.crop == null) {
      const item = FRESH_DRYABLE.find((i) => store.count(i.id) > 0);
      if (!item) return;
      if (!store.spend({ [item.id]: 1 })) return;
      d.crop = item.id;
      d.secondsLeft = GROW_SECONDS;
      this.persist();
      this.syncPlant(g);
      audio.sfx('sfx-cast');
      this.onToast(`Planted. ${capitalize(readyPhrase(readyBucket(this.getTime(), GROW_SECONDS)))}.`);
      return;
    }
    if (d.secondsLeft > 0) return;
    const cropDef = ITEM_BY_ID.get(d.crop as ItemId);
    store.addItem(d.crop, 3);
    d.crop = null;
    d.secondsLeft = 0;
    this.persist();
    this.syncPlant(g);
    audio.sfx('sfx-pickup');
    this.onToast(`+3 ${cropDef?.name ?? 'herbs'}. The garden hums.`);
  }

  private useCamp(c: LiveCamp) {
    const d = c.data;
    if (this.getDaylight() < 0.35) {
      this.onSleep?.();
      return;
    }
    if (d.stage === 1 && store.count('wood') >= 10 && store.count('stone') >= 6) {
      if (!store.spend({ wood: 10, stone: 6 })) return;
      d.stage = 2;
      this.rebuildCamp(c);
      this.persist();
      audio.sfx('sfx-levelup');
      this.onToast('The camp grows sturdier.');
      return;
    }
    if (d.stage === 2 && store.count('wood') >= 16 && store.count('stone') >= 10 && store.count('loam') >= 2) {
      if (!store.spend({ wood: 16, stone: 10, loam: 2 })) return;
      d.stage = 3;
      this.rebuildCamp(c);
      this.persist();
      audio.sfx('sfx-levelup');
      this.onToast('A real home now.');
    }
  }

  private rebuildCamp(c: LiveCamp) {
    c.group.remove(c.mesh);
    c.mesh = buildLeanToMesh(c.data.stage);
    c.group.add(c.mesh);
  }

  /** creates/removes/rescales the planted-crop mesh to match current growth progress */
  private syncPlant(g: LiveGarden) {
    const d = g.data;
    if (d.crop == null) {
      if (g.plantMesh) {
        g.group.remove(g.plantMesh);
        g.plantMesh = null;
      }
      return;
    }
    if (!g.plantMesh) {
      g.plantMesh = buildPlantMesh(d.crop);
      g.plantMesh.position.set(0, 0.09, 0);
      g.group.add(g.plantMesh);
    }
    const progress = 1 - Math.max(0, d.secondsLeft) / GROW_SECONDS;
    g.plantMesh.scale.setScalar(THREE.MathUtils.lerp(0.25, 1.0, THREE.MathUtils.clamp(progress, 0, 1)));
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

  private allPositions(): Array<{ x: number; z: number }> {
    return [
      ...this.racks.map((r) => r.data),
      ...this.baths.map((b) => b.data),
      ...this.gardens.map((g) => g.data),
      ...this.camps.map((c) => c.data),
    ];
  }

  private persist() {
    store.set({
      structures: [
        ...this.racks.map((r) => r.data),
        ...this.baths.map((b) => b.data),
        ...this.gardens.map((g) => g.data),
        ...this.camps.map((c) => c.data),
      ],
    });
  }

  update(dt: number, playerPos: THREE.Vector3, playerHeading: number) {
    // placement ghost tracks a spot in front of the player
    if (this.ghost) {
      const gx = playerPos.x + Math.sin(playerHeading) * 3;
      const gz = playerPos.z + Math.cos(playerHeading) * 3;
      const gy = heightAt(gx, gz);
      this.ghost.position.set(gx, gy, gz);
      this.ghost.rotation.y = playerHeading + Math.PI / 2;
      const clearance = this.ghostKind === 'lean_to' ? 3.5 : 2.5;
      const clearOfOthers = this.allPositions().every((p) => Math.hypot(p.x - gx, p.z - gz) > clearance);
      // keep clear of the kettle/campfire too, or a rack can smother the brew prompt
      const clearOfAvoid = this.avoid.every((p) => Math.hypot(p.x - gx, p.z - gz) > 3.4);
      this.ghostValid = gy > 0.9 && slopeAt(gx, gz) < 0.5 && clearOfOthers && clearOfAvoid;
      this.ghost.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          (o.material as THREE.MeshLambertMaterial).color.set(this.ghostValid ? 0x86b85c : 0xd9534f);
        }
      });
    }

    let dirty = false;

    // drying timers
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

    // garden growth timers
    for (const garden of this.gardens) {
      const d = garden.data;
      if (d.crop && d.secondsLeft > 0) {
        d.secondsLeft -= dt;
        if (d.secondsLeft <= 0) {
          d.secondsLeft = 0;
          dirty = true;
        }
        this.syncPlant(garden);
      }
    }

    this.persistTimer += dt;
    if (dirty || this.persistTimer > 5) {
      this.persistTimer = 0;
      this.persist();
    }
  }
}

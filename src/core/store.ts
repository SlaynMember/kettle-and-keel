/**
 * Tiny typed state store. One global bag of stringly-typed registry keys is
 * how the last game died; everything here is schema'd and persisted in one place.
 */

export interface Inventory {
  [itemId: string]: number;
}

export interface RackStructure {
  type: 'drying_rack';
  x: number;
  z: number;
  /** herbs currently drying: item id -> count (fresh ids) */
  drying: Inventory | null;
  /** real seconds left until dry; only meaningful while drying */
  secondsLeft: number;
}

export interface BathStructure {
  type: 'bird_bath';
  x: number;
  z: number;
  /** true once the player has poured a warm brew in */
  teaLoaded: boolean;
}

export interface GardenStructure {
  type: 'garden_bed';
  x: number;
  z: number;
  /** planted herb item id, or null if empty */
  crop: string | null;
  /** real seconds left until the crop is ready; only meaningful while a crop is planted */
  secondsLeft: number;
}

export interface CampStructure {
  type: 'lean_to';
  x: number;
  z: number;
  /** 1 = lean-to, 2 = shack, 3 = cottage */
  stage: 1 | 2 | 3;
}

export type PlacedStructure = RackStructure | BathStructure | GardenStructure | CampStructure;

export interface Buffs {
  /** real seconds remaining */
  speed: number;
  glow: number;
  /** kelp tea: deeper lungs while it lasts */
  breath: number;
}

export interface BoatState {
  /** 0 = still a wreck, 1 = hull rebuilt on the sand, 2 = rigged and afloat */
  stage: 0 | 1 | 2;
  /** moored position + facing; only meaningful at stage 2 */
  x: number;
  z: number;
  heading: number;
}

export interface GameState {
  version: 1;
  inventory: Inventory;
  day: number;
  muted: boolean;
  structures: PlacedStructure[];
  buffs: Buffs;
  /** has the player talked to the seagull for the first time */
  gullMet: boolean;
  /** has the first-night shooting star already played (once ever per save) */
  starSeen: boolean;
  /** index into data/guidance.ts GOALS — how far the on-screen guide has advanced */
  guideStep: number;
  /** item ids the player has ever owned; gates discovery cards + mystery recipes */
  discovered: string[];
  /** today's washed-ashore beach find, or null before one has spawned */
  beachFind: BeachFind | null;
  /** the wreck-rebuild + sailing state */
  boat: BoatState;
  /** has the player ever stepped ashore on the far island */
  visitedIsland2: boolean;
  /** has the cold campfire on island 2 been lit (unlocks its kettle) */
  camp2Lit: boolean;
  /** indices of sunken cargo crates already opened */
  cargoCollected: number[];
}

export interface BeachFind {
  day: number;
  kind: string;
  x: number;
  z: number;
  collected: boolean;
}

const SAVE_KEY = 'kk-save-v0'; // key kept stable; `version` field handles shape

type Listener = (state: GameState) => void;

/** keep only known structure shapes across save-format changes; drop the rest */
function sanitizeStructure(p: unknown): PlacedStructure | null {
  if (!p || typeof p !== 'object') return null;
  const s = p as Record<string, unknown>;
  if (typeof s.x !== 'number' || typeof s.z !== 'number') return null;
  if (s.type === 'drying_rack') {
    return {
      type: 'drying_rack',
      x: s.x,
      z: s.z,
      drying: typeof s.drying === 'object' && s.drying ? (s.drying as Inventory) : null,
      secondsLeft: typeof s.secondsLeft === 'number' ? s.secondsLeft : 0,
    };
  }
  if (s.type === 'bird_bath') {
    return { type: 'bird_bath', x: s.x, z: s.z, teaLoaded: !!s.teaLoaded };
  }
  if (s.type === 'garden_bed') {
    return {
      type: 'garden_bed',
      x: s.x,
      z: s.z,
      crop: typeof s.crop === 'string' ? s.crop : null,
      secondsLeft: typeof s.secondsLeft === 'number' ? s.secondsLeft : 0,
    };
  }
  if (s.type === 'lean_to') {
    return {
      type: 'lean_to',
      x: s.x,
      z: s.z,
      stage: s.stage === 2 || s.stage === 3 ? s.stage : 1,
    };
  }
  return null;
}

/** drop malformed/legacy shapes rather than let a bad save wedge the tide */
function sanitizeBeachFind(p: unknown): BeachFind | null {
  if (!p || typeof p !== 'object') return null;
  const b = p as Record<string, unknown>;
  if (typeof b.day !== 'number' || typeof b.kind !== 'string' || typeof b.x !== 'number' || typeof b.z !== 'number') {
    return null;
  }
  return { day: b.day, kind: b.kind, x: b.x, z: b.z, collected: !!b.collected };
}

function sanitizeBoat(p: unknown): BoatState {
  const fallback: BoatState = { stage: 0, x: 0, z: 0, heading: 0 };
  if (!p || typeof p !== 'object') return fallback;
  const b = p as Record<string, unknown>;
  return {
    stage: b.stage === 1 || b.stage === 2 ? b.stage : 0,
    x: typeof b.x === 'number' ? b.x : 0,
    z: typeof b.z === 'number' ? b.z : 0,
    heading: typeof b.heading === 'number' ? b.heading : 0,
  };
}

function load(): GameState {
  const fallback: GameState = {
    version: 1,
    inventory: {},
    day: 1,
    muted: false,
    structures: [],
    buffs: { speed: 0, glow: 0, breath: 0 },
    gullMet: false,
    starSeen: false,
    guideStep: 0,
    discovered: [],
    beachFind: null,
    boat: { stage: 0, x: 0, z: 0, heading: 0 },
    visitedIsland2: false,
    camp2Lit: false,
    cargoCollected: [],
  };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    return {
      version: 1,
      inventory: typeof p.inventory === 'object' && p.inventory ? p.inventory : {},
      day: typeof p.day === 'number' ? p.day : 1,
      muted: !!p.muted,
      structures: Array.isArray(p.structures) ? p.structures.map(sanitizeStructure).filter((s: unknown): s is PlacedStructure => s !== null) : [],
      buffs:
        p.buffs && typeof p.buffs === 'object'
          ? { speed: p.buffs.speed || 0, glow: p.buffs.glow || 0, breath: p.buffs.breath || 0 }
          : { speed: 0, glow: 0, breath: 0 },
      gullMet: !!p.gullMet,
      starSeen: !!p.starSeen,
      guideStep: typeof p.guideStep === 'number' ? p.guideStep : 0,
      discovered: Array.isArray(p.discovered) ? p.discovered.filter((d: unknown): d is string => typeof d === 'string') : [],
      beachFind: sanitizeBeachFind(p.beachFind),
      boat: sanitizeBoat(p.boat),
      visitedIsland2: !!p.visitedIsland2,
      camp2Lit: !!p.camp2Lit,
      cargoCollected: Array.isArray(p.cargoCollected) ? p.cargoCollected.filter((n: unknown): n is number => typeof n === 'number') : [],
    };
  } catch {
    return fallback;
  }
}

class Store {
  private state: GameState = load();
  private listeners = new Set<Listener>();

  get(): Readonly<GameState> {
    return this.state;
  }

  set(patch: Partial<GameState>) {
    this.state = { ...this.state, ...patch };
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    this.listeners.forEach((fn) => fn(this.state));
  }

  addItem(itemId: string, qty = 1) {
    const inventory = { ...this.state.inventory };
    inventory[itemId] = (inventory[itemId] ?? 0) + qty;
    if (inventory[itemId] <= 0) delete inventory[itemId];
    this.set({ inventory });
  }

  count(itemId: string): number {
    return this.state.inventory[itemId] ?? 0;
  }

  /** atomically spend a set of items; returns false (and changes nothing) if short */
  spend(costs: Partial<Record<string, number>>): boolean {
    const inventory = { ...this.state.inventory };
    for (const [id, qty] of Object.entries(costs)) {
      if ((inventory[id] ?? 0) < (qty ?? 0)) return false;
    }
    for (const [id, qty] of Object.entries(costs)) {
      inventory[id] = (inventory[id] ?? 0) - (qty ?? 0);
      if (inventory[id] <= 0) delete inventory[id];
    }
    this.set({ inventory });
    return true;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }
}

export const store = new Store();

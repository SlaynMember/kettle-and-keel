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

export type PlacedStructure = RackStructure | BathStructure;

export interface Buffs {
  /** real seconds remaining */
  speed: number;
  glow: number;
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
  return null;
}

function load(): GameState {
  const fallback: GameState = {
    version: 1,
    inventory: {},
    day: 1,
    muted: false,
    structures: [],
    buffs: { speed: 0, glow: 0 },
    gullMet: false,
    starSeen: false,
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
      buffs: p.buffs && typeof p.buffs === 'object' ? { speed: p.buffs.speed || 0, glow: p.buffs.glow || 0 } : { speed: 0, glow: 0 },
      gullMet: !!p.gullMet,
      starSeen: !!p.starSeen,
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

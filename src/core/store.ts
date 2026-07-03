/**
 * Tiny typed state store. One global bag of stringly-typed registry keys is
 * how the last game died; everything here is schema'd and persisted in one place.
 */

export interface Inventory {
  [itemId: string]: number;
}

export interface PlacedStructure {
  type: 'drying_rack';
  x: number;
  z: number;
  /** herbs currently drying: item id -> count (fresh ids) */
  drying: Inventory | null;
  /** real seconds left until dry; only meaningful while drying */
  secondsLeft: number;
}

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
}

const SAVE_KEY = 'kk-save-v0'; // key kept stable; `version` field handles shape

type Listener = (state: GameState) => void;

function load(): GameState {
  const fallback: GameState = {
    version: 1,
    inventory: {},
    day: 1,
    muted: false,
    structures: [],
    buffs: { speed: 0, glow: 0 },
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
      structures: Array.isArray(p.structures) ? p.structures : [],
      buffs: p.buffs && typeof p.buffs === 'object' ? { speed: p.buffs.speed || 0, glow: p.buffs.glow || 0 } : { speed: 0, glow: 0 },
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

/**
 * Tiny typed state store. One global bag of stringly-typed registry keys is
 * how the last game died; everything here is schema'd and persisted in one place.
 */

export interface Inventory {
  [itemId: string]: number;
}

export interface GameState {
  inventory: Inventory;
  day: number;
  muted: boolean;
}

const SAVE_KEY = 'kk-save-v0';

type Listener = (state: GameState) => void;

function load(): GameState {
  const fallback: GameState = { inventory: {}, day: 1, muted: false };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      inventory: typeof parsed.inventory === 'object' && parsed.inventory ? parsed.inventory : {},
      day: typeof parsed.day === 'number' ? parsed.day : 1,
      muted: !!parsed.muted,
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
    this.set({ inventory });
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }
}

export const store = new Store();

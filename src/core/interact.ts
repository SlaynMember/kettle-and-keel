/**
 * Unified proximity interaction. Anything in the world that can be used
 * registers an Interactable; each frame the nearest in-range one becomes the
 * active prompt (HUD button + E key + desktop click-tap all trigger it).
 */
import type * as THREE from 'three';

export interface Interactable {
  /** button label, e.g. "Gather Seamint", "Use Kettle" */
  label: () => string | null; // null = currently unavailable (e.g. depleted node)
  position: THREE.Vector3;
  range: number;
  action: () => void;
  /** higher wins when several are in range (kettle over a herb underfoot) */
  priority?: number;
}

export class Interactions {
  private items = new Set<Interactable>();
  active: Interactable | null = null;

  add(i: Interactable): () => void {
    this.items.add(i);
    return () => this.items.delete(i);
  }

  update(playerPos: THREE.Vector3) {
    let best: Interactable | null = null;
    let bestScore = -Infinity;
    for (const i of this.items) {
      const d = i.position.distanceTo(playerPos);
      if (d > i.range) continue;
      if (i.label() === null) continue;
      const score = (i.priority ?? 0) * 100 - d;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    this.active = best;
  }

  trigger() {
    this.active?.action();
  }
}

export const interactions = new Interactions();

/**
 * DOM-overlay HUD. Real HTML/CSS, not canvas-drawn shapes — buttons are
 * always crisp, always tappable, and never drift from their hit areas
 * (the exact class of bug that killed the old game's top-right corner).
 */
import { store } from '../core/store';
import { HERBS } from '../data/items';
import { audio } from '../audio/audio';
import type { HerbDef } from '../data/items';

export class Hud {
  private counters = new Map<string, HTMLElement>();
  private gatherBtn: HTMLButtonElement;
  private timeChip: HTMLElement;
  private toastBox: HTMLElement;

  constructor(root: HTMLElement, onGather: () => void) {
    // top-left: inventory chips
    const inv = document.createElement('div');
    inv.className = 'hud-inventory';
    for (const herb of HERBS) {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerHTML = `<span class="dot" style="background:#${herb.blossom.toString(16).padStart(6, '0')}"></span><span class="chip-name">${herb.name}</span><span class="chip-count">0</span>`;
      inv.appendChild(chip);
      this.counters.set(herb.id, chip.querySelector('.chip-count')!);
    }
    root.appendChild(inv);

    // top-right: day/time + mute
    const topRight = document.createElement('div');
    topRight.className = 'hud-topright';
    this.timeChip = document.createElement('div');
    this.timeChip.className = 'chip';
    const muteBtn = document.createElement('button');
    muteBtn.className = 'icon-btn';
    muteBtn.textContent = store.get().muted ? '🔇' : '🔊';
    muteBtn.addEventListener('click', () => {
      audio.toggleMute();
      muteBtn.textContent = store.get().muted ? '🔇' : '🔊';
      audio.sfx('sfx-ui-click');
    });
    topRight.append(this.timeChip, muteBtn);
    root.appendChild(topRight);

    // bottom-right: gather action
    this.gatherBtn = document.createElement('button');
    this.gatherBtn.className = 'gather-btn hidden';
    this.gatherBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onGather();
    });
    root.appendChild(this.gatherBtn);

    // toasts
    this.toastBox = document.createElement('div');
    this.toastBox.className = 'toast-box';
    root.appendChild(this.toastBox);

    store.subscribe((s) => {
      for (const herb of HERBS) {
        this.counters.get(herb.id)!.textContent = String(s.inventory[herb.id] ?? 0);
      }
    });
  }

  setGatherTarget(herb: HerbDef | null) {
    if (herb) {
      this.gatherBtn.textContent = `Gather ${herb.name}`;
      this.gatherBtn.classList.remove('hidden');
    } else {
      this.gatherBtn.classList.add('hidden');
    }
  }

  setTime(time: number, day: number) {
    const hours = Math.floor(time * 24);
    const mins = Math.floor((time * 24 - hours) * 60);
    const icon = time > 0.26 && time < 0.76 ? '☀️' : '🌙';
    this.timeChip.textContent = `${icon} Day ${day} · ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  toast(msg: string) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    this.toastBox.appendChild(t);
    setTimeout(() => t.classList.add('out'), 1400);
    setTimeout(() => t.remove(), 1900);
  }

  /** intro overlay; resolves on first tap (also unlocks audio) */
  showIntro(): Promise<void> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'intro';
      overlay.innerHTML = `
        <div class="intro-card">
          <h1>Kettle <span class="amp">&amp;</span> Keel</h1>
          <p class="tagline">wash ashore · gather · brew · sail</p>
          <p class="hint">left thumb to walk, right thumb to look<br/>WASD + mouse drag on desktop · E to gather</p>
          <button class="begin-btn">Set foot on the island</button>
        </div>`;
      document.getElementById('app')!.appendChild(overlay);
      overlay.querySelector('.begin-btn')!.addEventListener('pointerdown', () => {
        audio.unlock();
        overlay.classList.add('fade');
        setTimeout(() => overlay.remove(), 650);
        resolve();
      });
    });
  }
}

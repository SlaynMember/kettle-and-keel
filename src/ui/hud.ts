/**
 * DOM-overlay HUD. Real HTML/CSS, not canvas-drawn shapes — buttons are
 * always crisp, always tappable, and never drift from their hit areas
 * (the exact class of bug that killed the old game's top-right corner).
 */
import { store } from '../core/store';
import { ITEMS } from '../data/items';
import { audio } from '../audio/audio';

const MAX_CHIPS = 5;

export class Hud {
  private inv: HTMLElement;
  private actionBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private satchelBtn: HTMLButtonElement;
  private timeChip: HTMLElement;
  private buffBox: HTMLElement;
  private toastBox: HTMLElement;
  private sleepFade: HTMLElement;

  constructor(root: HTMLElement, handlers: { onAction: () => void; onSatchel: () => void; onCancel: () => void }) {
    // top-left: compact inventory chips
    this.inv = document.createElement('div');
    this.inv.className = 'hud-inventory';
    root.appendChild(this.inv);

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

    // buffs under the clock
    this.buffBox = document.createElement('div');
    this.buffBox.className = 'hud-buffs';
    root.appendChild(this.buffBox);

    // bottom-right stack: satchel + action
    const stack = document.createElement('div');
    stack.className = 'hud-actions';
    this.satchelBtn = document.createElement('button');
    this.satchelBtn.className = 'satchel-btn';
    this.satchelBtn.innerHTML = '🎒';
    this.satchelBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handlers.onSatchel();
    });
    this.actionBtn = document.createElement('button');
    this.actionBtn.className = 'gather-btn hidden';
    this.actionBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handlers.onAction();
    });
    this.cancelBtn = document.createElement('button');
    this.cancelBtn.className = 'cancel-btn hidden';
    this.cancelBtn.textContent = 'Cancel';
    this.cancelBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handlers.onCancel();
    });
    stack.append(this.cancelBtn, this.actionBtn, this.satchelBtn);
    root.appendChild(stack);

    // toasts
    this.toastBox = document.createElement('div');
    this.toastBox.className = 'toast-box';
    root.appendChild(this.toastBox);

    // full-screen fade for the sleep sequence; driven by main's tick loop, not CSS transitions
    this.sleepFade = document.createElement('div');
    this.sleepFade.className = 'sleep-fade hidden';
    root.appendChild(this.sleepFade);

    store.subscribe((s) => {
      this.inv.innerHTML = '';
      const owned = ITEMS.filter((i) => (s.inventory[i.id] ?? 0) > 0);
      for (const item of owned.slice(0, MAX_CHIPS)) {
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.innerHTML = `<span class="chip-emoji">${item.emoji}</span><span class="chip-count">${s.inventory[item.id]}</span>`;
        chip.title = item.name;
        this.inv.appendChild(chip);
      }
      if (owned.length > MAX_CHIPS) {
        const more = document.createElement('div');
        more.className = 'chip';
        more.innerHTML = `<span class="chip-count">+${owned.length - MAX_CHIPS}</span>`;
        this.inv.appendChild(more);
      }
    });
  }

  private lastActionLabel: string | null = null;

  /** the big context button; null hides it. danger renders the invalid-placement state */
  setAction(label: string | null, opts: { danger?: boolean; cancelable?: boolean } = {}) {
    if (label) {
      this.actionBtn.textContent = label;
      this.actionBtn.classList.remove('hidden');
      this.actionBtn.classList.toggle('danger', !!opts.danger);
      // a fresh prompt bounces once so playtesters actually notice it appear
      if (label !== this.lastActionLabel && !opts.danger) {
        this.actionBtn.classList.remove('pop');
        void this.actionBtn.offsetWidth; // restart the animation
        this.actionBtn.classList.add('pop');
      }
    } else {
      this.actionBtn.classList.add('hidden');
    }
    this.lastActionLabel = label;
    this.cancelBtn.classList.toggle('hidden', !opts.cancelable);
  }

  setTime(time: number, day: number) {
    const hours = Math.floor(time * 24);
    const mins = Math.floor((time * 24 - hours) * 60);
    const icon = time > 0.26 && time < 0.76 ? '☀️' : '🌙';
    this.timeChip.textContent = `${icon} Day ${day} · ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  setBuffs(buffs: { speed: number; glow: number }) {
    this.buffBox.innerHTML = '';
    const entries: Array<[string, number]> = [
      ['🍵', buffs.speed],
      ['✨', buffs.glow],
    ];
    for (const [icon, secs] of entries) {
      if (secs <= 0) continue;
      const chip = document.createElement('div');
      chip.className = 'chip buff-chip';
      chip.textContent = `${icon} ${Math.ceil(secs)}s`;
      this.buffBox.appendChild(chip);
    }
  }

  /** 0 hides the fade entirely; otherwise sets its opacity directly (main.ts drives the curve) */
  setSleepFade(opacity: number) {
    if (opacity <= 0) {
      this.sleepFade.style.opacity = '0';
      this.sleepFade.classList.add('hidden');
      return;
    }
    this.sleepFade.classList.remove('hidden');
    this.sleepFade.style.opacity = String(opacity);
  }

  toast(msg: string) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    this.toastBox.appendChild(t);
    setTimeout(() => t.classList.add('out'), 1600);
    setTimeout(() => t.remove(), 2100);
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
          <p class="hint">left thumb to walk, right thumb to look<br/>WASD + mouse · click or E to use · Tab for satchel</p>
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

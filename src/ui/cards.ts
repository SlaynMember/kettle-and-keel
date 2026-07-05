/**
 * Two small parchment surfaces layered on the "you found something" moment:
 * a passing discovery card (first time meeting an item — purely informational,
 * never eats a tap) and a centered bottle note (blocks like a panel until
 * tapped away). Both DOM, matching the satchel/dialogue cream-and-wood frame.
 */
import { itemGlyph, type ItemDef } from '../data/items';

const DISCOVERY_SECONDS = 3.8;

interface QueuedDiscovery {
  item: ItemDef;
  flavor: string;
}

export class Cards {
  private discoveryEl: HTMLDivElement;
  private discoveryGlyph: HTMLDivElement;
  private discoveryTitle: HTMLDivElement;
  private discoveryFlavor: HTMLDivElement;
  private queue: QueuedDiscovery[] = [];
  private showing = false;
  private showTimer = 0;

  private noteEl: HTMLDivElement;
  private noteTextEl: HTMLDivElement;
  private resolveNote: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.discoveryEl = document.createElement('div');
    this.discoveryEl.className = 'discovery-card hidden';
    this.discoveryEl.innerHTML = `
      <div class="discovery-glyph"></div>
      <div class="discovery-copy">
        <div class="discovery-title"></div>
        <div class="discovery-flavor"></div>
      </div>`;
    root.appendChild(this.discoveryEl);
    this.discoveryGlyph = this.discoveryEl.querySelector('.discovery-glyph')!;
    this.discoveryTitle = this.discoveryEl.querySelector('.discovery-title')!;
    this.discoveryFlavor = this.discoveryEl.querySelector('.discovery-flavor')!;

    this.noteEl = document.createElement('div');
    this.noteEl.className = 'note-card hidden';
    this.noteEl.innerHTML = `
      <div class="note-caption">A note, salt-stained:</div>
      <div class="note-text"></div>
      <div class="note-hint">tap to fold it away</div>`;
    root.appendChild(this.noteEl);
    this.noteTextEl = this.noteEl.querySelector('.note-text')!;
    this.noteEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.closeNote();
    });
  }

  get noteOpen(): boolean {
    return !this.noteEl.classList.contains('hidden');
  }

  /** queues a "New: {name}" card; multiple discoveries in one tick show one at a time */
  discovery(item: ItemDef, flavor: string) {
    this.queue.push({ item, flavor });
    if (!this.showing) this.showNext();
  }

  private showNext() {
    const next = this.queue.shift();
    if (!next) {
      this.showing = false;
      this.discoveryEl.classList.add('hidden');
      return;
    }
    this.showing = true;
    this.discoveryGlyph.innerHTML = itemGlyph(next.item, 'discovery-glyph-img');
    this.discoveryTitle.textContent = `New: ${next.item.name}`;
    this.discoveryFlavor.textContent = next.flavor;
    this.discoveryEl.classList.remove('hidden');
    this.discoveryEl.classList.remove('pop');
    void this.discoveryEl.offsetWidth; // restart the slide-in animation
    this.discoveryEl.classList.add('pop');
    this.showTimer = DISCOVERY_SECONDS;
  }

  /** a found-bottle message; blocks like a panel until tapped away */
  note(text: string): Promise<void> {
    return new Promise((resolve) => {
      this.noteTextEl.textContent = `"${text}"`;
      this.noteEl.classList.remove('hidden');
      this.resolveNote = resolve;
    });
  }

  /** tap-to-fold, or main.ts routing the action button/E-key here while open */
  closeNote() {
    if (!this.noteOpen) return;
    this.noteEl.classList.add('hidden');
    const resolve = this.resolveNote;
    this.resolveNote = null;
    resolve?.();
  }

  /** drives the discovery auto-dismiss off the shared clock, not setTimeout */
  update(dt: number) {
    if (!this.showing) return;
    this.showTimer -= dt;
    if (this.showTimer <= 0) {
      this.discoveryEl.classList.add('hidden');
      this.showNext();
    }
  }
}

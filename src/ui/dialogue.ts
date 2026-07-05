/**
 * Reusable side-by-side cutscene/dialogue panel — DOM, matches the satchel's
 * cream/wood frame language. Player portrait left, gull portrait right, a
 * speech box between them with a typewriter reveal. First companion consumer:
 * meeting the gull at the bird bath (main.ts wires it up).
 */
import type { DialogueLine } from '../data/dialogue';
import { audio } from '../audio/audio';

const CHARS_PER_SEC = 28;

// player portrait is Will's hand-fed artwork (public/images/portrait-you.webp);
// the gull stays code-drawn — its lopsided picasso energy is canon now
const YOU_IMG = `<img src="/images/portrait-you.webp" alt="You"/>`;

const GULL_SVG = `
<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 92 Q18 60 34 46 Q26 34 34 24 Q46 12 62 22 Q74 30 70 46 Q84 56 82 92 Z" fill="#f0f2ee"/>
  <path d="M30 24 Q40 14 52 20" stroke="#262223" stroke-width="3.4" fill="none" stroke-linecap="round"/>
  <circle cx="46" cy="34" r="4" fill="#262223"/>
  <path d="M56 34 Q76 36 80 44 Q68 46 56 40 Z" fill="#e8a13d"/>
</svg>`;

export class DialoguePanel {
  private el: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private textEl: HTMLDivElement;
  private hintEl: HTMLDivElement;
  private portraitYou: HTMLDivElement;
  private portraitGull: HTMLDivElement;

  private lines: DialogueLine[] = [];
  private lineIndex = 0;
  private charIndex = 0;
  private typing = false;
  private typeTimer: number | null = null;
  private resolvePlay: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'dialogue hidden';
    this.el.innerHTML = `
      <div class="dialogue-bar">
        <div class="dialogue-portrait you">${YOU_IMG}</div>
        <div class="dialogue-speech">
          <div class="dialogue-name"></div>
          <div class="dialogue-text"></div>
          <div class="dialogue-hint hidden">▼ tap</div>
        </div>
        <div class="dialogue-portrait gull">${GULL_SVG}</div>
      </div>`;
    root.appendChild(this.el);
    this.nameEl = this.el.querySelector('.dialogue-name')!;
    this.textEl = this.el.querySelector('.dialogue-text')!;
    this.hintEl = this.el.querySelector('.dialogue-hint')!;
    this.portraitYou = this.el.querySelector('.dialogue-portrait.you')!;
    this.portraitGull = this.el.querySelector('.dialogue-portrait.gull')!;
    this.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.advance();
    });
  }

  get isOpen(): boolean {
    return !this.el.classList.contains('hidden');
  }

  /** plays a line sequence; resolves once the bar closes after the last line */
  play(lines: DialogueLine[]): Promise<void> {
    return new Promise((resolve) => {
      if (lines.length === 0) {
        resolve();
        return;
      }
      this.lines = lines;
      this.lineIndex = 0;
      this.resolvePlay = resolve;
      this.el.classList.remove('hidden');
      audio.sfx('sfx-ui-click');
      this.showLine();
    });
  }

  /** tap/click on the bar, or the game's E/interact path while open */
  advance() {
    if (!this.isOpen) return;
    if (this.typing) {
      this.finishLine();
      return;
    }
    this.lineIndex++;
    if (this.lineIndex >= this.lines.length) {
      this.close();
      return;
    }
    this.showLine();
  }

  private showLine() {
    const line = this.lines[this.lineIndex];
    this.nameEl.textContent = line.speaker === 'you' ? 'You' : 'Gull';
    this.portraitYou.classList.toggle('active', line.speaker === 'you');
    this.portraitGull.classList.toggle('active', line.speaker === 'gull');
    this.hintEl.classList.add('hidden');
    this.textEl.textContent = '';
    this.typing = true;
    this.charIndex = 0;
    if (this.typeTimer !== null) window.clearInterval(this.typeTimer);
    const full = line.text;
    this.typeTimer = window.setInterval(() => {
      this.charIndex++;
      this.textEl.textContent = full.slice(0, this.charIndex);
      if (this.charIndex % 4 === 0) audio.sfx('sfx-typewriter');
      if (this.charIndex >= full.length) this.finishLine();
    }, 1000 / CHARS_PER_SEC);
  }

  /** reveal the rest of the current line immediately */
  private finishLine() {
    if (this.typeTimer !== null) {
      window.clearInterval(this.typeTimer);
      this.typeTimer = null;
    }
    this.textEl.textContent = this.lines[this.lineIndex].text;
    this.typing = false;
    this.hintEl.classList.remove('hidden');
  }

  private close() {
    if (this.typeTimer !== null) {
      window.clearInterval(this.typeTimer);
      this.typeTimer = null;
    }
    this.el.classList.add('hidden');
    this.lines = [];
    const resolve = this.resolvePlay;
    this.resolvePlay = null;
    resolve?.();
  }
}

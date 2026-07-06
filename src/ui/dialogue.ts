/**
 * Reusable side-by-side cutscene/dialogue panel — DOM, matches the satchel's
 * cream/wood frame language. Player portrait left, gull portrait right, a
 * speech box between them with a typewriter reveal. First companion consumer:
 * meeting the gull at the bird bath (main.ts wires it up).
 */
import type { DialogueLine } from '../data/dialogue';
import { audio } from '../audio/audio';

const CHARS_PER_SEC = 45;

// both portraits are generated cut-paper artwork (content-drop sources,
// shipped from public/images/portraits/) — Biscuit kept the eyebrow
const YOU_IMG = `<img src="/images/portraits/you.webp" alt="You"/>`;
const GULL_NEUTRAL = '/images/portraits/biscuit.webp';
const GULL_IMG = `<img src="${GULL_NEUTRAL}" alt="Gull"/>`;

/** mood -> portrait swap; a gull line with no mood (or a 'you' line) shows neutral */
const GULL_MOOD_SRC: Record<NonNullable<DialogueLine['mood']>, string> = {
  annoyed: '/images/portraits/biscuit-annoyed.webp',
  smug: '/images/portraits/biscuit-smug.webp',
  pleased: '/images/portraits/biscuit-pleased.webp',
  worried: '/images/portraits/biscuit-worried.webp',
  proud: '/images/portraits/biscuit-proud.webp',
};

export class DialoguePanel {
  private el: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private textEl: HTMLDivElement;
  private hintEl: HTMLDivElement;
  private portraitYou: HTMLDivElement;
  private portraitGull: HTMLDivElement;
  private gullImg: HTMLImageElement;

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
        <div class="dialogue-portrait gull">${GULL_IMG}</div>
      </div>`;
    root.appendChild(this.el);
    this.nameEl = this.el.querySelector('.dialogue-name')!;
    this.textEl = this.el.querySelector('.dialogue-text')!;
    this.hintEl = this.el.querySelector('.dialogue-hint')!;
    this.portraitYou = this.el.querySelector('.dialogue-portrait.you')!;
    this.portraitGull = this.el.querySelector('.dialogue-portrait.gull')!;
    this.gullImg = this.portraitGull.querySelector('img')!;
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
    this.gullImg.src = line.speaker === 'gull' && line.mood ? GULL_MOOD_SRC[line.mood] : GULL_NEUTRAL;
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

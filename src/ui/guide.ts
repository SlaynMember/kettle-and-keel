/**
 * "The Island Asks" card: a tiny, purely informational quest prompt.
 * Never interactive — it must not intercept a tap meant for the canvas
 * underneath (see the #ui > * pointer-events note in styles.css).
 */
export class GuideCard {
  private el: HTMLDivElement;
  private textEl: HTMLDivElement;
  private current: string | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'guide-card hidden';
    this.el.innerHTML = `<div class="guide-label">The Island Asks</div><div class="guide-text"></div>`;
    root.appendChild(this.el);
    this.textEl = this.el.querySelector('.guide-text')!;
  }

  /** null hides the card; setting the same text again is a no-op (no innerHTML thrash) */
  setGoal(text: string | null) {
    if (text === this.current) return;
    this.current = text;
    if (text === null) {
      this.el.classList.add('hidden');
      return;
    }
    this.textEl.textContent = text;
    this.el.classList.remove('hidden');
  }
}

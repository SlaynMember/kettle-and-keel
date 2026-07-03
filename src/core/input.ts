/**
 * Unified input: touch (left-half virtual joystick + right-half look drag),
 * keyboard (WASD/arrows + E/Space to interact), and mouse drag to look.
 * Everything downstream reads the same abstraction — which is also the seam
 * where gamepad (Steam) and remote players (co-op) plug in later.
 */

export class Input {
  /** normalized move intent, x = right, y = forward, length <= 1 */
  move = { x: 0, y: 0 };

  private lookDX = 0;
  private lookDY = 0;
  private keys = new Set<string>();
  private interactHandlers: Array<() => void> = [];

  // touch tracking
  private movePointer: number | null = null;
  private lookPointer: number | null = null;
  private moveOrigin = { x: 0, y: 0 };
  private lookLast = { x: 0, y: 0 };
  private mouseDown = false;

  // joystick DOM
  private joyBase: HTMLDivElement;
  private joyNub: HTMLDivElement;

  private static readonly JOY_RADIUS = 52;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.joyBase = document.createElement('div');
    this.joyBase.className = 'joystick';
    this.joyNub = document.createElement('div');
    this.joyNub.className = 'joystick-nub';
    this.joyBase.appendChild(this.joyNub);
    uiRoot.appendChild(this.joyBase);

    canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyE' || e.code === 'Space') this.fireInteract();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  onInteract(fn: () => void) {
    this.interactHandlers.push(fn);
  }

  fireInteract() {
    this.interactHandlers.forEach((fn) => fn());
  }

  /** per-frame look delta in pixels; consuming resets it */
  consumeLook(): { dx: number; dy: number } {
    const out = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = 0;
    this.lookDY = 0;
    return out;
  }

  update() {
    // keyboard movement merges with (and yields to) touch joystick
    if (this.movePointer === null) {
      let x = 0;
      let y = 0;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
      const len = Math.hypot(x, y);
      this.move.x = len > 0 ? x / len : 0;
      this.move.y = len > 0 ? y / len : 0;
    }
  }

  private onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      this.mouseDown = true;
      return;
    }
    // touch: left 45% of screen drives the joystick, the rest drives the camera
    if (e.clientX < window.innerWidth * 0.45 && this.movePointer === null) {
      this.movePointer = e.pointerId;
      this.moveOrigin = { x: e.clientX, y: e.clientY };
      this.showJoystick(e.clientX, e.clientY);
    } else if (this.lookPointer === null) {
      this.lookPointer = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      if (this.mouseDown) {
        this.lookDX += e.movementX;
        this.lookDY += e.movementY;
      }
      return;
    }
    if (e.pointerId === this.movePointer) {
      const dx = e.clientX - this.moveOrigin.x;
      const dy = e.clientY - this.moveOrigin.y;
      const len = Math.hypot(dx, dy);
      const r = Input.JOY_RADIUS;
      const clamped = Math.min(len, r);
      const nx = len > 0 ? dx / len : 0;
      const ny = len > 0 ? dy / len : 0;
      this.move.x = (nx * clamped) / r;
      this.move.y = (-ny * clamped) / r; // screen-up = forward
      this.joyNub.style.transform = `translate(${nx * clamped}px, ${ny * clamped}px)`;
    } else if (e.pointerId === this.lookPointer) {
      // movementX/Y is 0 for touch on most mobile browsers — track deltas manually
      this.lookDX += e.clientX - this.lookLast.x;
      this.lookDY += e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      this.mouseDown = false;
      return;
    }
    if (e.pointerId === this.movePointer) {
      this.movePointer = null;
      this.move.x = 0;
      this.move.y = 0;
      this.hideJoystick();
    } else if (e.pointerId === this.lookPointer) {
      this.lookPointer = null;
    }
  };

  private showJoystick(x: number, y: number) {
    this.joyBase.style.left = `${x}px`;
    this.joyBase.style.top = `${y}px`;
    this.joyBase.classList.add('active');
    this.joyNub.style.transform = 'translate(0,0)';
  }

  private hideJoystick() {
    this.joyBase.classList.remove('active');
  }
}

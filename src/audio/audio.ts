/**
 * Audio manager. The one layer of the old game worth keeping was its audio
 * design: contextual, tuned volumes, distinct feedback moments. Files carried
 * over from Corsair Catch live in /public/audio.
 */
import { store } from '../core/store';

const SFX_VOLUMES: Record<string, number> = {
  'sfx-pickup': 0.5,
  'sfx-ui-click': 0.25,
  'sfx-typewriter': 0.3,
  'sfx-levelup': 0.45,
  'sfx-cast': 0.5,
};

class AudioManager {
  private bgm: HTMLAudioElement | null = null;
  private unlocked = false;

  /** Must be called from a user gesture (the "tap to begin" overlay). */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.bgm = new Audio('/audio/catch-pixel.mp3');
    this.bgm.loop = true;
    this.bgm.volume = 0.35;
    this.applyMute();
    this.bgm.play().catch(() => {
      /* autoplay refusal — user can unmute from the HUD */
    });
  }

  sfx(name: keyof typeof SFX_VOLUMES | string) {
    if (!this.unlocked || store.get().muted) return;
    const a = new Audio(`/audio/${name}.wav`);
    a.volume = SFX_VOLUMES[name] ?? 0.4;
    a.play().catch(() => {});
  }

  toggleMute() {
    store.set({ muted: !store.get().muted });
    this.applyMute();
  }

  private applyMute() {
    if (this.bgm) this.bgm.muted = store.get().muted;
  }
}

export const audio = new AudioManager();

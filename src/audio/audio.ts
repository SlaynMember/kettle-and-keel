/**
 * Audio manager. SFX design carried from Corsair Catch; the music is Will's
 * original Kettle & Keel soundtrack, played CONTEXTUALLY:
 *
 *   explore  — Tiny Tea Boat        (default: wandering, gathering, day)
 *   workshop — Harbor Toy Workshop / Building (satchel, kettle, placing)
 *   risk     — Hazy Tea Drift       (night — alert, not punished)
 *
 * (Beat the Drum lives in /music-reserve, waiting for boat crossings.)
 * Context switches crossfade over ~1.5s with a little hysteresis so quick
 * satchel peeks don't whiplash the music. Each track remembers its position.
 */
import { store } from '../core/store';

export type MusicContext = 'explore' | 'workshop' | 'risk';

const TRACKS: Record<MusicContext, string[]> = {
  explore: ['tiny-tea-boat'],
  workshop: ['harbor-toy-workshop', 'building'],
  risk: ['hazy-tea-drift'],
};

const MUSIC_KEY = 'kk-music-v2';
const BGM_VOLUME = 0.4;
const FADE_SECONDS = 1.5;
const CONTEXT_DEBOUNCE = 1.2; // seconds a new context must persist before switching

const SFX_VOLUMES: Record<string, number> = {
  'sfx-pickup': 0.5,
  'sfx-ui-click': 0.25,
  'sfx-typewriter': 0.3,
  'sfx-levelup': 0.45,
  'sfx-cast': 0.5,
};

class AudioManager {
  private unlocked = false;
  private current: HTMLAudioElement | null = null;
  private fading: HTMLAudioElement | null = null;
  private context: MusicContext = 'explore';
  private currentTrack = '';
  private pending: MusicContext | null = null;
  private pendingFor = 0;
  private positions: Record<string, number> = {};
  private workshopFlip = 0;

  /** Must be called from a user gesture (the "tap to begin" overlay). */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      const saved = JSON.parse(localStorage.getItem(MUSIC_KEY) || 'null');
      if (saved?.positions) this.positions = saved.positions;
    } catch {
      /* fresh start */
    }
    this.startTrack(this.pickTrack(this.context));

    window.setInterval(() => {
      if (this.current && !this.current.paused) {
        this.positions[this.currentTrack] = this.current.currentTime;
        localStorage.setItem(MUSIC_KEY, JSON.stringify({ positions: this.positions }));
      }
    }, 5000);
  }

  /** called every frame by the game loop; debounces then crossfades */
  setContext(ctx: MusicContext, dt: number) {
    if (!this.unlocked || ctx === this.context) {
      this.pending = null;
      return;
    }
    if (this.pending !== ctx) {
      this.pending = ctx;
      this.pendingFor = 0;
      return;
    }
    this.pendingFor += dt;
    if (this.pendingFor >= CONTEXT_DEBOUNCE) {
      this.context = ctx;
      this.pending = null;
      this.crossfadeTo(this.pickTrack(ctx));
    }
  }

  /** advance fades; called every frame */
  update(dt: number) {
    if (this.fading) {
      this.fading.volume = Math.max(0, this.fading.volume - (BGM_VOLUME / FADE_SECONDS) * dt);
      if (this.fading.volume <= 0.01) {
        this.fading.pause();
        this.fading = null;
      }
    }
    if (this.current && this.current.volume < BGM_VOLUME) {
      this.current.volume = Math.min(BGM_VOLUME, this.current.volume + (BGM_VOLUME / FADE_SECONDS) * dt);
    }
  }

  private pickTrack(ctx: MusicContext): string {
    const list = TRACKS[ctx];
    if (ctx === 'workshop') {
      this.workshopFlip = (this.workshopFlip + 1) % list.length;
      return list[this.workshopFlip];
    }
    return list[0];
  }

  private startTrack(name: string, fadeIn = false) {
    this.currentTrack = name;
    const a = new Audio(`/audio/${name}.mp3`);
    a.loop = true;
    a.volume = fadeIn ? 0 : BGM_VOLUME;
    a.currentTime = this.positions[name] || 0;
    a.muted = store.get().muted;
    a.play().catch(() => {
      /* autoplay refusal — user can unmute from the HUD */
    });
    this.current = a;
  }

  private crossfadeTo(name: string) {
    if (name === this.currentTrack) return;
    if (this.current) {
      this.positions[this.currentTrack] = this.current.currentTime;
      // if something was already fading, drop it immediately
      this.fading?.pause();
      this.fading = this.current;
    }
    this.startTrack(name, true);
  }

  sfx(name: keyof typeof SFX_VOLUMES | string) {
    if (!this.unlocked || store.get().muted) return;
    const a = new Audio(`/audio/${name}.wav`);
    a.volume = SFX_VOLUMES[name] ?? 0.4;
    a.play().catch(() => {});
  }

  toggleMute() {
    store.set({ muted: !store.get().muted });
    const muted = store.get().muted;
    if (this.current) this.current.muted = muted;
    if (this.fading) this.fading.muted = muted;
  }
}

export const audio = new AudioManager();

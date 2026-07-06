/**
 * Audio manager. SFX design carried from Corsair Catch; the music is Will's
 * original Kettle & Keel soundtrack, switched only by day/night — nothing
 * else (satchel, crafting, placement) touches the soundtrack:
 *
 *   day     — island 1 playlist: Tiny Tea Boat, then Harbor Toy Workshop,
 *             round-robin. Each track plays to its natural end (no loop)
 *             before crossfading into the next.
 *   day2    — island 2 playlist: Building leads, Harbor Toy Workshop follows.
 *   night   — Hazy Tea Drift, looped (both islands).
 *   sailing — Beat the Drum, looped, whenever the player holds the tiller.
 * The day<->night switch crossfades over ~4s, needs the new context to hold
 * for a few seconds, and never fires within MIN_PLAY_SECONDS of the last
 * switch — so dusk flicker doesn't whiplash the music. Each track remembers
 * its playback position; a day track that finishes naturally drops its saved
 * position so the playlist restarts that track fresh next time around.
 */
import { store } from '../core/store';

export type MusicContext = 'day' | 'day2' | 'night' | 'sailing';

const TRACKS: Record<MusicContext, string[]> = {
  day: ['tiny-tea-boat', 'harbor-toy-workshop'],
  day2: ['building', 'harbor-toy-workshop'],
  night: ['hazy-tea-drift'],
  sailing: ['beat-the-drum-extended'],
};

/** contexts whose single track loops instead of rolling a playlist */
const LOOPING: MusicContext[] = ['night', 'sailing'];

const MUSIC_KEY = 'kk-music-v2';
const BGM_VOLUME = 0.4;
const FADE_SECONDS = 4;
const CONTEXT_DEBOUNCE = 3; // seconds a new context must persist before switching
const MIN_PLAY_SECONDS = 12; // once a track starts, let it breathe before any switch

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
  private context: MusicContext = 'day';
  private currentTrack = '';
  /** which playlist entry is up per context; persists across context switches */
  private playlistIndex: Partial<Record<MusicContext, number>> = {};
  private pending: MusicContext | null = null;
  private pendingFor = 0;
  private positions: Record<string, number> = {};
  private sincePlay = 0;

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
    // boarding/leaving the boat is an explicit player act — switch fast;
    // day/night boundaries keep the slow debounce so dusk can't flap the music
    const sailingEdge = ctx === 'sailing' || this.context === 'sailing';
    const ready = sailingEdge
      ? this.pendingFor >= 0.4
      : this.pendingFor >= CONTEXT_DEBOUNCE && this.sincePlay >= MIN_PLAY_SECONDS;
    if (ready) {
      this.context = ctx;
      this.pending = null;
      this.crossfadeTo(this.pickTrack(ctx));
    }
  }

  /** advance fades; called every frame */
  update(dt: number) {
    this.sincePlay += dt;
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

  /** resume the context's playlist where it left off, or its single looping track */
  private pickTrack(ctx: MusicContext): string {
    return TRACKS[ctx][(this.playlistIndex[ctx] ?? 0) % TRACKS[ctx].length];
  }

  private startTrack(name: string, fadeIn = false) {
    this.currentTrack = name;
    this.sincePlay = 0;
    const a = new Audio(`/audio/${name}.mp3`);
    const ctx = this.context;
    const loops = LOOPING.includes(ctx);
    a.loop = loops;
    a.volume = fadeIn ? 0 : BGM_VOLUME;
    a.currentTime = this.positions[name] || 0;
    a.muted = store.get().muted;
    if (!loops) {
      // playlist tracks play once and hand off to the next entry
      a.addEventListener('ended', () => this.onPlaylistTrackEnded(a, name, ctx));
    }
    a.play().catch(() => {
      /* autoplay refusal — user can unmute from the HUD */
    });
    this.current = a;
  }

  /** a playlist track finished on its own — drop its resume spot and roll forward */
  private onPlaylistTrackEnded(track: HTMLAudioElement, name: string, ctx: MusicContext) {
    if (this.context !== ctx || track !== this.current) return;
    delete this.positions[name];
    this.fading?.pause();
    this.fading = this.current; // already stopped; update() lets the (silent) handle fade out and clear
    const next = ((this.playlistIndex[ctx] ?? 0) + 1) % TRACKS[ctx].length;
    this.playlistIndex[ctx] = next;
    this.startTrack(TRACKS[ctx][next], true);
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

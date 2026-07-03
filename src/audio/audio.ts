/**
 * Audio manager. The one layer of the old game worth keeping was its audio
 * design: contextual, tuned volumes, distinct feedback moments. Files carried
 * over from Corsair Catch live in /public/audio.
 *
 * Music is a rotating playlist that remembers its track and position across
 * refreshes. (Roadmap: original Kettle & Keel music.)
 */
import { store } from '../core/store';

const PLAYLIST = ['catch-pixel', 'long-modern-techno-8bit', 'beach-wave-corsair'];
const MUSIC_KEY = 'kk-music-v1';

const SFX_VOLUMES: Record<string, number> = {
  'sfx-pickup': 0.5,
  'sfx-ui-click': 0.25,
  'sfx-typewriter': 0.3,
  'sfx-levelup': 0.45,
  'sfx-cast': 0.5,
};

class AudioManager {
  private bgm: HTMLAudioElement | null = null;
  private trackIdx = 0;
  private unlocked = false;

  /** Must be called from a user gesture (the "tap to begin" overlay). */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;

    let resumeAt = 0;
    try {
      const saved = JSON.parse(localStorage.getItem(MUSIC_KEY) || 'null');
      if (saved && PLAYLIST.includes(saved.track)) {
        this.trackIdx = PLAYLIST.indexOf(saved.track);
        resumeAt = saved.time || 0;
      }
    } catch {
      /* fresh start */
    }
    this.playTrack(this.trackIdx, resumeAt);

    window.setInterval(() => {
      if (this.bgm && !this.bgm.paused) {
        localStorage.setItem(MUSIC_KEY, JSON.stringify({ track: PLAYLIST[this.trackIdx], time: this.bgm.currentTime }));
      }
    }, 5000);
  }

  private playTrack(idx: number, startAt = 0) {
    this.bgm?.pause();
    this.trackIdx = idx % PLAYLIST.length;
    this.bgm = new Audio(`/audio/${PLAYLIST[this.trackIdx]}.mp3`);
    this.bgm.volume = 0.35;
    this.bgm.currentTime = startAt;
    this.bgm.addEventListener('ended', () => this.playTrack(this.trackIdx + 1));
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

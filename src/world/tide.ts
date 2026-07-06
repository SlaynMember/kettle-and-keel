/**
 * The tide rides the day clock: one full cycle per day, low around
 * mid-morning (sandbars for the morning walker), high in the late night.
 * Everything that cares about "where is the water" reads getWaterLevel()
 * — main.ts stamps it from sky.time once per frame, so player, boat,
 * sharks, and HUD all agree without threading the sky through every system.
 */
import { SEA_LEVEL } from './terrain';

const TIDE_RANGE = 0.55;

/** tide offset (world y) for a 0..1 time of day */
export function tideAt(time: number): number {
  // sin minimum at t = 0.35 (mid-morning low), maximum at t = 0.85
  return TIDE_RANGE * Math.sin((time - 0.6) * Math.PI * 2);
}

/** is the tide currently coming in? (for the HUD arrow) */
export function tideRising(time: number): boolean {
  return Math.cos((time - 0.6) * Math.PI * 2) > 0;
}

let currentLevel = SEA_LEVEL;

/** main.ts calls this once per frame with sky.time */
export function setWorldTime(time: number) {
  currentLevel = SEA_LEVEL + tideAt(time);
}

/** current water surface height (tide included, waves excluded) */
export function getWaterLevel(): number {
  return currentLevel;
}

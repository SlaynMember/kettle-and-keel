/**
 * Turns the sky's 0..1 time-of-day fraction into human phrasing ("ready by
 * evening") for drying racks, gardens, and camp prompts.
 */

/** duplicated from world/sky.ts DAY_LENGTH (seconds per full day/night cycle) — keep in sync */
const DAY_LENGTH = 360;

export type TimeBucket = 'morning' | 'midday' | 'evening' | 'night';

/** which bucket a sky-time fraction (0..1) falls into */
export function bucketFor(time: number): TimeBucket {
  const t = ((time % 1) + 1) % 1;
  if (t >= 0.22 && t < 0.45) return 'morning';
  if (t >= 0.45 && t < 0.6) return 'midday';
  if (t >= 0.6 && t < 0.78) return 'evening';
  return 'night';
}

/**
 * Project forward from `nowTime` by `secondsFromNow` real seconds and name
 * the bucket it lands in — or 'soon' if that's the bucket we're already in
 * (so a two-minute wait doesn't get billed as "ready by morning").
 */
export function readyBucket(nowTime: number, secondsFromNow: number): string {
  const current = bucketFor(nowTime);
  const projected = ((nowTime + secondsFromNow / DAY_LENGTH) % 1 + 1) % 1;
  const bucket = bucketFor(projected);
  return bucket === current ? 'soon' : bucket;
}

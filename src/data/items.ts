/**
 * Content registry. Rule carried over from the post-mortem: nothing goes in
 * this file unless it is reachable in the world in the same release.
 */

export interface HerbDef {
  id: string;
  name: string;
  /** leaf color */
  color: number;
  /** blossom color */
  blossom: number;
  /** how many clusters spawn on the island */
  count: number;
  /** terrain height band the herb spawns in (world y) */
  minH: number;
  maxH: number;
  /** seconds before a picked cluster regrows */
  respawn: number;
}

export const HERBS: HerbDef[] = [
  {
    id: 'seamint',
    name: 'Seamint',
    color: 0x9fd8cb,
    blossom: 0x63bfae,
    count: 26,
    minH: 0.9,
    maxH: 5,
    respawn: 60,
  },
  {
    id: 'emberbloom',
    name: 'Emberbloom',
    color: 0x7c8f4e,
    blossom: 0xe8623d,
    count: 10,
    minH: 4.5,
    maxH: 14,
    respawn: 90,
  },
];

export const HERB_BY_ID = new Map(HERBS.map((h) => [h.id, h]));

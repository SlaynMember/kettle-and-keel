/**
 * Content registry. Rule carried over from the post-mortem: nothing goes in
 * this file unless it is reachable in the world in the same release.
 */

export type ItemId =
  | 'seamint'
  | 'emberbloom'
  | 'wood'
  | 'stone'
  | 'algae'
  | 'dried_seamint'
  | 'dried_emberbloom'
  | 'seamint_tea'
  | 'ember_chai'
  | 'drying_rack_kit';

export interface ItemDef {
  id: ItemId;
  name: string;
  emoji: string;
  desc: string;
  /** teas can be drunk from the satchel */
  drinkable?: { buff: 'speed' | 'glow'; seconds: number };
  /** kits can be placed in the world */
  placeable?: 'drying_rack';
  /** fresh herbs can go on a drying rack */
  driesTo?: ItemId;
}

export const ITEMS: ItemDef[] = [
  { id: 'seamint', name: 'Seamint', emoji: '🌿', desc: 'Cool, bright herb from the beach grass.', driesTo: 'dried_seamint' },
  { id: 'emberbloom', name: 'Emberbloom', emoji: '🌺', desc: 'Warm highland blossom.', driesTo: 'dried_emberbloom' },
  { id: 'wood', name: 'Wood', emoji: '🪵', desc: 'Knocked from island trees.' },
  { id: 'stone', name: 'Stone', emoji: '🪨', desc: 'Chipped from boulders.' },
  { id: 'algae', name: 'Algae', emoji: '🌱', desc: 'Silky strands from the shallows.' },
  { id: 'dried_seamint', name: 'Dried Seamint', emoji: '🍃', desc: 'Ready for the kettle.' },
  { id: 'dried_emberbloom', name: 'Dried Emberbloom', emoji: '🥀', desc: 'Ready for the kettle.' },
  {
    id: 'seamint_tea',
    name: 'Seamint Tea',
    emoji: '🍵',
    desc: 'Drink for quick, light steps.',
    drinkable: { buff: 'speed', seconds: 120 },
  },
  {
    id: 'ember_chai',
    name: 'Ember Chai',
    emoji: '☕',
    desc: 'Drink to carry a warm glow through the night.',
    drinkable: { buff: 'glow', seconds: 150 },
  },
  {
    id: 'drying_rack_kit',
    name: 'Drying Rack',
    emoji: '🪤',
    desc: 'Place it, load fresh herbs, come back for dried leaves.',
    placeable: 'drying_rack',
  },
];

export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export interface RecipeDef {
  id: string;
  output: ItemId;
  outputQty: number;
  inputs: Partial<Record<ItemId, number>>;
  /** hand = anywhere via satchel; kettle = only at the campfire kettle */
  station: 'hand' | 'kettle';
}

export const RECIPES: RecipeDef[] = [
  { id: 'r_rack', output: 'drying_rack_kit', outputQty: 1, inputs: { wood: 4, stone: 2 }, station: 'hand' },
  { id: 'r_seamint_tea', output: 'seamint_tea', outputQty: 1, inputs: { dried_seamint: 2, algae: 1 }, station: 'kettle' },
  { id: 'r_ember_chai', output: 'ember_chai', outputQty: 1, inputs: { dried_emberbloom: 2, dried_seamint: 1 }, station: 'kettle' },
];

/** seconds of real time for herbs to dry on a rack (60s = 4 in-game hours) */
export const DRY_SECONDS = 60;

// ---- gatherable herb clusters ----

export interface HerbDef {
  id: ItemId;
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

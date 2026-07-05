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
  | 'drying_rack_kit'
  | 'bird_bath_kit'
  | 'shovel'
  | 'sand'
  | 'dirt'
  | 'loam'
  | 'garden_bed_kit'
  | 'lean_to_kit';

export interface ItemDef {
  id: ItemId;
  name: string;
  emoji: string;
  desc: string;
  /** generated art in public/images/icons/items/; emoji is the fallback */
  icon?: string;
  /** teas can be drunk from the satchel */
  drinkable?: { buff: 'speed' | 'glow'; seconds: number };
  /** kits can be placed in the world */
  placeable?: 'drying_rack' | 'bird_bath' | 'garden_bed' | 'lean_to';
  /** fresh herbs can go on a drying rack */
  driesTo?: ItemId;
}

/** item glyph markup: generated icon when we have one, emoji otherwise */
export function itemGlyph(item: ItemDef, cls: string): string {
  return item.icon
    ? `<img class="${cls} item-icon" src="${item.icon}" alt="${item.name}"/>`
    : `<span class="${cls}">${item.emoji}</span>`;
}

const ICONS = '/images/icons/items';

export const ITEMS: ItemDef[] = [
  { id: 'seamint', name: 'Seamint', emoji: '🌿', icon: `${ICONS}/seamint.webp`, desc: 'Cool, bright herb from the beach grass.', driesTo: 'dried_seamint' },
  { id: 'emberbloom', name: 'Emberbloom', emoji: '🌺', icon: `${ICONS}/emberbloom.webp`, desc: 'Warm highland blossom.', driesTo: 'dried_emberbloom' },
  { id: 'wood', name: 'Wood', emoji: '🪵', icon: `${ICONS}/wood.webp`, desc: 'Knocked from island trees.' },
  { id: 'stone', name: 'Stone', emoji: '🪨', icon: `${ICONS}/stone.webp`, desc: 'Chipped from boulders.' },
  { id: 'algae', name: 'Algae', emoji: '🌱', icon: `${ICONS}/algae.webp`, desc: 'Silky strands from the shallows.' },
  { id: 'dried_seamint', name: 'Dried Seamint', emoji: '🍃', icon: `${ICONS}/dried-herbs.webp`, desc: 'Ready for the kettle.' },
  { id: 'dried_emberbloom', name: 'Dried Emberbloom', emoji: '🥀', icon: `${ICONS}/dried-herbs.webp`, desc: 'Ready for the kettle.' },
  {
    id: 'seamint_tea',
    name: 'Seamint Tea',
    emoji: '🍵',
    icon: `${ICONS}/seamint-tea.webp`,
    desc: 'Drink for quick, light steps.',
    drinkable: { buff: 'speed', seconds: 120 },
  },
  {
    id: 'ember_chai',
    name: 'Ember Chai',
    emoji: '☕',
    icon: `${ICONS}/ember-chai.webp`,
    desc: 'Drink to carry a warm glow through the night.',
    drinkable: { buff: 'glow', seconds: 150 },
  },
  {
    id: 'drying_rack_kit',
    name: 'Drying Rack',
    emoji: '🪤',
    icon: `${ICONS}/drying-rack.webp`,
    desc: 'Place it, load fresh herbs, come back for dried leaves.',
    placeable: 'drying_rack',
  },
  {
    id: 'bird_bath_kit',
    name: 'Bird Bath',
    emoji: '⛲',
    icon: `${ICONS}/bird-bath.webp`,
    desc: 'A stone basin. Fill it with something warm and see who visits.',
    placeable: 'bird_bath',
  },
  { id: 'shovel', name: 'Shovel', emoji: '🪏', icon: `${ICONS}/shovel.webp`, desc: 'Scoops sand on the beach, dirt inland.' },
  { id: 'sand', name: 'Sand', emoji: '🏖️', icon: `${ICONS}/sand.webp`, desc: 'Warm beach sand. Gardens want it.' },
  { id: 'dirt', name: 'Dirt', emoji: '🟤', icon: `${ICONS}/dirt.webp`, desc: 'Rich inland soil.' },
  { id: 'loam', name: 'Loam', emoji: '🪴', icon: `${ICONS}/loam.webp`, desc: 'Sand, dirt, and algae worked together. Gardens love it.' },
  {
    id: 'garden_bed_kit',
    name: 'Garden Bed',
    emoji: '🌾',
    icon: `${ICONS}/garden-bed.webp`,
    desc: 'A planter frame. Fill with loam, grow herbs at home.',
    placeable: 'garden_bed',
  },
  {
    id: 'lean_to_kit',
    name: 'Lean-To',
    emoji: '⛺',
    icon: `${ICONS}/lean-to.webp`,
    desc: 'A first roof. Sleep through the night.',
    placeable: 'lean_to',
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
  { id: 'r_bird_bath', output: 'bird_bath_kit', outputQty: 1, inputs: { stone: 4, wood: 1 }, station: 'hand' },
  { id: 'r_seamint_tea', output: 'seamint_tea', outputQty: 1, inputs: { dried_seamint: 2, algae: 1 }, station: 'kettle' },
  { id: 'r_ember_chai', output: 'ember_chai', outputQty: 1, inputs: { dried_emberbloom: 2, dried_seamint: 1 }, station: 'kettle' },
  { id: 'r_shovel', output: 'shovel', outputQty: 1, inputs: { wood: 2, stone: 1 }, station: 'hand' },
  { id: 'r_loam', output: 'loam', outputQty: 2, inputs: { sand: 2, dirt: 2, algae: 1 }, station: 'hand' },
  { id: 'r_garden_bed', output: 'garden_bed_kit', outputQty: 1, inputs: { wood: 1, loam: 2 }, station: 'hand' },
  { id: 'r_lean_to', output: 'lean_to_kit', outputQty: 1, inputs: { wood: 6, stone: 2 }, station: 'hand' },
];

/** seconds of real time for herbs to dry on a rack (60s = 4 in-game hours) */
export const DRY_SECONDS = 60;

/** seconds of real time for a planted garden crop to grow (90s = 6 in-game hours) */
export const GROW_SECONDS = 90;

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
    color: 0x87b28e,
    blossom: 0xaec4e8,
    count: 14,
    minH: 0.9,
    maxH: 5,
    respawn: 60,
  },
  {
    id: 'emberbloom',
    name: 'Emberbloom',
    color: 0x74884f,
    blossom: 0xe8623d,
    count: 7,
    minH: 4.5,
    maxH: 14,
    respawn: 90,
  },
];

export const HERB_BY_ID = new Map(HERBS.map((h) => [h.id, h]));

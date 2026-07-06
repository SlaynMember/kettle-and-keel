/**
 * Discovery-card flavor text. Pure data, one line per item — ui/cards.ts
 * renders it, main.ts decides when an item is "new" (see store.discovered).
 * Items with no entry here still get silently marked discovered; they just
 * never earn a card.
 */
import type { ItemId } from './items';

export const FLAVOR: Partial<Record<ItemId, string>> = {
  seamint: 'Cool, bright, and already judging the kettle.',
  emberbloom: 'Warm petals with the confidence of a tiny campfire.',
  wood: 'Dry enough to build with, damp enough to complain.',
  stone: 'A solid argument for owning pockets.',
  algae: 'Slick kelp-green strands from the shallows. Probably useful.',
  dried_seamint: "Crinkly, fragrant, and ready to become someone's opinion.",
  dried_emberbloom: 'Spice-warm leaves with a sunset tucked inside.',
  seamint_tea: 'Brisk, clean, and likely to make your feet ambitious.',
  ember_chai: 'Warm, spicy, probably legal.',
  drying_rack_kit: 'Turns damp hope into proper ingredients, given time.',
  bird_bath_kit: 'A stone basin for water, tea, and questionable diplomacy.',
  shovel: "The island's secrets are mostly sand-based. Now you're equipped.",
  sand: 'A million tiny rocks agreeing to be soft.',
  dirt: 'Honest ground. Gets under your nails and stays loyal.',
  loam: 'Soil with a resume. Gardens ask for it by name.',
  garden_bed_kit: 'A promise to stay a while, framed in wood.',
  lean_to_kit: 'Half a house. The optimistic half.',
  kelp: 'The deep forest waves back, apparently.',
  dried_kelp: 'Smells like low tide and good decisions.',
  kelp_tea: 'Tastes like the horizon. Your lungs approve.',
  pearl: 'The sea kept this secret for years. Now it has trust issues.',
};

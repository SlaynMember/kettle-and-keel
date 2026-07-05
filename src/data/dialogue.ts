/**
 * Dialogue content. Pure data — the DialoguePanel (ui/dialogue.ts) drives the
 * typewriter/portrait presentation; nothing here knows about the DOM.
 */

export interface DialogueLine {
  speaker: 'you' | 'gull';
  text: string;
}

/** first meeting: player pours seamint tea into the bird bath and the gull lands */
export const MEET_GULL: DialogueLine[] = [
  { speaker: 'gull', text: 'SQUAWK. Is that… seamint? You brewed a whole kettle and poured it in a BIRDBATH?' },
  { speaker: 'you', text: 'Seemed like the fastest way to meet the locals.' },
  { speaker: 'gull', text: 'Bold. Wasteful. I respect it.' },
  { speaker: 'gull', text: "…okay. That's the good stuff." },
  { speaker: 'you', text: 'Made it myself. Dried the leaves and everything.' },
  { speaker: 'gull', text: "Name's Biscuit. ADMIRAL Biscuit, of every wind from here to the reef." },
  { speaker: 'gull', text: "Keep the warm stuff coming, sailor, and maybe I'll tell you what's out past the shallows." },
  { speaker: 'you', text: 'Deal, Admiral.' },
];

/** rotating small talk once Biscuit has moved in */
export const GULL_CHATTER: DialogueLine[][] = [
  [{ speaker: 'gull', text: 'The reef hides more than fish, sailor. Bring a bigger boat. Or any boat.' }],
  [{ speaker: 'gull', text: "Wind's turning westerly. Good day to build something." }],
  [{ speaker: 'gull', text: 'I once flew two days straight for a single chip. Worth it.' }],
  [{ speaker: 'gull', text: "Your drying rack… it's actually fine. Don't let it go to your head." }],
  [{ speaker: 'gull', text: 'More seamint next time. The Admiral has standards.' }],
];

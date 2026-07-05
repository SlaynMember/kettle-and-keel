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
  // second chatter batch — from the GPT writing pack (2026-07-05), same voice
  [{ speaker: 'gull', text: 'You call that a plan? Good. Plans with corners get caught in the wind.' }],
  [{ speaker: 'gull', text: 'I inspected the camp while you were away. It passed. Barely. Do not make me say it twice.' }],
  [{ speaker: 'gull', text: 'The kettle has been quiet too long. A quiet kettle is how bad ideas get confident.' }],
  [{ speaker: 'gull', text: 'If you are going to wander, wander toward something useful. Preferably tea.' }],
  [{ speaker: 'gull', text: 'I saw a fish laugh at your dock plans. Personally, I found that rude.' }],
  [{ speaker: 'gull', text: 'The sea is pretending to be calm. I respect the commitment, but not the acting.' }],
  [{ speaker: 'gull', text: 'Your satchel smells like wet leaves and ambition. I have smelled worse captains.' }],
  [{ speaker: 'gull', text: 'If you bring me another warm cup, I may reveal a secret. It will probably be about you needing a boat.' }],
  [{ speaker: 'gull', text: 'The bath is not a mug, but I admire your refusal to accept furniture categories.' }],
  [{ speaker: 'gull', text: 'You move like a person who recently discovered ankles. Progress.' }],
  [{ speaker: 'gull', text: 'I checked the horizon. Still there. Very smug about it.' }],
  [{ speaker: 'gull', text: 'Dry herbs before you brew them. I cannot believe I am the responsible one.' }],
  [{ speaker: 'gull', text: 'That wreck on the beach keeps looking at you. Look back. Establish dominance.' }],
  [{ speaker: 'gull', text: 'A proper admiral delegates. I am delegating all heavy lifting to you.' }],
  [{ speaker: 'gull', text: 'If the wind changes, blame the moon. If the tea is bad, blame yourself.' }],
  [{ speaker: 'gull', text: 'You are improving. Slowly. Like moss learning paperwork.' }],
  [{ speaker: 'gull', text: 'The reef has teeth. Small ones, mostly. Still, build a boat with confidence.' }],
  [{ speaker: 'gull', text: 'I found a shell shaped like your future. It was damp and confused.' }],
  [{ speaker: 'gull', text: 'The island likes people who listen. It tolerates people who poke every bush. You are somewhere between.' }],
  [{ speaker: 'gull', text: 'More seamint would improve morale. Mine, specifically.' }],
  [{ speaker: 'gull', text: 'The campfire is doing excellent work. Try to keep up.' }],
  [{ speaker: 'gull', text: 'I once stole breakfast from a sailor twice your size. This is a warning and a resume.' }],
  [{ speaker: 'gull', text: 'The tide left you gifts. Or problems. The sea is bad at labeling.' }],
  [{ speaker: 'gull', text: 'Your rack is making the leaves respectable. I hate when your ideas work.' }],
  [{ speaker: 'gull', text: 'Sailors used to read stars. You can start with the big bright one and work up.' }],
  [{ speaker: 'gull', text: 'If you fall in, swim like you meant to do that.' }],
  [{ speaker: 'gull', text: 'I have named that rock Captain Useless. You may mine it if diplomacy fails.' }],
  [{ speaker: 'gull', text: 'Tea first, heroics second. This is not cowardice. This is scheduling.' }],
  [{ speaker: 'gull', text: 'I am beginning to suspect you are trainable. Do not become unbearable about it.' }],
  [{ speaker: 'gull', text: 'The horizon is not going to cross itself. Finish the chores, then we scheme.' }],
];

/**
 * Dialogue content. Pure data — the DialoguePanel (ui/dialogue.ts) drives the
 * typewriter/portrait presentation; nothing here knows about the DOM.
 */

export interface DialogueLine {
  speaker: 'you' | 'gull';
  text: string;
  /** portrait swap; meaningful only on gull lines */
  mood?: 'annoyed' | 'smug' | 'pleased';
}

/** first meeting: player pours seamint tea into the bird bath and the gull lands */
export const MEET_GULL: DialogueLine[] = [
  { speaker: 'gull', text: 'SQUAWK. Is that… seamint? You brewed a whole kettle and poured it in a BIRDBATH?', mood: 'annoyed' },
  { speaker: 'you', text: 'Seemed like the fastest way to meet the locals.' },
  { speaker: 'gull', text: 'Bold. Wasteful. I respect it.', mood: 'smug' },
  { speaker: 'gull', text: "…okay. That's the good stuff.", mood: 'pleased' },
  { speaker: 'you', text: 'Made it myself. Dried the leaves and everything.' },
  { speaker: 'gull', text: "Name's Biscuit. ADMIRAL Biscuit, of every wind from here to the reef.", mood: 'smug' },
  { speaker: 'gull', text: "Keep the warm stuff coming, sailor, and maybe I'll tell you what's out past the shallows.", mood: 'pleased' },
  { speaker: 'you', text: 'Deal, Admiral.' },
];

/** rotating small talk once Biscuit has moved in */
export const GULL_CHATTER: DialogueLine[][] = [
  [{ speaker: 'gull', text: 'The reef hides more than fish, sailor. Bring a bigger boat. Or any boat.' }],
  [{ speaker: 'gull', text: "Wind's turning westerly. Good day to build something." }],
  [{ speaker: 'gull', text: 'I once flew two days straight for a single chip. Worth it.', mood: 'pleased' }],
  [{ speaker: 'gull', text: "Your drying rack… it's actually fine. Don't let it go to your head.", mood: 'smug' }],
  [{ speaker: 'gull', text: 'More seamint next time. The Admiral has standards.', mood: 'annoyed' }],
  // second chatter batch — from the GPT writing pack (2026-07-05), same voice
  [{ speaker: 'gull', text: 'You call that a plan? Good. Plans with corners get caught in the wind.' }],
  [{ speaker: 'gull', text: 'I inspected the camp while you were away. It passed. Barely. Do not make me say it twice.', mood: 'annoyed' }],
  [{ speaker: 'gull', text: 'The kettle has been quiet too long. A quiet kettle is how bad ideas get confident.' }],
  [{ speaker: 'gull', text: 'If you are going to wander, wander toward something useful. Preferably tea.', mood: 'annoyed' }],
  [{ speaker: 'gull', text: 'I saw a fish laugh at your dock plans. Personally, I found that rude.', mood: 'annoyed' }],
  [{ speaker: 'gull', text: 'The sea is pretending to be calm. I respect the commitment, but not the acting.', mood: 'smug' }],
  [{ speaker: 'gull', text: 'Your satchel smells like wet leaves and ambition. I have smelled worse captains.', mood: 'pleased' }],
  [{ speaker: 'gull', text: 'If you bring me another warm cup, I may reveal a secret. It will probably be about you needing a boat.', mood: 'smug' }],
  [{ speaker: 'gull', text: 'The bath is not a mug, but I admire your refusal to accept furniture categories.', mood: 'pleased' }],
  [{ speaker: 'gull', text: 'You move like a person who recently discovered ankles. Progress.' }],
  [{ speaker: 'gull', text: 'I checked the horizon. Still there. Very smug about it.' }],
  [{ speaker: 'gull', text: 'Dry herbs before you brew them. I cannot believe I am the responsible one.', mood: 'annoyed' }],
  [{ speaker: 'gull', text: 'That wreck on the beach keeps looking at you. Look back. Establish dominance.' }],
  [{ speaker: 'gull', text: 'A proper admiral delegates. I am delegating all heavy lifting to you.', mood: 'smug' }],
  [{ speaker: 'gull', text: 'If the wind changes, blame the moon. If the tea is bad, blame yourself.' }],
  [{ speaker: 'gull', text: 'You are improving. Slowly. Like moss learning paperwork.', mood: 'pleased' }],
  [{ speaker: 'gull', text: 'The reef has teeth. Small ones, mostly. Still, build a boat with confidence.' }],
  [{ speaker: 'gull', text: 'I found a shell shaped like your future. It was damp and confused.' }],
  [{ speaker: 'gull', text: 'The island likes people who listen. It tolerates people who poke every bush. You are somewhere between.' }],
  [{ speaker: 'gull', text: 'More seamint would improve morale. Mine, specifically.', mood: 'annoyed' }],
  [{ speaker: 'gull', text: 'The campfire is doing excellent work. Try to keep up.', mood: 'smug' }],
  [{ speaker: 'gull', text: 'I once stole breakfast from a sailor twice your size. This is a warning and a resume.', mood: 'smug' }],
  [{ speaker: 'gull', text: 'The tide left you gifts. Or problems. The sea is bad at labeling.' }],
  [{ speaker: 'gull', text: 'Your rack is making the leaves respectable. I hate when your ideas work.', mood: 'pleased' }],
  [{ speaker: 'gull', text: 'Sailors used to read stars. You can start with the big bright one and work up.' }],
  [{ speaker: 'gull', text: 'If you fall in, swim like you meant to do that.' }],
  [{ speaker: 'gull', text: 'I have named that rock Captain Useless. You may mine it if diplomacy fails.' }],
  [{ speaker: 'gull', text: 'Tea first, heroics second. This is not cowardice. This is scheduling.' }],
  [{ speaker: 'gull', text: 'I am beginning to suspect you are trainable. Do not become unbearable about it.', mood: 'pleased' }],
  [{ speaker: 'gull', text: 'The horizon is not going to cross itself. Finish the chores, then we scheme.', mood: 'annoyed' }],
];

/** notes found in washed-ashore bottles (world/beachfinds.ts); selection is deterministic per day */
export const BOTTLE_NOTES: string[] = [
  'If found: return my spoon to the third island. It knows what it did.',
  'The tide charts were wrong, or I read them upside down. Either way, do not trust smug paper.',
  'To whoever finds this: dry the bright leaves first. The kettle remembers mistakes.',
  'I buried something useful near a crooked palm. Then the palm straightened. Sorry.',
  'Heard gulls arguing about a sailor with a red scarf. If that is you, duck.',
  'The reef opens at low tide. It also closes. That second part matters more.',
  'Never trade a good cup for a shiny shell unless the shell hums back.',
  'Day 4: still no boat. Day 5: considered apologizing to my boat. Day 6: no.',
  'The blue flowers taste like morning. The orange ones taste like bad decisions made warmly.',
  'If the beach gives you wood, build. If it gives you a boot, investigate the other boot.',
  'I saw lights past the sandbar after sunset. Could be lanterns. Could be opinions.',
  'A cracked kettle can still sing. A cracked hull cannot. Prioritize accordingly.',
  'Whoever owns the bird bath: the gull is lying about being an admiral. Probably.',
  'The cove is kinder at dawn. It has had all night to regret yesterday.',
  'I left a marker near the shallow kelp bed. If it is gone, blame the crabs.',
  'Do not eat the red mushrooms. Do admire their confidence from a distance.',
  'Storm took the mast, kept the soup, spared the hat. Mixed review.',
  'If you hear bells underwater, come back with tea and better lungs.',
  'The island rewards patience, but it also rewards poking things with a stick.',
  'Tell Biscuit I still owe him a chip. Do not tell him where I live.',
];

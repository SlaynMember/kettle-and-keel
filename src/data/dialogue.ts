/**
 * Dialogue content. Pure data — the DialoguePanel (ui/dialogue.ts) drives the
 * typewriter/portrait presentation; nothing here knows about the DOM.
 */

export interface DialogueLine {
  speaker: 'you' | 'gull';
  text: string;
  /** portrait swap; meaningful only on gull lines */
  mood?: 'annoyed' | 'smug' | 'pleased' | 'worried' | 'proud';
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

// ---- boat arc copy (Codex writing pack 3, 2026-07-05) ----

/** stage-0 wreck inspection when the hull can't be afforded yet; one line per visit */
export const WRECK_HULL_LINES: DialogueLine[] = [
  { speaker: 'gull', text: 'The bottom is less hole than memory now. Promising.', mood: 'pleased' },
  { speaker: 'gull', text: 'Patch there. Yes, there. The ocean has been pointing at it all morning.', mood: 'annoyed' },
  { speaker: 'gull', text: 'I approve of any plan that keeps the sea outside the boat.', mood: 'smug' },
  { speaker: 'gull', text: 'That patch is crooked. Fortunately, so is every honest vessel.', mood: 'smug' },
  { speaker: 'gull', text: 'If it floats for ten breaths, I will call it engineering.' },
  { speaker: 'gull', text: 'The hull has stopped looking embarrassed. Continue.', mood: 'pleased' },
];

/** stage-1 (hull rebuilt, rig unaffordable): deck pride first, then mast talk */
export const WRECK_RIG_LINES: DialogueLine[] = [
  { speaker: 'gull', text: 'A deck. At last, a proper place for an admiral to criticize from.', mood: 'smug' },
  { speaker: 'gull', text: 'Step carefully. It is new, and therefore dramatic.' },
  { speaker: 'gull', text: 'The boards complain less than you do. I respect them.', mood: 'smug' },
  { speaker: 'gull', text: 'This is starting to resemble a boat instead of a seaside apology.', mood: 'pleased' },
  { speaker: 'gull', text: 'Leave room for command. By which I mean me.', mood: 'smug' },
  { speaker: 'gull', text: 'Good footing matters. Panic is easier with traction.' },
  { speaker: 'gull', text: 'Up it goes. Try not to spear the sky.' },
  { speaker: 'gull', text: 'A mast changes things. The horizon notices.', mood: 'pleased' },
  { speaker: 'gull', text: 'Tie it steady. The wind loves loose arguments.' },
  { speaker: 'gull', text: 'That is tall enough to make bad ideas visible.', mood: 'smug' },
  { speaker: 'gull', text: 'I can almost hear the sail bragging.', mood: 'pleased' },
  { speaker: 'gull', text: 'There. A spine for the little boat.', mood: 'pleased' },
];

/** plays once, the moment she launches */
export const LAUNCH_CEREMONY: DialogueLine[] = [
  { speaker: 'you', text: 'She floats.' },
  { speaker: 'gull', text: 'Naturally. I supervised from a distance of importance.', mood: 'smug' },
  { speaker: 'you', text: 'Permission to launch, Admiral?' },
  { speaker: 'gull', text: 'Granted. The fleet accepts its second member.', mood: 'proud' },
  { speaker: 'you', text: 'Second?' },
  { speaker: 'gull', text: 'I have been a fleet for years. You are catching up.', mood: 'smug' },
  { speaker: 'you', text: 'Any ceremony?' },
  { speaker: 'gull', text: 'Yes. We glare at the sea until it behaves.' },
  { speaker: 'you', text: 'To the next island, then.' },
  { speaker: 'gull', text: 'To the next kettle, preferably.', mood: 'pleased' },
  { speaker: 'gull', text: 'Also, sailor?' },
  { speaker: 'you', text: 'Yeah?' },
  { speaker: 'gull', text: 'Good work. Do not make it weird.', mood: 'proud' },
];

/** open-water chatter while sailing, rotated as toasts (worried, hiding it poorly) */
export const CROSSING_TOASTS: string[] = [
  'Wind is fine. Waves are fine. My feathers are making their own choices.',
  'Do not splash like a snack.',
  'That fin is only passing through. We are also passing through. Everyone is busy.',
  'If the boat creaks, ignore it. If I creak, listen.',
  'The sea is bigger out here. Rude of it.',
  'Keep her nose steady. Boats like confidence, even fake confidence.',
  'I am not worried. I am conducting an advanced horizon inspection.',
  'That wave was showing off. Very immature.',
  'See the gap in the mist? Aim there before it changes its mind.',
  'If anything bumps the hull, we remain dignified. Loudly, if needed.',
  'Do not look down too long. The water enjoys an audience.',
  'Almost there. I knew that. Obviously.',
];

/** first fin near the boat: a proper (worried) word from the Admiral */
export const SHARK_SIGHTING: DialogueLine[] = [
  { speaker: 'gull', text: 'Fin off port. Calmly. Do not splash like a snack.', mood: 'worried' },
  { speaker: 'gull', text: 'That one is curious, not rude. Maintain snacklessness.', mood: 'worried' },
  { speaker: 'gull', text: 'No panic. Panic has terrible buoyancy.', mood: 'smug' },
];

/** later sightings rotate as toasts — cozy fin energy, not horror */
export const SHARK_TOASTS: string[] = [
  'Wave to it with your eyes. Keep your hands in the boat.',
  'Big fish, small manners. We proceed.',
  'It has places to be. So do we. Wonderful arrangement.',
  'The fin is just checking our paperwork.',
  'It circles because circles are easy. We sail because we are ambitious.',
];

/** plays once, first footfall on island 2 */
export const FIRST_LANDING: DialogueLine[] = [
  { speaker: 'you', text: 'Different trees.' },
  { speaker: 'gull', text: 'Taller. Mistier. Clearly trying to impress me.', mood: 'smug' },
  { speaker: 'you', text: 'It worked?' },
  { speaker: 'gull', text: 'I said trying.', mood: 'annoyed' },
  { speaker: 'you', text: 'The air smells colder here.' },
  { speaker: 'gull', text: 'Good. Maybe it will cool your decision-making.', mood: 'smug' },
  { speaker: 'you', text: 'We made it.' },
  { speaker: 'gull', text: 'The fleet made it.', mood: 'proud' },
  { speaker: 'you', text: 'Fleet of two?' },
  { speaker: 'gull', text: 'Fleet of one admiral, one sailor, and one boat with potential.', mood: 'proud' },
  { speaker: 'you', text: 'What now?' },
  { speaker: 'gull', text: 'We listen first. New islands hate being rushed.' },
  { speaker: 'gull', text: 'Then we find something warm to brew.', mood: 'pleased' },
  { speaker: 'you', text: 'Priorities.' },
  { speaker: 'gull', text: 'Survival is mostly priorities with better hats.', mood: 'smug' },
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
  // writing pack 2 (2026-07-05)
  'The wreck still points inland at low tide. Either it remembers something, or the beach has opinions.',
  'If you find my shovel, please apologize to it. I asked too much of a tool with one job.',
  'Sand gets everywhere. This is not advice, just a warning from someone who once owned socks.',
  'The gull says he is an admiral. Admirals usually have boats. Draw your own conclusions.',
  'Good soil is just dirt that learned manners. Bad soil is still useful if you are patient.',
  'I saw a green strand in the garden bed and thought it was a weed. It may have been supervising.',
  'A lean-to is not a home, but it is a convincing argument against rain.',
  'The beach gives you parts. The camp gives them purpose. The gull gives them notes.',
  'If a recipe smells impossible, brew it later. If it smells rude, brew it now.',
  'The tide left prints around my camp this morning. Tiny feet, large confidence.',
];

/** two-line teases shown on mystery (????) recipe rows; picked per recipe, stable */
export const MYSTERY_TEASES: string[] = [
  'Something brisk hides in the dried leaves. The kettle smells like clean wind and bad posture.',
  'Warm petals, dry leaves, a little nerve. Smells like smoke and bad decisions.',
  'The cup fogs before the recipe makes sense. Biscuit pretends not to be watching.',
  'A bitter green thread pulls the brew together. It tastes like the shallows learned manners.',
  'Wood, stone, and a stubborn idea. Not tea, but the camp approves.',
  'A basin wants more than rainwater. The gull is already rehearsing complaints.',
  'Dry first, brew second, brag never. The leaves remember the order.',
  'The steam comes up amber and rude. It warms your hands before your judgment.',
  'Something simple is almost ready. The trick is letting the island finish it.',
  'The recipe refuses to name itself. It smells useful enough to forgive.',
];

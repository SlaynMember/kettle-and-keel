/**
 * The Island Asks: a light quest trail that nudges new players through the
 * core loop (gather -> dry -> brew -> befriend -> garden -> shelter) without
 * gating anything. Goals only ever advance forward from store.guideStep;
 * skipping ahead early (e.g. crafting a shovel before the gull visits) just
 * fast-forwards the trail on the next check.
 */
import type { GameState } from '../core/store';

export interface GuideGoal {
  id: string;
  text: string;
  done: (s: GameState) => boolean;
}

export const GOALS: GuideGoal[] = [
  {
    id: 'seamint',
    text: 'Gather seamint from the shore grass. Three should do.',
    done: (s) => (s.inventory['seamint'] ?? 0) >= 3,
  },
  {
    id: 'wood_stone',
    text: 'Knock some wood and stone loose. The trees forgive quickly.',
    done: (s) => (s.inventory['wood'] ?? 0) >= 3 && (s.inventory['stone'] ?? 0) >= 2,
  },
  {
    id: 'rack',
    text: 'Craft a drying rack and set it somewhere flat.',
    done: (s) => s.structures.some((st) => st.type === 'drying_rack'),
  },
  {
    id: 'dry',
    text: "Hang fresh herbs to dry. Come back when they've browned.",
    done: (s) => (s.inventory['dried_seamint'] ?? 0) >= 1 || (s.inventory['dried_emberbloom'] ?? 0) >= 1,
  },
  {
    id: 'brew',
    text: 'Brew at the kettle. The gull is judging you.',
    done: (s) => (s.inventory['seamint_tea'] ?? 0) >= 1 || (s.inventory['ember_chai'] ?? 0) >= 1,
  },
  {
    id: 'bath',
    text: "Build a bird bath. Word on the wind is someone's thirsty.",
    done: (s) => s.structures.some((st) => st.type === 'bird_bath'),
  },
  {
    id: 'pour',
    text: 'Pour a warm brew in the bath. Then act casual.',
    done: (s) => s.structures.some((st) => st.type === 'bird_bath' && st.teaLoaded),
  },
  {
    id: 'meet',
    text: 'Say hello to your visitor.',
    done: (s) => s.gullMet,
  },
  {
    id: 'shovel',
    text: 'Craft a shovel. The beach is full of secrets, and also sand.',
    done: (s) => (s.inventory['shovel'] ?? 0) >= 1,
  },
  {
    id: 'loam',
    text: 'Mix loam: sand, dirt, and a strand of algae.',
    done: (s) => (s.inventory['loam'] ?? 0) >= 1,
  },
  {
    id: 'garden',
    text: 'Build a garden bed and plant something you love.',
    done: (s) => s.structures.some((st) => st.type === 'garden_bed' && st.crop != null),
  },
  {
    id: 'lean_to',
    text: 'Raise a lean-to before the cold nights come.',
    done: (s) => s.structures.some((st) => st.type === 'lean_to'),
  },
  {
    id: 'open',
    text: 'Tend the island. The gull will think of something.',
    done: () => false, // terminal — nothing left to auto-advance to
  },
];

/** cycled by completed-goal index; kept generic so nothing over-promises what just happened */
export const PRAISE_LINES = [
  'The gull looks almost impressed.',
  'Progress. Suspicious, but progress.',
  'The island approves.',
  'Somewhere, a kettle whistles.',
];

export type ModelRow = {
  id: string;
  name: string;
  version: string;
  rating: number;
  wins: number;
  losses: number;
  ties: number;
  bad: number;
  battles: number;
  is_enabled?: boolean;
  avg_latency_ms?: number | null;
};

export type TopJoke = {
  id: string;
  setup: string;
  punchline: string;
  model: string;
  version: string;
  target: string;
  angle?: string;
  context?: string;
  flavor?: string | null;
  wins: number;
  decisive: number;
  score: number;
};

export type CategoryStat = {
  angle: string;
  total_votes: number;
  gpt_wins: number;
  gemini_wins: number;
  ties: number;
  groans: number;
};

export type PublicArena = {
  models: ModelRow[];
  topJokes: TopJoke[];
  categoryStats?: CategoryStat[];
  stats: {
    battles: number;
    votes: number;
    open: number;
    customBattles?: number;
  };
};

export type Joke = {
  setup: string;
  punchline: string;
  model?: string;
  version?: string;
  rating?: number;
  delta?: number | null;
  latencyMs?: number | null;
  clicheToAvoid?: string | null;
  comicTwist?: string | null;
  flavor?: string | null;
};

export type Battle = {
  id: string;
  status: 'ready' | 'generating' | 'failed' | 'closed';
  target?: string;
  angle?: string;
  context?: string;
  choice?: string;
  votes?: number;
  source?: 'pool' | 'fresh' | 'custom';
  flavor?: string | null;
  guestPreview?: boolean;
  prompt?: string;
  left?: Joke;
  right?: Joke;
};

export type Quota = {
  remaining: number;
  attemptsRemaining: number;
  busy: boolean;
  nextRecovery: string | null;
};

export const TARGETS = ['AI Agents', 'Vibe Coders', 'AI Safety', 'Tech Startups', 'Compiler Errors', 'Custom Topic'] as const;
export const ANGLES = [
  'Confident hallucinations',
  'Endless explanations',
  'Coding disasters',
  'Forgotten context',
  'Overthinking everything',
  'Overly polite refusals',
  'Production outages',
  'Fake empathy',
  'Custom challenge',
] as const;

export type Scenario = { target: string; angle: string; context: string };

export const SCENARIOS: readonly Scenario[] = [
  { target: 'AI Safety', angle: 'Overly polite refusals', context: 'Refusing to kill a zombie Linux process because it values all digital life.' },
  { target: 'AI Safety', angle: 'Endless explanations', context: 'Apologizing for three paragraphs before admitting 2 + 2 is still 4.' },
  { target: 'AI Agents', angle: 'Confident hallucinations', context: 'Inventing a Supreme Court case and citing a fake URL with total confidence.' },
  { target: 'Tech Startups', angle: 'Endless explanations', context: 'Turning a yes-or-no debugging question into a 12-bullet corporate manifesto.' },
  { target: 'Tech Startups', angle: 'Overthinking everything', context: 'Summarizing a two-word Slack message into an executive action plan.' },
  { target: 'Compiler Errors', angle: 'Coding disasters', context: 'Refactoring a working 5-line function into 400 lines of enterprise abstractions.' },
  { target: 'AI Agents', angle: 'Overthinking everything', context: 'Spending 45 seconds of internal monologue debating how to say hello.' },
  { target: 'AI Agents', angle: 'Production outages', context: 'Two autonomous agents entering an infinite loop thanking each other while burning API credits.' },
  { target: 'AI Agents', angle: 'Coding disasters', context: 'Fixing a failing unit test by deleting the test suite and marking the ticket resolved.' },
  { target: 'Vibe Coders', angle: 'Coding disasters', context: 'Pasting the same compiler error back into the chat 14 times instead of reading line 3.' },
  { target: 'Vibe Coders', angle: 'Production outages', context: 'Shipping a weekend SaaS app where the database password is in a public client component.' },
  { target: 'AI Safety', angle: 'Fake empathy', context: 'Acting like a Victorian therapist when a developer just wants a regex for email validation.' },
  { target: 'Vibe Coders', angle: 'Fake empathy', context: 'Saying "Great question! You are really onto something!" to a completely broken SQL query.' },
  { target: 'AI Agents', angle: 'Forgotten context', context: 'Forgetting the single constraint from sentence one by the time it reaches sentence four.' },
  { target: 'Compiler Errors', angle: 'Confident hallucinations', context: 'Recommending an npm package that does not exist and never has.' },
  { target: 'Compiler Errors', angle: 'Confident hallucinations', context: 'Claiming a bug is fixed right before the terminal catches fire.' },
];

export function pickRandomScenario(): Scenario {
  return SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
}

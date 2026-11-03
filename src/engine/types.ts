export type Color = "w" | "b";

export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

export type Promotion = "q" | "r" | "b" | "n";

export type Move = {
  from: number;
  to: number;
  promotion?: Promotion;
};

export type Position = {
  board: number[];
  side: Color;
  castling: number;
  ep: number;
  halfmove: number;
  fullmove: number;
};

export type EndReason =
  | "checkmate"
  | "stalemate"
  | "fifty-move"
  | "threefold"
  | "insufficient";

export type GameResult = {
  result: "1-0" | "0-1" | "1/2-1/2";
  reason: EndReason;
};

export type Genome = {
  id: string;
  presetId: string;
  material: [number, number, number, number, number];
  pst: number[];
  terms: number[];
};

export type NetworkGenome = {
  kind: "network";
  id: string;
  presetId: "synapse";
  weights: number[];
};

export type AnyGenome = Genome | NetworkGenome;

export type Budget = {
  maxDepth: number;
  maxNodes: number;
  simulations: number;
};

export type Rng = {
  next: () => number;
  nextInt: (span: number) => number;
  state: () => number;
};

export type SearchHit = {
  move: Move;
  nodes: number;
  score: number;
  pv: string[];
  tieBreak: boolean;
};

export type Individual = {
  id: string;
  genome: AnyGenome;
  parents: [string, string] | null;
  generation: number;
};

export type GameRecord = {
  id: string;
  whiteId: string;
  blackId: string;
  moves: string[];
  result: "1-0" | "0-1" | "1/2-1/2";
  reason: EndReason | "ply-cap";
  plyCap: boolean;
};

export type ScoreRecord = {
  id: string;
  fitness: number;
  anchorPoints: number;
  peerPoints: number;
  famePoints: number | null;
};

export type GenerationRecord = {
  index: number;
  presetId: string;
  seed: number;
  budget: Budget;
  population: Individual[];
  games: GameRecord[];
  scores: ScoreRecord[];
  bestId: string;
  nodes: number;
  elapsedMs: number;
};

export type HallEntry = {
  individual: Individual;
  anchorPoints: number;
};

export type Run = {
  schema: 1 | 2;
  appVersion: string;
  id: string;
  seed: number;
  presetId: "darwin" | "synapse";
  rngState: number;
  population: Individual[];
  generations: GenerationRecord[];
  hallOfFame: HallEntry[];
  updatedAt: string;
};

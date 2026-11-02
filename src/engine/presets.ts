import type { Budget, Genome, Rng } from "./types";

export const PLAY_BUDGET: Budget = { maxDepth: 4, maxNodes: 50_000, simulations: 0 };
export const RAPID_BUDGET: Budget = { maxDepth: 2, maxNodes: 2_000, simulations: 0 };
export const STANDARD_BUDGET: Budget = { maxDepth: 3, maxNodes: 8_000, simulations: 0 };

const MATERIAL: Genome["material"] = [100, 320, 330, 500, 900];

function rowsFromRank8(rows: number[][]): number[] {
  const out = Array<number>(64).fill(0);
  for (let row = 0; row < 8; row += 1) {
    for (let file = 0; file < 8; file += 1) out[(7 - row) * 8 + file] = rows[row][file];
  }
  return out;
}

const PAWN_PST = rowsFromRank8([
  [0, 0, 0, 0, 0, 0, 0, 0],
  [30, 30, 30, 30, 30, 30, 30, 30],
  [8, 8, 16, 24, 24, 16, 8, 8],
  [4, 4, 8, 16, 16, 8, 4, 4],
  [0, 0, 4, 12, 12, 4, 0, 0],
  [0, 0, 2, 8, 8, 2, 0, 0],
  [0, 0, 0, -4, -4, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
]);

const KNIGHT_PST = rowsFromRank8([
  [-30, -20, -10, -10, -10, -10, -20, -30],
  [-20, -10, 0, 0, 0, 0, -10, -20],
  [-10, 0, 8, 10, 10, 8, 0, -10],
  [-10, 4, 12, 16, 16, 12, 4, -10],
  [-10, 4, 12, 16, 16, 12, 4, -10],
  [-10, 0, 8, 10, 10, 8, 0, -10],
  [-20, -10, 0, 0, 0, 0, -10, -20],
  [-30, -20, -10, -10, -10, -10, -20, -30],
]);

const BISHOP_PST = rowsFromRank8([
  [-10, -8, -6, -6, -6, -6, -8, -10],
  [-8, 0, 2, 2, 2, 2, 0, -8],
  [-6, 2, 6, 8, 8, 6, 2, -6],
  [-6, 4, 8, 10, 10, 8, 4, -6],
  [-6, 4, 8, 10, 10, 8, 4, -6],
  [-6, 2, 6, 8, 8, 6, 2, -6],
  [-8, 0, 2, 2, 2, 2, 0, -8],
  [-10, -8, -6, -6, -6, -6, -8, -10],
]);

const ROOK_PST = rowsFromRank8([
  [0, 0, 0, 4, 4, 0, 0, 0],
  [8, 8, 8, 8, 8, 8, 8, 8],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 2, 4, 4, 2, 0, 0],
]);

const QUEEN_PST = rowsFromRank8([
  [-8, -4, -2, 0, 0, -2, -4, -8],
  [-4, 0, 2, 2, 2, 2, 0, -4],
  [-2, 2, 4, 4, 4, 4, 2, -2],
  [0, 2, 4, 6, 6, 4, 2, 0],
  [0, 2, 4, 6, 6, 4, 2, 0],
  [-2, 2, 4, 4, 4, 4, 2, -2],
  [-4, 0, 2, 2, 2, 2, 0, -4],
  [-8, -4, -2, 0, 0, -2, -4, -8],
]);

const KING_PST = rowsFromRank8([
  [-20, -20, -20, -20, -20, -20, -20, -20],
  [-16, -16, -16, -16, -16, -16, -16, -16],
  [-12, -12, -12, -12, -12, -12, -12, -12],
  [-8, -8, -12, -16, -16, -12, -8, -8],
  [-4, -6, -8, -12, -12, -8, -6, -4],
  [0, 0, -2, -8, -8, -2, 0, 0],
  [6, 8, 4, -4, -4, 4, 8, 6],
  [8, 12, 16, -8, 0, -8, 16, 12],
]);

const POSITIONAL_PST = [...PAWN_PST, ...KNIGHT_PST, ...BISHOP_PST, ...ROOK_PST, ...QUEEN_PST, ...KING_PST];

export type CatalogEntry = {
  id: string;
  index: string;
  name: string;
  summary: string;
  search: string;
  genome: string;
  evolves: "yes" | "no";
  budget: string;
  playable: boolean;
  later?: string;
};

export const CATALOG: CatalogEntry[] = [
  {
    id: "classic",
    index: "01",
    name: "Classic",
    summary: "Material values only. Frozen anchor.",
    search: "negamax",
    genome: "material",
    evolves: "no",
    budget: "depth 4 · 50,000 nodes",
    playable: true,
  },
  {
    id: "positional",
    index: "02",
    name: "Positional",
    summary: "Material, piece-square tables, and a few structure terms.",
    search: "negamax",
    genome: "material + pst",
    evolves: "no",
    budget: "depth 4 · 50,000 nodes",
    playable: true,
  },
  {
    id: "darwin",
    index: "03",
    name: "Darwin",
    summary: "Crossover and mutation rewrite evaluation weights each generation.",
    search: "negamax",
    genome: "material + pst",
    evolves: "yes",
    budget: "depth 2 · 2,000 nodes",
    playable: false,
    later: "Phase 2",
  },
  {
    id: "horizon",
    index: "04",
    name: "Horizon",
    summary: "Iterative deepening and quiescence on the positional evaluation.",
    search: "negamax",
    genome: "material + pst",
    evolves: "no",
    budget: "depth 4 · 50,000 nodes",
    playable: false,
    later: "Phase 3",
  },
  {
    id: "surveyor",
    index: "05",
    name: "Surveyor",
    summary: "Monte Carlo tree search with uniform rollouts.",
    search: "mcts",
    genome: "none",
    evolves: "no",
    budget: "200 simulations",
    playable: false,
    later: "Phase 3",
  },
  {
    id: "synapse",
    index: "06",
    name: "Synapse",
    summary: "A small network replaces the evaluation.",
    search: "negamax",
    genome: "network",
    evolves: "yes",
    budget: "depth 3 · 8,000 nodes",
    playable: false,
    later: "Phase 4",
  },
];

export function isPlayablePreset(id: string): id is "classic" | "positional" {
  return id === "classic" || id === "positional";
}

export function createGenome(presetId: "classic" | "positional", _rng?: Rng): Genome {
  if (presetId === "classic") {
    return {
      id: "classic",
      presetId: "classic",
      material: [...MATERIAL],
      pst: Array<number>(384).fill(0),
      terms: [0, 0, 0],
    };
  }
  return {
    id: "positional",
    presetId: "positional",
    material: [...MATERIAL],
    pst: POSITIONAL_PST.slice(),
    terms: [30, 0, -20],
  };
}

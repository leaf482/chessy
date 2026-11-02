import type { Budget, Genome, HallEntry, Individual, Run } from "../engine/types";

export type WorkerRequest =
  | {
      kind: "search";
      jobId: string;
      fen: string;
      genome: Genome;
      budget: Budget;
      search: "negamax" | "horizon" | "mcts";
      seed: number;
    }
  | { kind: "generation"; jobId: string; run: Run; budget: Budget }
  | { kind: "resume"; jobId: string }
  | { kind: "cancel"; jobId: string };

export type SearchDone = {
  kind: "search-done";
  jobId: string;
  move: string;
  nodes: number;
  score: number;
  pv: string[];
  tieBreak: boolean;
};

export type GenerationDone = {
  kind: "generation-done";
  jobId: string;
  generation: Run["generations"][number];
  rngState: number;
  population: Individual[];
  hallOfFame: HallEntry[];
};

export type WorkerEvent =
  | SearchDone
  | { kind: "generation-progress"; jobId: string; gamesDone: number; gamesTotal: number }
  | { kind: "generation-paused"; jobId: string; gamesDone: number; gamesTotal: number }
  | GenerationDone
  | { kind: "error"; jobId: string; message: string };

import type { Budget, Genome } from "../engine/types";

export type WorkerRequest =
  | {
      kind: "search";
      jobId: string;
      fen: string;
      genome: Genome;
      budget: Budget;
      search: "negamax" | "mcts";
      seed: number;
    }
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

export type WorkerEvent = SearchDone | { kind: "error"; jobId: string; message: string };

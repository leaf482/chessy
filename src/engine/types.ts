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

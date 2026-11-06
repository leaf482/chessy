import { evaluateSide } from "./eval";
import { isNetworkGenome } from "./network";
import {
  PAWN,
  WHITE,
  applyMove,
  gameResult,
  inCheck,
  legalMoves,
  moveToUci,
  pieceColor,
  pieceType,
  positionKey,
} from "./rules";
import type { AnyGenome, Budget, Color, Genome, Move, Position, Rng, SearchHit } from "./types";

const MATE = 100_000;

type Line = { score: number; pv: string[] };

export function search(pos: Position, genome: AnyGenome, budget: Budget, rng: Rng): SearchHit {
  const nodes = { count: 0 };
  const rootMoves = orderMoves(pos, legalMoves(pos));
  if (rootMoves.length === 0) throw new Error("No legal moves");

  let best = -Infinity;
  const tied: Array<{ move: Move; pv: string[] }> = [];

  for (const move of rootMoves) {
    const child = negamax(applyMove(pos, move), budget.maxDepth - 1, -Infinity, Infinity, 1, genome, budget, nodes);
    const score = -child.score;
    if (score > best) {
      best = score;
      tied.length = 0;
      tied.push({ move, pv: [moveToUci(move), ...child.pv] });
    } else if (score === best) {
      tied.push({ move, pv: [moveToUci(move), ...child.pv] });
    }
  }

  const tieBreak = tied.length > 1;
  const chosen = tieBreak ? tied[rng.nextInt(tied.length)] : tied[0];
  const score = pos.side === "w" ? best : -best;
  return { move: chosen.move, nodes: nodes.count, score, pv: chosen.pv, tieBreak };
}

function negamax(
  pos: Position,
  depth: number,
  alphaIn: number,
  beta: number,
  ply: number,
  genome: AnyGenome,
  budget: Budget,
  nodes: { count: number },
): Line {
  nodes.count += 1;
  const moves = legalMoves(pos);
  if (moves.length === 0) {
    if (inCheck(pos, pos.side)) return { score: -(MATE - ply), pv: [] };
    return { score: 0, pv: [] };
  }
  if (depth <= 0 || (ply > 0 && nodes.count >= budget.maxNodes)) {
    return { score: evaluateSide(pos, genome), pv: [] };
  }

  let alpha = alphaIn;
  let best = -Infinity;
  let pv: string[] = [];
  for (const move of orderMoves(pos, moves)) {
    if (nodes.count >= budget.maxNodes) break;
    const child = negamax(applyMove(pos, move), depth - 1, -beta, -alpha, ply + 1, genome, budget, nodes);
    const score = -child.score;
    if (score > best) {
      best = score;
      pv = [moveToUci(move), ...child.pv];
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  if (best === -Infinity) return { score: evaluateSide(pos, genome), pv: [] };
  return { score: best, pv };
}

function orderMoves(pos: Position, moves: Move[]): Move[] {
  const captures: Move[] = [];
  const quiet: Move[] = [];
  for (const move of moves) {
    const pawnCapture =
      pieceType(pos.board[move.from]) === PAWN && pos.board[move.to] === 0 && (move.from & 7) !== (move.to & 7);
    if (pos.board[move.to] !== 0 || pawnCapture) captures.push(move);
    else quiet.push(move);
  }
  return captures.concat(quiet);
}

const Q_LIMIT = 6;
const ROLLOUT_PLIES = 80;
const UCT_C = Math.SQRT2;
const VALUE = [0, 100, 320, 330, 500, 900, 0];

type Tables = {
  killers: Array<[Move | null, Move | null]>;
  history: Int32Array;
  aborted: { current: boolean };
};

export function searchHorizon(pos: Position, genome: AnyGenome, budget: Budget, rng: Rng): SearchHit {
  const rootMoves = legalMoves(pos);
  if (rootMoves.length === 0) throw new Error("No legal moves");
  const nodes = { count: 0 };
  const tables: Tables = { killers: [], history: new Int32Array(64 * 64), aborted: { current: false } };
  let finished: { best: number; tied: Array<{ move: Move; pv: string[] }> } | null = null;

  for (let depth = 1; depth <= budget.maxDepth; depth += 1) {
    tables.aborted.current = false;
    const iteration = horizonRoot(pos, depth, genome, budget, nodes, tables);
    if (iteration.tied.length > 0 && !iteration.aborted) finished = iteration;
    else if (!finished && iteration.tied.length > 0) finished = iteration;
    if (iteration.aborted || nodes.count >= budget.maxNodes) break;
    if (Math.abs(iteration.best) > 90_000) break;
  }

  if (!finished || finished.tied.length === 0) throw new Error("No legal moves");
  const tieBreak = finished.tied.length > 1;
  const chosen = tieBreak ? finished.tied[rng.nextInt(finished.tied.length)] : finished.tied[0];
  const score = pos.side === "w" ? finished.best : -finished.best;
  return { move: chosen.move, nodes: nodes.count, score, pv: chosen.pv, tieBreak };
}

const POLICY_TEMPERATURE = 100;

type RolloutPick = (pos: Position, moves: Move[], rng: Rng) => Move;

export function searchSurveyor(pos: Position, _genome: AnyGenome, budget: Budget, rng: Rng): SearchHit {
  return searchMcts(pos, budget, rng, (cursor, moves, roll) => moves[roll.nextInt(moves.length)]);
}

export function searchPilot(pos: Position, genome: AnyGenome, budget: Budget, rng: Rng): SearchHit {
  return searchMcts(pos, budget, rng, (cursor, moves, roll) => samplePolicy(cursor, moves, genome, roll));
}

export function policyMove(pos: Position, genome: AnyGenome, rng: Rng): Move {
  const moves = legalMoves(pos);
  if (moves.length === 0) throw new Error("No legal moves");
  return samplePolicy(pos, moves, genome, rng);
}

function searchMcts(pos: Position, budget: Budget, rng: Rng, pick: RolloutPick): SearchHit {
  const root: McNode = { move: null, side: pos.side, children: null, visits: 0, white: 0 };
  const nodes = { count: 0 };
  const simulations = budget.simulations > 0 ? budget.simulations : 200;
  for (let index = 0; index < simulations; index += 1) {
    if (budget.maxNodes > 0 && nodes.count >= budget.maxNodes) break;
    simulate(root, pos, rng, nodes, pick);
  }
  const children = root.children ?? [];
  if (children.length === 0 || !children[0].move) throw new Error("No legal moves");
  let bestVisits = -1;
  const tied: McNode[] = [];
  for (const child of children) {
    if (child.visits > bestVisits) {
      bestVisits = child.visits;
      tied.length = 0;
      tied.push(child);
    } else if (child.visits === bestVisits) tied.push(child);
  }
  const tieBreak = tied.length > 1;
  const chosen = tieBreak ? tied[rng.nextInt(tied.length)] : tied[0];
  const rate = chosen.visits === 0 ? 0.5 : chosen.white / chosen.visits;
  return {
    move: chosen.move as Move,
    nodes: nodes.count,
    score: Math.round((rate - 0.5) * 200),
    pv: principalLine(chosen),
    tieBreak,
  };
}

function horizonRoot(
  pos: Position,
  depth: number,
  genome: AnyGenome,
  budget: Budget,
  nodes: { count: number },
  tables: Tables,
): { best: number; tied: Array<{ move: Move; pv: string[] }>; aborted: boolean } {
  let best = -Infinity;
  const tied: Array<{ move: Move; pv: string[] }> = [];
  for (const move of orderHorizon(pos, legalMoves(pos), 0, tables)) {
    if (nodes.count >= budget.maxNodes) {
      tables.aborted.current = true;
      break;
    }
    const child = horizonNegamax(applyMove(pos, move), depth - 1, -Infinity, Infinity, 1, genome, budget, nodes, tables);
    if (tables.aborted.current) break;
    const score = -child.score;
    if (score > best) {
      best = score;
      tied.length = 0;
      tied.push({ move, pv: [moveToUci(move), ...child.pv] });
    } else if (score === best) {
      tied.push({ move, pv: [moveToUci(move), ...child.pv] });
    }
  }
  return { best, tied, aborted: tables.aborted.current };
}

function horizonNegamax(
  pos: Position,
  depth: number,
  alphaIn: number,
  beta: number,
  ply: number,
  genome: AnyGenome,
  budget: Budget,
  nodes: { count: number },
  tables: Tables,
): Line {
  if (nodes.count >= budget.maxNodes) {
    tables.aborted.current = true;
    return { score: evaluateSide(pos, genome), pv: [] };
  }
  if (depth <= 0) return quiescence(pos, alphaIn, beta, ply, 0, genome, budget, nodes, tables);
  nodes.count += 1;
  const moves = legalMoves(pos);
  if (moves.length === 0) {
    if (inCheck(pos, pos.side)) return { score: -(MATE - ply), pv: [] };
    return { score: 0, pv: [] };
  }

  let alpha = alphaIn;
  let best = -Infinity;
  let pv: string[] = [];
  for (const move of orderHorizon(pos, moves, ply, tables)) {
    if (nodes.count >= budget.maxNodes) {
      tables.aborted.current = true;
      break;
    }
    const child = horizonNegamax(applyMove(pos, move), depth - 1, -beta, -alpha, ply + 1, genome, budget, nodes, tables);
    if (tables.aborted.current) break;
    const score = -child.score;
    if (score > best) {
      best = score;
      pv = [moveToUci(move), ...child.pv];
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) {
      if (!isCapture(pos, move)) rememberQuiet(tables, ply, move, depth * depth);
      break;
    }
  }
  if (best === -Infinity) return { score: evaluateSide(pos, genome), pv: [] };
  return { score: best, pv };
}

function quiescence(
  pos: Position,
  alphaIn: number,
  beta: number,
  ply: number,
  qply: number,
  genome: AnyGenome,
  budget: Budget,
  nodes: { count: number },
  tables: Tables,
): Line {
  if (nodes.count >= budget.maxNodes) {
    tables.aborted.current = true;
    return { score: evaluateSide(pos, genome), pv: [] };
  }
  nodes.count += 1;
  const moves = legalMoves(pos);
  if (moves.length === 0) {
    if (inCheck(pos, pos.side)) return { score: -(MATE - ply), pv: [] };
    return { score: 0, pv: [] };
  }
  if (qply >= Q_LIMIT) return { score: evaluateSide(pos, genome), pv: [] };

  const checking = inCheck(pos, pos.side);
  let alpha = alphaIn;
  let best = -Infinity;
  let pv: string[] = [];
  if (!checking) {
    const stand = evaluateSide(pos, genome);
    best = stand;
    if (stand >= beta) return { score: stand, pv: [] };
    if (stand > alpha) alpha = stand;
  }

  const tactical = checking ? moves : moves.filter((move) => isCapture(pos, move) || givesCheck(pos, move));
  for (const move of orderHorizon(pos, tactical, ply, tables)) {
    if (nodes.count >= budget.maxNodes) {
      tables.aborted.current = true;
      break;
    }
    const child = quiescence(applyMove(pos, move), -beta, -alpha, ply + 1, qply + 1, genome, budget, nodes, tables);
    if (tables.aborted.current) break;
    const score = -child.score;
    if (score > best) {
      best = score;
      pv = [moveToUci(move), ...child.pv];
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) {
      if (!isCapture(pos, move)) rememberQuiet(tables, ply, move, (Q_LIMIT - qply) * (Q_LIMIT - qply));
      break;
    }
  }
  if (best === -Infinity) return { score: evaluateSide(pos, genome), pv: [] };
  return { score: best, pv };
}

function orderHorizon(pos: Position, moves: Move[], ply: number, tables: Tables): Move[] {
  const slot = tables.killers[ply];
  return moves
    .map((move, index) => ({ move, index, rank: moveRank(pos, move, slot, tables.history) }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((entry) => entry.move);
}

function moveRank(pos: Position, move: Move, slot: [Move | null, Move | null] | undefined, history: Int32Array): number {
  if (isCapture(pos, move)) {
    const victim = pos.board[move.to] === 0 ? PAWN : pieceType(pos.board[move.to]);
    return 1_000_000 + VALUE[victim] * 10 - pieceType(pos.board[move.from]);
  }
  if (slot && sameMove(move, slot[0])) return 900_000;
  if (slot && sameMove(move, slot[1])) return 800_000;
  return history[move.from * 64 + move.to];
}

function rememberQuiet(tables: Tables, ply: number, move: Move, bonus: number): void {
  const slot = tables.killers[ply] ?? [null, null];
  if (!sameMove(move, slot[0])) {
    slot[1] = slot[0];
    slot[0] = move;
    tables.killers[ply] = slot;
  }
  tables.history[move.from * 64 + move.to] += bonus;
}

function sameMove(move: Move, other: Move | null | undefined): boolean {
  return !!other && move.from === other.from && move.to === other.to && move.promotion === other.promotion;
}

function isCapture(pos: Position, move: Move): boolean {
  if (pos.board[move.to] !== 0) return true;
  return pieceType(pos.board[move.from]) === PAWN && (move.from & 7) !== (move.to & 7);
}

function givesCheck(pos: Position, move: Move): boolean {
  const next = applyMove(pos, move);
  return inCheck(next, next.side);
}

type McNode = {
  move: Move | null;
  side: Color;
  children: McNode[] | null;
  visits: number;
  white: number;
};

function simulate(node: McNode, pos: Position, rng: Rng, nodes: { count: number }, pick: RolloutPick): void {
  const path: McNode[] = [node];
  let cursor = pos;
  let current = node;
  while (current.children && current.children.length > 0 && current.children.every((child) => child.visits > 0)) {
    current = selectUct(current);
    cursor = applyMove(cursor, current.move as Move);
    path.push(current);
    nodes.count += 1;
  }
  if (!current.children) {
    const moves = legalMoves(cursor);
    const end = gameResult(cursor, [positionKey(cursor)]);
    if (moves.length === 0 || end) {
      current.children = [];
      backup(path, end ? whitePoints(end.result) : 0.5);
      return;
    }
    const nextSide: Color = cursor.side === "w" ? "b" : "w";
    current.children = moves.map((move) => ({ move, side: nextSide, children: null, visits: 0, white: 0 }));
  }
  const unvisited = current.children.filter((child) => child.visits === 0);
  if (unvisited.length === 0) {
    const end = gameResult(cursor, [positionKey(cursor)]);
    backup(path, end ? whitePoints(end.result) : 0.5);
    return;
  }
  const child = unvisited[0];
  cursor = applyMove(cursor, child.move as Move);
  path.push(child);
  nodes.count += 1;
  backup(path, rollout(cursor, rng, nodes, pick));
}

function selectUct(node: McNode): McNode {
  const explore = Math.log(node.visits);
  let best = node.children?.[0] as McNode;
  let bestScore = -Infinity;
  for (const child of node.children ?? []) {
    const rate = child.white / child.visits;
    const exploit = node.side === "w" ? rate : 1 - rate;
    const uct = exploit + UCT_C * Math.sqrt(explore / child.visits);
    if (uct > bestScore) {
      bestScore = uct;
      best = child;
    }
  }
  return best;
}

function rollout(pos: Position, rng: Rng, nodes: { count: number }, pick: RolloutPick): number {
  let cursor = pos;
  const history = [positionKey(cursor)];
  for (let ply = 0; ply < ROLLOUT_PLIES; ply += 1) {
    const end = gameResult(cursor, history);
    if (end) return whitePoints(end.result);
    const moves = legalMoves(cursor);
    cursor = applyMove(cursor, pick(cursor, moves, rng));
    history.push(positionKey(cursor));
    nodes.count += 1;
  }
  return materialRate(cursor);
}

function samplePolicy(pos: Position, moves: Move[], genome: AnyGenome, rng: Rng): Move {
  if (isNetworkGenome(genome)) return moves[rng.nextInt(moves.length)];
  if (moves.length === 1) {
    rng.next();
    return moves[0];
  }
  let max = -Infinity;
  const priors = moves.map((move) => {
    const prior = movePrior(pos, move, genome);
    if (prior > max) max = prior;
    return prior;
  });
  const weights = priors.map((prior) => Math.exp((prior - max) / POLICY_TEMPERATURE));
  let total = 0;
  for (const weight of weights) total += weight;
  let draw = rng.next() * total;
  for (let index = 0; index < moves.length; index += 1) {
    draw -= weights[index];
    if (draw <= 0) return moves[index];
  }
  return moves[moves.length - 1];
}

function movePrior(pos: Position, move: Move, genome: Genome): number {
  const piece = pos.board[move.from];
  const type = pieceType(piece);
  const color = pieceColor(piece);
  const from = color === WHITE ? move.from : ((7 - (move.from >> 3)) << 3) | (move.from & 7);
  const to = color === WHITE ? move.to : ((7 - (move.to >> 3)) << 3) | (move.to & 7);
  let score = (genome.pst[(type - 1) * 64 + to] ?? 0) - (genome.pst[(type - 1) * 64 + from] ?? 0);
  if (isCapture(pos, move)) {
    const victim = pos.board[move.to] === 0 ? PAWN : pieceType(pos.board[move.to]);
    score += genome.material[victim - 1] ?? 0;
  }
  return score;
}

function materialRate(pos: Position): number {
  let score = 0;
  for (const piece of pos.board) {
    if (!piece) continue;
    const sign = pieceColor(piece) === WHITE ? 1 : -1;
    score += sign * VALUE[pieceType(piece)];
  }
  const clamped = Math.max(-800, Math.min(800, score));
  return 0.5 + clamped / 2000;
}

function backup(path: McNode[], white: number): void {
  for (const node of path) {
    node.visits += 1;
    node.white += white;
  }
}

function whitePoints(result: "1-0" | "0-1" | "1/2-1/2"): number {
  if (result === "1-0") return 1;
  if (result === "0-1") return 0;
  return 0.5;
}

function principalLine(node: McNode): string[] {
  const line: string[] = [];
  let current: McNode | undefined = node;
  while (current?.move && line.length < 8) {
    line.push(moveToUci(current.move));
    let next: McNode | undefined;
    let visits = -1;
    for (const child of current.children ?? []) {
      if (child.visits > visits) {
        visits = child.visits;
        next = child;
      }
    }
    current = visits > 0 ? next : undefined;
  }
  return line;
}

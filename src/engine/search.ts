import { evaluateSide } from "./eval";
import { PAWN, applyMove, inCheck, legalMoves, moveToUci, pieceType } from "./rules";
import type { Budget, Genome, Move, Position, Rng, SearchHit } from "./types";

const MATE = 100_000;

type Line = { score: number; pv: string[] };

export function search(pos: Position, genome: Genome, budget: Budget, rng: Rng): SearchHit {
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
  genome: Genome,
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

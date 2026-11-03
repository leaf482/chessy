import { networkValue, isNetworkGenome } from "./network";
import { BISHOP, KING, PAWN, WHITE, pieceColor, pieceType } from "./rules";
import type { AnyGenome, Genome, Position } from "./types";

function flipRank(square: number): number {
  return ((7 - (square >> 3)) << 3) | (square & 7);
}

export function evaluateWhite(pos: Position, genome: AnyGenome): number {
  if (isNetworkGenome(genome)) return networkValue(pos, genome.weights);
  let score = 0;
  const counts = [0, 0, 0, 0, 0];
  let whiteBishops = 0;
  let blackBishops = 0;
  const whitePawns = [0, 0, 0, 0, 0, 0, 0, 0];
  const blackPawns = [0, 0, 0, 0, 0, 0, 0, 0];

  for (let square = 0; square < 64; square += 1) {
    const piece = pos.board[square];
    if (!piece) continue;
    const type = pieceType(piece);
    const color = pieceColor(piece);
    const tableSquare = color === WHITE ? square : flipRank(square);
    const pst = genome.pst[(type - 1) * 64 + tableSquare] ?? 0;
    score += color === WHITE ? pst : -pst;
    if (type === KING) continue;
    counts[type - 1] += color === WHITE ? 1 : -1;
    if (type === BISHOP) {
      if (color === WHITE) whiteBishops += 1;
      else blackBishops += 1;
    }
    if (type === PAWN) {
      const file = square & 7;
      if (color === WHITE) whitePawns[file] += 1;
      else blackPawns[file] += 1;
    }
  }

  for (let index = 0; index < 5; index += 1) score += genome.material[index] * counts[index];

  const doubled = (files: number[]) => files.reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  const features = [
    (whiteBishops >= 2 ? 1 : 0) - (blackBishops >= 2 ? 1 : 0),
    0,
    doubled(whitePawns) - doubled(blackPawns),
  ];
  for (let index = 0; index < features.length; index += 1) {
    score += (genome.terms[index] ?? 0) * features[index];
  }
  return score;
}

export function evaluateSide(pos: Position, genome: AnyGenome): number {
  const white = evaluateWhite(pos, genome);
  return pos.side === "w" ? white : -white;
}

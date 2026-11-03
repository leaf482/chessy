import { mulberry32 } from "./rng";
import { pieceColor, pieceType } from "./rules";
import type { AnyGenome, NetworkGenome, Position, Rng } from "./types";

export const NETWORK_INPUTS = 769;
export const NETWORK_HIDDEN = 32;
const W1 = NETWORK_INPUTS * NETWORK_HIDDEN;
const B1 = NETWORK_HIDDEN;
const W2 = NETWORK_HIDDEN;
export const NETWORK_LENGTH = W1 + B1 + W2 + 1;

const W1_SCALE = Math.sqrt(6 / (NETWORK_INPUTS + NETWORK_HIDDEN));
const W2_SCALE = Math.sqrt(6 / (NETWORK_HIDDEN + 1));

export function isNetworkGenome(genome: AnyGenome): genome is NetworkGenome {
  return "kind" in genome && genome.kind === "network";
}

export function createNetworkGenome(seed: number, id = "synapse"): NetworkGenome {
  return { kind: "network", id, presetId: "synapse", weights: glorot(mulberry32(seed)) };
}

export function glorot(rng: Rng): number[] {
  const weights = Array<number>(NETWORK_LENGTH).fill(0);
  for (let index = 0; index < W1; index += 1) weights[index] = (rng.next() * 2 - 1) * W1_SCALE;
  for (let index = 0; index < W2; index += 1) weights[W1 + B1 + index] = (rng.next() * 2 - 1) * W2_SCALE;
  return weights;
}

export function networkValue(pos: Position, weights: number[]): number {
  const hidden = new Float64Array(NETWORK_HIDDEN);
  const side = pos.side === "w" ? 1 : -1;
  for (let unit = 0; unit < NETWORK_HIDDEN; unit += 1) {
    let sum = weights[W1 + unit];
    const row = unit * NETWORK_INPUTS;
    for (let square = 0; square < 64; square += 1) {
      const piece = pos.board[square];
      if (!piece) continue;
      const plane = pieceColor(piece) * 6 + (pieceType(piece) - 1);
      sum += weights[row + plane * 64 + square];
    }
    sum += side * weights[row + 768];
    hidden[unit] = Math.tanh(sum);
  }
  let out = weights[NETWORK_LENGTH - 1];
  const output = W1 + B1;
  for (let unit = 0; unit < NETWORK_HIDDEN; unit += 1) out += hidden[unit] * weights[output + unit];
  return out;
}

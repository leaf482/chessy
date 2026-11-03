import { describe, expect, it } from "vitest";
import { evaluateSide, evaluateWhite } from "./eval";
import { NETWORK_HIDDEN, NETWORK_INPUTS, NETWORK_LENGTH, createNetworkGenome, networkValue } from "./network";
import { mulberry32 } from "./rng";
import { parseFen, startPosition } from "./rules";
import { search } from "./search";

describe("synapse network", () => {
  it("uses the documented shape and the same seed twice", () => {
    expect(NETWORK_INPUTS).toBe(12 * 64 + 1);
    expect(NETWORK_HIDDEN).toBe(32);
    expect(NETWORK_LENGTH).toBe(769 * 32 + 32 + 32 + 1);
    const first = createNetworkGenome(7);
    const second = createNetworkGenome(7);
    expect(first.weights).toEqual(second.weights);
    expect(first.weights[769 * 32]).toBe(0);
  });

  it("matches a dense forward pass and stays white's score", () => {
    const genome = createNetworkGenome(3, "gene");
    const pos = parseFen("4k3/8/8/8/8/8/8/4K2Q w - - 0 1");
    expect(networkValue(pos, genome.weights)).toBeCloseTo(dense(pos.board, pos.side, genome.weights), 9);
    const white = evaluateWhite(pos, genome);
    const black = evaluateSide({ ...pos, side: "b" }, genome);
    expect(white).toBeCloseTo(networkValue(pos, genome.weights), 9);
    expect(black).toBeCloseTo(-networkValue({ ...pos, side: "b" }, genome.weights), 9);
  });

  it("searches a move inside the play budget", () => {
    const genome = createNetworkGenome(1);
    const started = Date.now();
    const hit = search(startPosition(), genome, { maxDepth: 2, maxNodes: 2_000, simulations: 0 }, mulberry32(1));
    expect(hit.pv.length).toBeGreaterThan(0);
    expect(Date.now() - started).toBeLessThan(3_000);
  });
});

function dense(board: number[], side: "w" | "b", weights: number[]): number {
  const input = Array<number>(NETWORK_INPUTS).fill(0);
  for (let square = 0; square < 64; square += 1) {
    const piece = board[square];
    if (!piece) continue;
    const color = piece >> 3;
    const type = piece & 7;
    input[(color * 6 + (type - 1)) * 64 + square] = 1;
  }
  input[768] = side === "w" ? 1 : -1;
  const hidden = Array<number>(NETWORK_HIDDEN).fill(0);
  const w1 = 769 * 32;
  for (let unit = 0; unit < NETWORK_HIDDEN; unit += 1) {
    let sum = weights[w1 + unit];
    for (let index = 0; index < NETWORK_INPUTS; index += 1) sum += input[index] * weights[unit * NETWORK_INPUTS + index];
    hidden[unit] = Math.tanh(sum);
  }
  let out = weights[NETWORK_LENGTH - 1];
  for (let unit = 0; unit < NETWORK_HIDDEN; unit += 1) out += hidden[unit] * weights[w1 + NETWORK_HIDDEN + unit];
  return out;
}

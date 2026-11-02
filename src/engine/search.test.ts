import { describe, expect, it } from "vitest";
import { evaluateWhite } from "./eval";
import { createGenome } from "./presets";
import { mulberry32 } from "./rng";
import { parseFen } from "./rules";
import { search } from "./search";

describe("eval and search", () => {
  it("scores material from white's point of view", () => {
    const classic = createGenome("classic");
    const up = evaluateWhite(parseFen("4k3/8/8/8/8/8/8/4K2Q w - - 0 1"), classic);
    const down = evaluateWhite(parseFen("4k2q/8/8/8/8/8/8/4K3 w - - 0 1"), classic);
    expect(up).toBe(900);
    expect(down).toBe(-900);
    expect(evaluateWhite(parseFen("4k3/8/8/8/8/8/8/4K2Q w - - 0 1"), classic)).toBe(up);
  });

  it("rates a central knight above a corner knight", () => {
    const positional = createGenome("positional");
    const center = evaluateWhite(parseFen("4k3/8/8/8/3N4/8/8/4K3 w - - 0 1"), positional);
    const corner = evaluateWhite(parseFen("4k3/8/8/8/8/8/8/N3K3 w - - 0 1"), positional);
    expect(center).toBeGreaterThan(corner);
    expect(positional.pst).toHaveLength(384);
    expect(createGenome("classic").pst).toHaveLength(384);
  });

  it("takes a free queen and plays mate in one", () => {
    const classic = createGenome("classic");
    const budget = { maxDepth: 1, maxNodes: 5_000, simulations: 0 };
    const capture = search(parseFen("8/8/8/3q4/4P3/8/8/4K2k w - - 0 1"), classic, budget, mulberry32(1));
    expect(capture.move.from).toBe(28);
    expect(capture.move.to).toBe(35);

    const mate = search(parseFen("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1"), classic, budget, mulberry32(1));
    expect(mate.score).toBeGreaterThan(90_000);
  });

  it("returns the same move for the same position and seed", () => {
    const classic = createGenome("classic");
    const budget = { maxDepth: 3, maxNodes: 20_000, simulations: 0 };
    const fen = parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    const first = search(fen, classic, budget, mulberry32(7));
    const second = search(fen, classic, budget, mulberry32(7));
    expect(first.pv[0]).toBe(second.pv[0]);
    expect(first.score).toBe(second.score);
  });
});

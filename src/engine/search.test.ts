import { describe, expect, it } from "vitest";
import { evaluateWhite } from "./eval";
import { createGenome } from "./presets";
import { mulberry32 } from "./rng";
import { parseFen } from "./rules";
import { policyMove, search, searchHorizon, searchPilot, searchSurveyor } from "./search";

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

  it("keeps horizon off a capture that hangs the queen", () => {
    const classic = createGenome("classic");
    const budget = { maxDepth: 1, maxNodes: 5_000, simulations: 0 };
    const hanging = parseFen("4k3/1r6/8/8/8/1p6/Q7/4K3 w - - 0 1");
    const plain = search(hanging, classic, budget, mulberry32(1));
    const horizon = searchHorizon(hanging, classic, budget, mulberry32(1));
    expect(plain.move.to).toBe(17);
    expect(horizon.pv[0]).not.toBe("a2b3");
  });

  it("plays the same horizon move from the same seed", () => {
    const positional = createGenome("positional");
    const budget = { maxDepth: 3, maxNodes: 8_000, simulations: 0 };
    const fen = parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    const first = searchHorizon(fen, positional, budget, mulberry32(7));
    const second = searchHorizon(fen, positional, budget, mulberry32(7));
    expect(first.pv[0]).toBe(second.pv[0]);
    expect(first.score).toBe(second.score);
    expect(first.nodes).toBe(second.nodes);
  });

  it("takes a free queen with uniform rollouts", () => {
    const surveyor = createGenome("surveyor");
    const budget = { maxDepth: 0, maxNodes: 20_000, simulations: 30 };
    const fen = parseFen("8/8/8/3q4/4P3/8/8/4K2k w - - 0 1");
    const capture = searchSurveyor(fen, surveyor, budget, mulberry32(3));
    expect(capture.move.from).toBe(28);
    expect(capture.move.to).toBe(35);
    const again = searchSurveyor(fen, surveyor, budget, mulberry32(3));
    expect(again.pv[0]).toBe(capture.pv[0]);
    expect(again.nodes).toBe(capture.nodes);
  });

  it("samples a capture more often when the queen's material is the prior", () => {
    const pilot = createGenome("positional");
    pilot.pst.fill(0);
    const fen = parseFen("8/8/8/3q4/4P3/8/8/4K2k w - - 0 1");
    let captures = 0;
    for (let seed = 0; seed < 40; seed += 1) {
      const move = policyMove(fen, pilot, mulberry32(seed));
      if (move.from === 28 && move.to === 35) captures += 1;
    }
    expect(captures).toBeGreaterThan(30);
  });

  it("finishes a pilot search inside a few seconds", () => {
    const pilot = createGenome("positional");
    const started = Date.now();
    const hit = searchPilot(startFen(), pilot, { maxDepth: 0, maxNodes: 50_000, simulations: 80 }, mulberry32(1));
    expect(hit.pv.length).toBeGreaterThan(0);
    expect(Date.now() - started).toBeLessThan(3_000);
  });
});

function startFen() {
  return parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
}

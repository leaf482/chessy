import { describe, expect, it } from "vitest";
import { createDarwinRun, finishGeneration, playNextGame, scheduledGameCount, startGeneration } from "./evolve";
import { evaluateWhite } from "./eval";
import { parseFen } from "./rules";

const tiny = { maxDepth: 1, maxNodes: 40, simulations: 0 };

function oneGeneration(seed: number, maxPlies: number) {
  const run = createDarwinRun(seed, "0.1.0", "2026-01-01T00:00:00.000Z");
  const job = startGeneration(run, tiny, { maxPlies, now: 0 });
  while (playNextGame(job)) {
    // Play the scheduled games.
  }
  return { run, result: finishGeneration(job, maxPlies * 10) };
}

describe("darwin", () => {
  it("schedules 48 games before the hall of fame exists and 72 after", () => {
    expect(scheduledGameCount(0)).toBe(48);
    expect(scheduledGameCount(1)).toBe(72);
  });

  it("reproduces generation 1 and copies two elites unchanged", () => {
    const first = oneGeneration(1042, 2);
    const second = oneGeneration(1042, 2);
    expect(first.result.generation.games.map((game) => game.moves)).toEqual(
      second.result.generation.games.map((game) => game.moves),
    );
    expect(first.result.population.map((individual) => individual.genome.pst)).toEqual(
      second.result.population.map((individual) => individual.genome.pst),
    );
    expect(first.result.generation.games).toHaveLength(48);
    const elites = first.result.population.filter((individual) => individual.parents?.[0] === individual.parents?.[1]);
    expect(elites).toHaveLength(2);
    for (const elite of elites) {
      const parent = first.result.generation.population.find((individual) => individual.id === elite.parents?.[0]);
      expect(parent).toBeTruthy();
      expect(elite.genome.pst).toEqual(parent?.genome.pst);
      expect(elite.genome.material).toEqual(parent?.genome.material);
      expect(elite.genome.id).toBe(parent?.genome.id);
    }
    expect(first.result.hallOfFame).toHaveLength(1);
  });

  it("caps a game that reaches the ply limit", () => {
    const { result } = oneGeneration(7, 1);
    expect(result.generation.games.every((game) => game.plyCap && game.reason === "ply-cap")).toBe(true);
  });

  it("scores a higher central pawn weight as better for white", () => {
    const run = createDarwinRun(3, "0.1.0", "2026-01-01T00:00:00.000Z");
    const raised = structuredClone(run.population[0].genome);
    raised.pst[27] += 20;
    const fen = parseFen("4k3/8/8/8/3P4/8/8/4K3 w - - 0 1");
    expect(evaluateWhite(fen, raised)).toBeGreaterThan(evaluateWhite(fen, run.population[0].genome));
  });
});

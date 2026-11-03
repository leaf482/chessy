import { describe, expect, it } from "vitest";
import { createDarwinRun, createSynapseRun, finishGeneration, playNextGame, scheduledGameCount, startGeneration } from "./evolve";
import { isNetworkGenome } from "./network";
import type { AnyGenome } from "./types";
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
    expect(first.result.population.map((individual) => weightsOf(individual.genome))).toEqual(
      second.result.population.map((individual) => weightsOf(individual.genome)),
    );
    expect(first.result.generation.games).toHaveLength(48);
    const elites = first.result.population.filter((individual) => individual.parents?.[0] === individual.parents?.[1]);
    expect(elites).toHaveLength(2);
    for (const elite of elites) {
      const parent = first.result.generation.population.find((individual) => individual.id === elite.parents?.[0]);
      expect(parent).toBeTruthy();
      expect(weightsOf(elite.genome)).toEqual(parent ? weightsOf(parent.genome) : undefined);
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
    const genome = run.population[0].genome;
    if (isNetworkGenome(genome)) throw new Error("Expected a weight genome");
    const raised = structuredClone(genome);
    raised.pst[27] += 20;
    const fen = parseFen("4k3/8/8/8/3P4/8/8/4K3 w - - 0 1");
    expect(evaluateWhite(fen, raised)).toBeGreaterThan(evaluateWhite(fen, genome));
  });
});

describe("synapse", () => {
  it("reproduces a generation and copies two network elites", () => {
    const first = synapseGeneration(11);
    const second = synapseGeneration(11);
    expect(first.schema).toBe(2);
    expect(first.result.generation.games).toHaveLength(48);
    expect(first.result.population.map((individual) => weightsOf(individual.genome))).toEqual(
      second.result.population.map((individual) => weightsOf(individual.genome)),
    );
    const elites = first.result.population.filter((individual) => individual.parents?.[0] === individual.parents?.[1]);
    expect(elites).toHaveLength(2);
    for (const elite of elites) {
      expect(isNetworkGenome(elite.genome)).toBe(true);
      const parent = first.result.generation.population.find((individual) => individual.id === elite.parents?.[0]);
      expect(weightsOf(elite.genome)).toEqual(parent ? weightsOf(parent.genome) : undefined);
    }
  });
});

function synapseGeneration(seed: number) {
  const run = createSynapseRun(seed, "0.1.0", "2026-01-01T00:00:00.000Z");
  const job = startGeneration(run, tiny, { maxPlies: 1, now: 0 });
  while (playNextGame(job)) {
    // One ply per game keeps the operator check fast.
  }
  return { schema: run.schema, result: finishGeneration(job, 1) };
}

function weightsOf(genome: AnyGenome): unknown {
  return isNetworkGenome(genome) ? genome.weights : [genome.material, genome.pst];
}

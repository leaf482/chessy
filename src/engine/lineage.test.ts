import { describe, expect, it } from "vitest";
import { createDarwinRun, createSynapseRun, finishGeneration, playNextGame, startGeneration } from "./evolve";
import { ancestorChain } from "./lineage";
import type { Run } from "./types";

const tiny = { maxDepth: 1, maxNodes: 40, simulations: 0 };

describe("lineage", () => {
  it("follows the first parent to a founder and marks an elite as one parent", () => {
    const run = twoGenerations(createDarwinRun(1042, "0.1.0", "2026-01-01T00:00:00.000Z"));
    const elite = run.population.find((individual) => individual.parents?.[0] === individual.parents?.[1]);
    expect(elite?.parents).toBeTruthy();
    const chain = ancestorChain(run, elite!.id);
    expect(chain.map((step) => step.individual.id)).toEqual([elite!.id, elite!.parents![0], "ind-0-00"]);
    expect(chain[0].anchorPoints).toBeNull();
    expect(chain[1].anchorPoints).not.toBeNull();
    expect(chain[2].individual.parents).toBeNull();
    expect(chain[0].individual.genome.id).toBe(chain[2].individual.genome.id);

    const child = run.population.find((individual) => individual.parents !== null && individual.parents[0] !== individual.parents[1]);
    expect(child?.parents?.[0]).not.toBe(child?.parents?.[1]);
    const other = ancestorChain(run, child!.id);
    expect(other[1].individual.id).toBe(child!.parents![0]);
    expect(findParent(run, child!.parents![1])).toBeTruthy();
  });

  it("reads a synapse elite the same way", () => {
    const run = twoGenerations(createSynapseRun(11, "0.1.0", "2026-01-01T00:00:00.000Z"));
    const elite = run.population.find((individual) => individual.parents?.[0] === individual.parents?.[1]);
    const chain = ancestorChain(run, elite!.id);
    expect(chain.map((step) => step.individual.id)).toEqual([elite!.id, elite!.parents![0], "ind-0-00"]);
  });
});

function twoGenerations(start: Run): Run {
  let run = start;
  for (let index = 0; index < 2; index += 1) {
    const job = startGeneration(run, tiny, { maxPlies: 1, now: index });
    while (playNextGame(job)) {
      // One ply keeps the parent check fast.
    }
    const result = finishGeneration(job, index + 1);
    run = {
      ...run,
      rngState: result.rngState,
      population: result.population,
      hallOfFame: result.hallOfFame,
      generations: [...run.generations, result.generation],
    };
  }
  return run;
}

function findParent(run: Run, id: string) {
  return run.generations.flatMap((generation) => generation.population).find((individual) => individual.id === id);
}

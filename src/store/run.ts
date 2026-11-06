import { parseRun } from "../engine/evolve";
import { NETWORK_LENGTH, isNetworkGenome } from "../engine/network";
import type { GenerationDone } from "../worker/protocol";
import type { AnyGenome, Run } from "../engine/types";

const KEY = "chessy.run.v1";
const SYNAPSE_KEY = "chessy.synapse.v1";
const PILOT_KEY = "chessy.pilot.v1";
export const RUN_EVENT = "chessy-run";
export const RUN_STATUS_EVENT = "chessy-run-status";

export function loadRun(): Run | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return parseRun(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadSynapseRun(): Run | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SYNAPSE_KEY);
  if (!raw) return null;
  try {
    const run = parseRun(JSON.parse(raw));
    return run.presetId === "synapse" ? run : null;
  } catch {
    return null;
  }
}

export function loadPilotRun(): Run | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PILOT_KEY);
  if (!raw) return null;
  try {
    const run = parseRun(JSON.parse(raw));
    return run.presetId === "pilot" ? run : null;
  } catch {
    return null;
  }
}

export function loadRunForPreset(preset: string): Run | null {
  if (preset === "synapse") return loadSynapseRun();
  if (preset === "pilot") return loadPilotRun();
  return loadRun();
}

export function saveRun(run: Run | null, slot?: "darwin" | "synapse" | "pilot"): void {
  const which = slot ?? (run?.presetId === "synapse" ? "synapse" : run?.presetId === "pilot" ? "pilot" : "darwin");
  const key = which === "synapse" ? SYNAPSE_KEY : which === "pilot" ? PILOT_KEY : KEY;
  if (run) {
    try {
      localStorage.setItem(key, JSON.stringify(run));
    } catch {
      // A full Synapse population is large. Keep the in-memory run if the browser refuses the write.
    }
  } else localStorage.removeItem(key);
  window.dispatchEvent(new Event(RUN_EVENT));
}

export function mergeGeneration(run: Run, result: GenerationDone): Run {
  const archived = run.presetId === "synapse" ? run.generations.map(thinNetworkGeneration) : run.generations;
  return {
    ...run,
    rngState: result.rngState,
    population: result.population,
    hallOfFame: result.hallOfFame,
    generations: [...archived, result.generation],
    updatedAt: new Date().toISOString(),
  };
}

export function publishStatus(running: boolean, generation: number): void {
  window.dispatchEvent(new CustomEvent(RUN_STATUS_EVENT, { detail: { running, generation } }));
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function thinNetworkGeneration(generation: Run["generations"][number]): Run["generations"][number] {
  return {
    ...generation,
    population: generation.population.map((individual) => {
      if (!isNetworkGenome(individual.genome) || individual.genome.weights.length === 0) return individual;
      return { ...individual, genome: { ...individual.genome, weights: [] } };
    }),
  };
}

export function parseOpponent(value: unknown): AnyGenome {
  if (!value || typeof value !== "object") throw new Error("Schema mismatch");
  if (isNetworkGenome(value as AnyGenome)) {
    const weights = (value as { weights?: unknown }).weights;
    if (!Array.isArray(weights) || weights.length !== NETWORK_LENGTH) throw new Error("Schema mismatch");
    return value as AnyGenome;
  }
  const genome = value as { material?: unknown; pst?: unknown };
  if (!Array.isArray(genome.material) || genome.material.length !== 5 || !Array.isArray(genome.pst) || genome.pst.length !== 384) {
    throw new Error("Schema mismatch");
  }
  return value as AnyGenome;
}

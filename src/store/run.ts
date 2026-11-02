import { parseRun } from "../engine/evolve";
import type { GenerationDone } from "../worker/protocol";
import type { Genome, Run } from "../engine/types";

const KEY = "chessy.run.v1";
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

export function saveRun(run: Run | null): void {
  if (run) localStorage.setItem(KEY, JSON.stringify(run));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(RUN_EVENT));
}

export function mergeGeneration(run: Run, result: GenerationDone): Run {
  return {
    ...run,
    rngState: result.rngState,
    population: result.population,
    hallOfFame: result.hallOfFame,
    generations: [...run.generations, result.generation],
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

export function parseOpponent(value: unknown): Genome {
  if (!value || typeof value !== "object") throw new Error("Schema mismatch");
  const genome = value as Genome;
  if (!Array.isArray(genome.material) || genome.material.length !== 5 || !Array.isArray(genome.pst) || genome.pst.length !== 384) {
    throw new Error("Schema mismatch");
  }
  return genome;
}

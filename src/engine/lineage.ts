import type { Individual, Run } from "./types";

export type LineageStep = {
  individual: Individual;
  anchorPoints: number | null;
};

export function findIndividual(run: Run, id: string): LineageStep | null {
  for (const generation of run.generations) {
    const individual = generation.population.find((entry) => entry.id === id);
    if (!individual) continue;
    const score = generation.scores.find((entry) => entry.id === id);
    return { individual, anchorPoints: score ? score.anchorPoints : null };
  }
  const waiting = run.population.find((entry) => entry.id === id);
  if (waiting) return { individual: waiting, anchorPoints: null };
  const hall = run.hallOfFame.find((entry) => entry.individual.id === id);
  if (hall) return { individual: hall.individual, anchorPoints: hall.anchorPoints };
  return null;
}

export function ancestorChain(run: Run, id: string): LineageStep[] {
  const chain: LineageStep[] = [];
  const seen = new Set<string>();
  let current: string | null = id;
  while (current && !seen.has(current)) {
    seen.add(current);
    const step = findIndividual(run, current);
    if (!step) break;
    chain.push(step);
    current = step.individual.parents?.[0] ?? null;
  }
  return chain;
}

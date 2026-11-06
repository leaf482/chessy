import { glorot, isNetworkGenome } from "./network";
import { createGenome } from "./presets";
import { mulberry32, mulberry32FromState } from "./rng";
import { applyMove, gameResult, moveToUci, positionKey, startPosition } from "./rules";
import { search, searchPilot } from "./search";
import type {
  Budget,
  GameRecord,
  AnyGenome,
  Genome,
  HallEntry,
  Individual,
  Rng,
  Run,
  ScoreRecord,
} from "./types";

const POPULATION = 12;
const DEFAULT_PLIES = 80;

type Seat = { id: string; genome: AnyGenome };
type Bucket = "anchor" | "peer" | "fame";
type Pairing = { white: Seat; black: Seat; bucket: Bucket };
type Acc = { anchor: number; anchorN: number; peer: number; peerN: number; fame: number; fameN: number };

export type GenerationJob = {
  run: Run;
  budget: Budget;
  maxPlies: number;
  rng: Rng;
  played: Individual[];
  schedule: Pairing[];
  cursor: number;
  games: GameRecord[];
  nodes: number;
  startedAt: number;
  acc: Map<string, Acc>;
};

export function createDarwinRun(seed: number, appVersion: string, now = new Date().toISOString()): Run {
  const rng = mulberry32(seed);
  const base = createGenome("positional");
  const population = Array.from({ length: POPULATION }, (_, slot) => {
    const genome: Genome = {
      id: `gene-0-${pad(slot)}`,
      presetId: "darwin",
      material: [...base.material] as Genome["material"],
      pst: base.pst.map((gene) => clamp(Math.round(gene + gaussian(rng) * 2), -80, 80)),
      terms: [...base.terms],
    };
    return {
      id: `ind-0-${pad(slot)}`,
      genome,
      parents: null,
      generation: 0,
    } satisfies Individual;
  });
  return {
    schema: 1,
    appVersion,
    id: `run-${seed}`,
    seed,
    presetId: "darwin",
    rngState: rng.state(),
    population,
    generations: [],
    hallOfFame: [],
    updatedAt: now,
  };
}

export function createSynapseRun(seed: number, appVersion: string, now = new Date().toISOString()): Run {
  const rng = mulberry32(seed);
  const population = Array.from({ length: POPULATION }, (_, slot) => ({
    id: `ind-0-${pad(slot)}`,
    genome: { kind: "network" as const, id: `gene-0-${pad(slot)}`, presetId: "synapse" as const, weights: glorot(rng) },
    parents: null,
    generation: 0,
  }));
  return {
    schema: 2,
    appVersion,
    id: `synapse-${seed}`,
    seed,
    presetId: "synapse",
    rngState: rng.state(),
    population,
    generations: [],
    hallOfFame: [],
    updatedAt: now,
  };
}

export function createPilotRun(seed: number, appVersion: string, now = new Date().toISOString()): Run {
  const rng = mulberry32(seed);
  const base = createGenome("positional");
  const population = Array.from({ length: POPULATION }, (_, slot) => {
    const genome: Genome = {
      id: `gene-0-${pad(slot)}`,
      presetId: "pilot",
      material: [...base.material] as Genome["material"],
      pst: base.pst.map((gene) => clamp(Math.round(gene + gaussian(rng) * 2), -80, 80)),
      terms: [...base.terms],
    };
    return { id: `ind-0-${pad(slot)}`, genome, parents: null, generation: 0 } satisfies Individual;
  });
  return {
    schema: 1,
    appVersion,
    id: `pilot-${seed}`,
    seed,
    presetId: "pilot",
    rngState: rng.state(),
    population,
    generations: [],
    hallOfFame: [],
    updatedAt: now,
  };
}

export function startGeneration(run: Run, budget: Budget, options?: { maxPlies?: number; now?: number }): GenerationJob {
  const rng = mulberry32FromState(run.rngState);
  const played = [...run.population].sort((a, b) => a.id.localeCompare(b.id)).map(cloneIndividual);
  const hallOpponent = run.hallOfFame.length > 0 ? run.hallOfFame[rng.nextInt(run.hallOfFame.length)].individual : null;
  const schedule = buildSchedule(played, hallOpponent);
  const acc = new Map<string, Acc>();
  for (const individual of played) {
    acc.set(individual.id, { anchor: 0, anchorN: 0, peer: 0, peerN: 0, fame: 0, fameN: 0 });
  }
  return {
    run,
    budget,
    maxPlies: options?.maxPlies ?? DEFAULT_PLIES,
    rng,
    played,
    schedule,
    cursor: 0,
    games: [],
    nodes: 0,
    startedAt: options?.now ?? Date.now(),
    acc,
  };
}

export function playNextGame(job: GenerationJob): boolean {
  if (job.cursor >= job.schedule.length) return false;
  const pairing = job.schedule[job.cursor];
  const played = playGame(job, pairing);
  job.games.push(played.record);
  job.nodes += played.nodes;
  award(job, pairing, played.record.result);
  job.cursor += 1;
  return job.cursor < job.schedule.length;
}

export function finishGeneration(job: GenerationJob, now = Date.now()) {
  const scores = scorePopulation(job.played, job.acc);
  const ranked = [...job.played].sort((a, b) => compareScore(a, b, scores));
  const nextGeneration = job.run.generations.length + 1;
  const elites = ranked.slice(0, 2).map((individual, slot) =>
    cloneIndividual({
      ...individual,
      id: `ind-${nextGeneration}-${pad(slot)}`,
      parents: [individual.id, individual.id],
      generation: nextGeneration,
    }),
  );
  const children: Individual[] = [];
  for (let slot = 2; slot < POPULATION; slot += 1) {
    const left = tournament(ranked, scores, job.rng);
    const right = tournament(
      ranked.filter((individual) => individual.id !== left.id),
      scores,
      job.rng,
    );
    const genome = crossover(left.genome, right.genome, job.rng, `gene-${nextGeneration}-${pad(slot)}`);
    mutate(genome, job.rng);
    children.push({
      id: `ind-${nextGeneration}-${pad(slot)}`,
      genome,
      parents: [left.id, right.id],
      generation: nextGeneration,
    });
  }
  const generation = {
    index: nextGeneration,
    presetId: job.run.presetId,
    seed: job.run.seed,
    budget: job.budget,
    population: job.played.map(cloneIndividual),
    games: job.games,
    scores,
    bestId: ranked[0].id,
    nodes: job.nodes,
    elapsedMs: Math.max(0, now - job.startedAt),
  };
  return {
    generation,
    rngState: job.rng.state(),
    population: [...elites, ...children],
    hallOfFame: updateHall(job.run.hallOfFame, ranked, scores),
  };
}

export function scheduledGameCount(hallSize: number): number {
  return hallSize > 0 ? 72 : 48;
}

export function parseRun(value: unknown): Run {
  if (!isRecord(value) || !Array.isArray(value.population) || value.population.length !== POPULATION) throw new Error("Schema mismatch");
  const synapse = value.schema === 2 && value.presetId === "synapse";
  const darwin = value.schema === 1 && (value.presetId === "darwin" || value.presetId === "pilot");
  if (!synapse && !darwin) throw new Error("Schema mismatch");
  for (const individual of value.population) {
    if (!validIndividual(individual, synapse)) throw new Error("Schema mismatch");
  }
  if (!Array.isArray(value.generations) || !Array.isArray(value.hallOfFame)) throw new Error("Schema mismatch");
  return value as Run;
}

export function bestIndividual(run: Run): Individual | null {
  const last = run.generations[run.generations.length - 1];
  if (!last) return null;
  return last.population.find((individual) => individual.id === last.bestId) ?? null;
}

function buildSchedule(population: Individual[], hall: Individual | null): Pairing[] {
  const classic = createGenome("classic");
  const anchorSeat: Seat = { id: classic.id, genome: classic };
  const games: Pairing[] = [];
  for (const individual of population) {
    const seat = seatOf(individual);
    games.push({ white: seat, black: anchorSeat, bucket: "anchor" });
    games.push({ white: anchorSeat, black: seat, bucket: "anchor" });
  }
  for (let index = 0; index < population.length; index += 1) {
    const left = seatOf(population[index]);
    const right = seatOf(population[(index + 1) % population.length]);
    games.push({ white: left, black: right, bucket: "peer" });
    games.push({ white: right, black: left, bucket: "peer" });
  }
  if (hall) {
    const fame = seatOf(hall);
    for (const individual of population) {
      const seat = seatOf(individual);
      games.push({ white: seat, black: fame, bucket: "fame" });
      games.push({ white: fame, black: seat, bucket: "fame" });
    }
  }
  return games;
}

function playGame(job: GenerationJob, pairing: Pairing): { record: GameRecord; nodes: number } {
  let pos = startPosition();
  const history = [positionKey(pos)];
  const moves: string[] = [];
  let nodes = 0;
  while (moves.length < job.maxPlies) {
    const end = gameResult(pos, history);
    if (end) {
      return {
        nodes,
        record: recordOf(job, pairing, moves, end.result, end.reason, false),
      };
    }
    const genome = pos.side === "w" ? pairing.white.genome : pairing.black.genome;
    const hit =
      job.run.presetId === "pilot" && !isNetworkGenome(genome) && genome.presetId === "pilot"
        ? searchPilot(pos, genome, job.budget, job.rng)
        : search(pos, genome, job.run.presetId === "pilot" ? { maxDepth: 1, maxNodes: 2_000, simulations: 0 } : job.budget, job.rng);
    nodes += hit.nodes;
    pos = applyMove(pos, hit.move);
    moves.push(moveToUci(hit.move));
    history.push(positionKey(pos));
  }
  return { nodes, record: recordOf(job, pairing, moves, "1/2-1/2", "ply-cap", true) };
}

function recordOf(
  job: GenerationJob,
  pairing: Pairing,
  moves: string[],
  result: GameRecord["result"],
  reason: GameRecord["reason"],
  plyCap: boolean,
): GameRecord {
  return {
    id: `g${job.run.generations.length + 1}-${pad(job.cursor, 3)}`,
    whiteId: pairing.white.id,
    blackId: pairing.black.id,
    moves,
    result,
    reason,
    plyCap,
  };
}

function award(job: GenerationJob, pairing: Pairing, result: GameRecord["result"]): void {
  add(job.acc, pairing.white.id, pairing.bucket, points(result, "w"));
  add(job.acc, pairing.black.id, pairing.bucket, points(result, "b"));
}

function add(acc: Map<string, Acc>, id: string, bucket: Bucket, value: number): void {
  const row = acc.get(id);
  if (!row) return;
  if (bucket === "anchor") {
    row.anchor += value;
    row.anchorN += 1;
  } else if (bucket === "peer") {
    row.peer += value;
    row.peerN += 1;
  } else {
    row.fame += value;
    row.fameN += 1;
  }
}

function points(result: GameRecord["result"], color: "w" | "b"): number {
  if (result === "1/2-1/2") return 0.5;
  if (color === "w") return result === "1-0" ? 1 : 0;
  return result === "0-1" ? 1 : 0;
}

function scorePopulation(population: Individual[], acc: Map<string, Acc>): ScoreRecord[] {
  return population.map((individual) => {
    const row = acc.get(individual.id)!;
    const anchorPoints = row.anchorN ? row.anchor / row.anchorN : 0;
    const peerPoints = row.peerN ? row.peer / row.peerN : 0;
    const famePoints = row.fameN ? row.fame / row.fameN : null;
    const fitness = famePoints === null ? (anchorPoints + peerPoints) / 2 : (anchorPoints + peerPoints + famePoints) / 3;
    return { id: individual.id, fitness, anchorPoints, peerPoints, famePoints };
  });
}

function compareScore(a: Individual, b: Individual, scores: ScoreRecord[]): number {
  const left = scores.find((score) => score.id === a.id)!;
  const right = scores.find((score) => score.id === b.id)!;
  if (left.fitness !== right.fitness) return right.fitness - left.fitness;
  return a.id.localeCompare(b.id);
}

function tournament(pool: Individual[], scores: ScoreRecord[], rng: Rng): Individual {
  const used = new Set<number>();
  let best: Individual | null = null;
  while (used.size < 3) {
    const index = rng.nextInt(pool.length);
    if (used.has(index)) continue;
    used.add(index);
    const candidate = pool[index];
    if (!best || compareScore(candidate, best, scores) < 0) best = candidate;
  }
  return best!;
}

function crossover(a: AnyGenome, b: AnyGenome, rng: Rng, id: string): AnyGenome {
  if (isNetworkGenome(a) && isNetworkGenome(b)) {
    return {
      kind: "network",
      id,
      presetId: "synapse",
      weights: a.weights.map((gene, index) => (rng.next() < 0.5 ? gene : b.weights[index])),
    };
  }
  if (isNetworkGenome(a) || isNetworkGenome(b) || a.presetId !== b.presetId) throw new Error("Schema mismatch");
  return {
    id,
    presetId: a.presetId,
    material: a.material.map((gene, index) => (rng.next() < 0.5 ? gene : b.material[index])) as Genome["material"],
    pst: a.pst.map((gene, index) => (rng.next() < 0.5 ? gene : b.pst[index])),
    terms: a.terms.map((gene, index) => (rng.next() < 0.5 ? gene : b.terms[index])),
  };
}

function mutate(genome: AnyGenome, rng: Rng): void {
  if (isNetworkGenome(genome)) {
    genome.weights = genome.weights.map((gene) => (rng.next() < 0.08 ? clamp(gene + gaussian(rng) * 0.05, -2, 2) : gene));
    return;
  }
  genome.material = genome.material.map((gene) =>
    rng.next() < 0.08 ? clamp(Math.round(gene + gaussian(rng) * 8), 50, 2000) : gene,
  ) as Genome["material"];
  genome.pst = genome.pst.map((gene) => (rng.next() < 0.08 ? clamp(Math.round(gene + gaussian(rng) * 4), -80, 80) : gene));
  genome.terms = genome.terms.map((gene) =>
    rng.next() < 0.08 ? clamp(Math.round(gene + gaussian(rng) * 8), -200, 200) : gene,
  );
}

function updateHall(hall: HallEntry[], ranked: Individual[], scores: ScoreRecord[]): HallEntry[] {
  const best = [...ranked].sort((a, b) => {
    const left = scores.find((score) => score.id === a.id)!;
    const right = scores.find((score) => score.id === b.id)!;
    if (left.anchorPoints !== right.anchorPoints) return right.anchorPoints - left.anchorPoints;
    return a.id.localeCompare(b.id);
  })[0];
  const anchorPoints = scores.find((score) => score.id === best.id)!.anchorPoints;
  const next = hall.map((entry) => ({ individual: cloneIndividual(entry.individual), anchorPoints: entry.anchorPoints }));
  const existing = next.find((entry) => entry.individual.genome.id === best.genome.id);
  if (existing) {
    if (anchorPoints > existing.anchorPoints) {
      existing.individual = cloneIndividual(best);
      existing.anchorPoints = anchorPoints;
    }
  } else {
    next.push({ individual: cloneIndividual(best), anchorPoints });
  }
  next.sort((a, b) => b.anchorPoints - a.anchorPoints || a.individual.id.localeCompare(b.individual.id));
  return next.slice(0, 8);
}

function gaussian(rng: Rng): number {
  const u = Math.max(rng.next(), Number.EPSILON);
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function seatOf(individual: Individual): Seat {
  return { id: individual.id, genome: individual.genome };
}

function cloneIndividual(individual: Individual): Individual {
  return {
    ...individual,
    parents: individual.parents ? [individual.parents[0], individual.parents[1]] : null,
    genome: cloneGenome(individual.genome),
  };
}

function cloneGenome(genome: AnyGenome): AnyGenome {
  if (isNetworkGenome(genome)) return { kind: "network", id: genome.id, presetId: "synapse", weights: genome.weights.slice() };
  return {
    id: genome.id,
    presetId: genome.presetId,
    material: [...genome.material] as Genome["material"],
    pst: [...genome.pst],
    terms: [...genome.terms],
  };
}

function pad(value: number, size = 2): string {
  return String(value).padStart(size, "0");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validIndividual(value: unknown, synapse: boolean): boolean {
  if (!isRecord(value) || !isRecord(value.genome)) return false;
  const genome = value.genome;
  if (synapse) return genome.kind === "network" && Array.isArray(genome.weights) && genome.weights.length === 769 * 32 + 32 + 32 + 1;
  return Array.isArray(genome.material) && genome.material.length === 5 && Array.isArray(genome.pst) && genome.pst.length === 384;
}

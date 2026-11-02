import { finishGeneration, playNextGame, startGeneration } from "../engine/evolve";
import { mulberry32 } from "../engine/rng";
import { moveToUci, parseFen } from "../engine/rules";
import { search } from "../engine/search";
import type { GenerationJob } from "../engine/evolve";
import type { WorkerRequest } from "./protocol";

type Active = {
  jobId: string;
  job: GenerationJob;
  paused: boolean;
  timer: number;
};

let active: Active | null = null;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.kind === "cancel") {
    if (!active || active.jobId !== message.jobId) return;
    active.paused = true;
    clearTimeout(active.timer);
    postProgress("generation-paused");
    return;
  }
  if (message.kind === "resume") {
    if (!active || active.jobId !== message.jobId) {
      postError(message.jobId, "No paused generation");
      return;
    }
    active.paused = false;
    step();
    return;
  }
  if (message.kind === "generation") {
    if (active && !active.paused) {
      postError(message.jobId, "A generation is already running");
      return;
    }
    if (active) clearTimeout(active.timer);
    try {
      active = { jobId: message.jobId, job: startGeneration(message.run, message.budget), paused: false, timer: 0 };
      step();
    } catch (error) {
      active = null;
      postError(message.jobId, error instanceof Error ? error.message : "Worker error");
    }
    return;
  }
  if (message.kind !== "search") return;
  try {
    if (message.search !== "negamax") throw new Error("This search is not available yet");
    const hit = search(parseFen(message.fen), message.genome, message.budget, mulberry32(message.seed));
    self.postMessage({
      kind: "search-done",
      jobId: message.jobId,
      move: moveToUci(hit.move),
      nodes: hit.nodes,
      score: hit.score,
      pv: hit.pv,
      tieBreak: hit.tieBreak,
    });
  } catch (error) {
    postError(message.jobId, error instanceof Error ? error.message : "Worker error");
  }
};

function step(): void {
  if (!active || active.paused) return;
  const current = active;
  const more = playNextGame(current.job);
  postProgress("generation-progress");
  if (!active || active.paused || active.jobId !== current.jobId) return;
  if (more) {
    current.timer = setTimeout(step, 0) as unknown as number;
    return;
  }
  const done = finishGeneration(current.job);
  self.postMessage({ kind: "generation-done", jobId: current.jobId, ...done });
  if (active?.jobId === current.jobId) active = null;
}

function postProgress(kind: "generation-progress" | "generation-paused"): void {
  if (!active) return;
  self.postMessage({
    kind,
    jobId: active.jobId,
    gamesDone: active.job.cursor,
    gamesTotal: active.job.schedule.length,
  });
}

function postError(jobId: string, message: string): void {
  self.postMessage({ kind: "error", jobId, message });
}

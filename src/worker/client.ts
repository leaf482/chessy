import type { Budget, Genome, Run } from "../engine/types";
import type { GenerationDone, SearchDone, WorkerEvent } from "./protocol";

type Waiter = {
  resolve: (event: SearchDone) => void;
  reject: (error: Error) => void;
};

type GenerationHandlers = {
  onProgress: (gamesDone: number, gamesTotal: number) => void;
  onPaused: (gamesDone: number, gamesTotal: number) => void;
  onDone: (result: GenerationDone) => void;
  onError: (message: string) => void;
};

let worker: Worker | null = null;
let sequence = 0;
let control: { jobId: string; paused: boolean } | null = null;
const pending = new Map<string, Waiter>();
const generations = new Map<string, GenerationHandlers>();

export function activeGeneration(): { jobId: string; paused: boolean } | null {
  return control ? { ...control } : null;
}

export function pauseActiveGeneration(): void {
  if (!control) return;
  control.paused = true;
  worker?.postMessage({ kind: "cancel", jobId: control.jobId });
}

export function discardActiveGeneration(): void {
  if (!control) return;
  const jobId = control.jobId;
  control = null;
  worker?.postMessage({ kind: "cancel", jobId });
}

export function resumeActiveGeneration(): void {
  if (!control?.paused) return;
  control.paused = false;
  worker?.postMessage({ kind: "resume", jobId: control.jobId });
}

function engineWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./engine.worker.ts", import.meta.url));
    worker.onmessage = (event: MessageEvent<WorkerEvent>) => {
      const message = event.data;
      if (message.kind === "generation-progress") {
        generations.get(message.jobId)?.onProgress(message.gamesDone, message.gamesTotal);
        return;
      }
      if (message.kind === "generation-paused") {
        if (control?.jobId === message.jobId) control.paused = true;
        generations.get(message.jobId)?.onPaused(message.gamesDone, message.gamesTotal);
        return;
      }
      if (message.kind === "generation-done") {
        const handler = generations.get(message.jobId);
        generations.delete(message.jobId);
        if (control?.jobId === message.jobId) control = null;
        handler?.onDone(message);
        return;
      }
      if (message.kind === "error") {
        const handler = generations.get(message.jobId);
        if (handler) {
          generations.delete(message.jobId);
          if (control?.jobId === message.jobId) control = null;
          handler.onError(message.message);
          return;
        }
        const waiter = pending.get(message.jobId);
        if (!waiter) return;
        pending.delete(message.jobId);
        waiter.reject(new Error(message.message));
        return;
      }
      const waiter = pending.get(message.jobId);
      if (!waiter) return;
      pending.delete(message.jobId);
      waiter.resolve(message);
    };
    worker.onerror = () => {
      for (const waiter of pending.values()) waiter.reject(new Error("Worker error"));
      pending.clear();
      for (const handler of generations.values()) handler.onError("Worker error");
      generations.clear();
      control = null;
    };
  }
  return worker;
}

export function requestSearch(input: { fen: string; genome: Genome; budget: Budget; seed: number }): {
  done: Promise<SearchDone>;
  cancel: () => void;
} {
  const jobId = String(++sequence);
  const done = new Promise<SearchDone>((resolve, reject) => {
    pending.set(jobId, { resolve, reject });
  });
  engineWorker().postMessage({ kind: "search", jobId, search: "negamax", ...input });
  return {
    done,
    cancel() {
      pending.delete(jobId);
      worker?.postMessage({ kind: "cancel", jobId });
    },
  };
}

export function requestGeneration(
  input: { run: Run; budget: Budget },
  handlers: GenerationHandlers,
): { jobId: string; pause: () => void; resume: () => void } {
  const jobId = String(++sequence);
  generations.set(jobId, handlers);
  control = { jobId, paused: false };
  engineWorker().postMessage({ kind: "generation", jobId, run: input.run, budget: input.budget });
  return {
    jobId,
    pause() {
      worker?.postMessage({ kind: "cancel", jobId });
    },
    resume() {
      worker?.postMessage({ kind: "resume", jobId });
    },
  };
}

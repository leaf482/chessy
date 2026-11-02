import type { Budget, Genome } from "../engine/types";
import type { SearchDone, WorkerEvent } from "./protocol";

type Waiter = {
  resolve: (event: SearchDone) => void;
  reject: (error: Error) => void;
};

let worker: Worker | null = null;
let sequence = 0;
const pending = new Map<string, Waiter>();

function engineWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./engine.worker.ts", import.meta.url));
    worker.onmessage = (event: MessageEvent<WorkerEvent>) => {
      const message = event.data;
      const waiter = pending.get(message.jobId);
      if (!waiter) return;
      pending.delete(message.jobId);
      if (message.kind === "error") waiter.reject(new Error(message.message));
      else waiter.resolve(message);
    };
    worker.onerror = () => {
      for (const waiter of pending.values()) waiter.reject(new Error("Worker error"));
      pending.clear();
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

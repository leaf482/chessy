import { mulberry32 } from "../engine/rng";
import { moveToUci, parseFen } from "../engine/rules";
import { search } from "../engine/search";
import type { WorkerRequest } from "./protocol";

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.kind !== "search") return;
  try {
    if (message.search !== "negamax") throw new Error("This search is not available yet");
    const hit = search(parseFen(message.fen), message.genome, message.budget, mulberry32(message.seed));
    const done = {
      kind: "search-done" as const,
      jobId: message.jobId,
      move: moveToUci(hit.move),
      nodes: hit.nodes,
      score: hit.score,
      pv: hit.pv,
      tieBreak: hit.tieBreak,
    };
    self.postMessage(done);
  } catch (error) {
    self.postMessage({
      kind: "error",
      jobId: message.jobId,
      message: error instanceof Error ? error.message : "Worker error",
    });
  }
};

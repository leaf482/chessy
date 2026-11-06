"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { bestIndividual } from "@/engine/evolve";
import { RAPID_BUDGET } from "@/engine/presets";
import type { Run } from "@/engine/types";
import { PRESET_EVENT, loadSelectedPreset, saveOpponent, saveSelectedPreset, type SelectedPreset } from "@/store/preset";
import { RUN_EVENT, RUN_STATUS_EVENT, loadRunForPreset } from "@/store/run";
import { APP_VERSION } from "@/version";
import { pauseActiveGeneration } from "@/worker/client";

export default function MissionPage() {
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(null);
  const [preset, setPreset] = useState<SelectedPreset>("classic");
  const [live, setLive] = useState(false);

  useEffect(() => {
    const read = () => {
      const selected = loadSelectedPreset();
      setPreset(selected);
      setRun(loadRunForPreset(selected));
    };
    read();
    const onStatus = (event: Event) => {
      setLive((event as CustomEvent<{ running: boolean }>).detail.running);
    };
    window.addEventListener(PRESET_EVENT, read);
    window.addEventListener(RUN_EVENT, read);
    window.addEventListener(RUN_STATUS_EVENT, onStatus);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(PRESET_EVENT, read);
      window.removeEventListener(RUN_EVENT, read);
      window.removeEventListener(RUN_STATUS_EVENT, onStatus);
      window.removeEventListener("storage", read);
    };
  }, []);

  const last = run?.generations[run.generations.length - 1];
  const best = run ? bestIndividual(run) : null;
  const generation = last ? String(last.index).padStart(2, "0") : "00";
  const anchor = last ? bestScore(last.scores, last.bestId) : "—";
  const nodes = last && last.elapsedMs > 0 ? Math.round(last.nodes / (last.elapsedMs / 1000)).toLocaleString("en-US") : "—";
  const depth = last?.budget.maxDepth ?? RAPID_BUDGET.maxDepth;
  const population = run?.population.length ?? 12;
  const seed = run ? String(run.seed) : "—";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl flex-col">
      <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Generation</p>
      <p className="mt-3 text-[80px] leading-none font-medium tracking-tight">{generation}</p>
      <p className="mt-8 text-[11px] tracking-[0.14em] text-faint uppercase">{presetLabel(preset)}</p>
      <p className="mt-3 max-w-xl text-muted">
        Self-play under one budget. Evaluations that outscore the anchor carry into the next generation.
      </p>
      <p className="mt-2 text-sm text-faint">
        depth {depth} · population {population} · seed {seed}
      </p>
      <dl className="mt-12 grid max-w-xl grid-cols-3 gap-6">
        <Stat value={generation} label="Generation" />
        <Stat value={anchor} label="Anchor" />
        <Stat value={nodes} label="Nodes/s" />
      </dl>
      <div className="mt-8 flex gap-6 text-sm text-faint">
        {(run?.generations.slice(-6) ?? []).map((record) => (
          <span key={record.index}>{bestScore(record.scores, record.bestId)}</span>
        ))}
      </div>
      <div className="mt-12 flex flex-wrap gap-3">
        <button
          type="button"
          className="border border-white/40 px-4 py-3 text-sm opacity-80 hover:opacity-100"
          onClick={() => {
            if (live) {
              pauseActiveGeneration();
              return;
            }
            const selected = loadSelectedPreset();
            if (selected !== "synapse" && selected !== "pilot") saveSelectedPreset("darwin");
            router.push("/evolve");
          }}
        >
          {live ? "Pause" : "Start evolution"}
        </button>
        {best ? (
          <button
            type="button"
            className="border border-white/40 px-4 py-3 text-sm opacity-80 hover:opacity-100"
            onClick={() => {
              saveOpponent(best.genome);
              router.push("/play");
            }}
          >
            Play best
          </button>
        ) : (
          <span className="border border-white/15 px-4 py-3 text-sm text-faint">Play best</span>
        )}
      </div>
      <footer className="mt-auto flex gap-6 pt-16 text-[11px] tracking-[0.14em] text-faint uppercase">
        <span>{APP_VERSION}</span>
        <Link className="hover:opacity-100" href="https://github.com/leaf482/chessy/blob/main/docs/plan.md">
          Docs
        </Link>
      </footer>
    </div>
  );
}

function presetLabel(preset: SelectedPreset): string {
  if (preset === "synapse") return "Synapse";
  if (preset === "pilot") return "Pilot";
  return "Darwin";
}

function bestScore(scores: Run["generations"][number]["scores"], bestId: string): string {
  const score = scores.find((entry) => entry.id === bestId);
  return score ? score.anchorPoints.toFixed(2) : "—";
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-[0.14em] text-faint uppercase">{label}</dt>
      <dd className="mt-2 text-3xl font-medium">{value}</dd>
    </div>
  );
}

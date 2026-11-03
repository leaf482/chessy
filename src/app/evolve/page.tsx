"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createDarwinRun, createSynapseRun } from "@/engine/evolve";
import { isNetworkGenome } from "@/engine/network";
import { RAPID_BUDGET, STANDARD_BUDGET } from "@/engine/presets";
import type { Budget, Individual, Run } from "@/engine/types";
import { loadSelectedPreset, type SelectedPreset } from "@/store/preset";
import { downloadJson, loadRunForPreset, mergeGeneration, publishStatus, saveRun } from "@/store/run";
import { parseRun } from "@/engine/evolve";
import { APP_VERSION } from "@/version";
import { activeGeneration, discardActiveGeneration, pauseActiveGeneration, requestGeneration, resumeActiveGeneration } from "@/worker/client";

type BudgetName = "Rapid" | "Standard";
type Handle = { jobId: string; pause: () => void; resume: () => void };

export default function EvolvePage() {
  const [ready, setReady] = useState(false);
  const [preset, setPreset] = useState<SelectedPreset>("classic");
  const [run, setRun] = useState<Run | null>(null);
  const [seed, setSeed] = useState(1042);
  const [budgetName, setBudgetName] = useState<BudgetName>("Rapid");
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const mode = useRef<"idle" | "run" | "step">("idle");
  const handle = useRef<Handle | null>(null);
  const runRef = useRef<Run | null>(null);
  const epoch = useRef(0);
  const presetRef = useRef<SelectedPreset>("classic");
  const budgetRef = useRef<Budget>(RAPID_BUDGET);
  presetRef.current = preset;
  budgetRef.current = budgetName === "Rapid" ? RAPID_BUDGET : STANDARD_BUDGET;

  useEffect(() => {
    const selected = loadSelectedPreset();
    setPreset(selected);
    const stored = selected === "darwin" || selected === "synapse" ? loadRunForPreset(selected) : null;
    setRun(stored);
    runRef.current = stored;
    if (stored) setSeed(stored.seed);
    const active = activeGeneration();
    if (active) {
      setRunning(!active.paused);
      setPaused(active.paused);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    const completed = run?.generations.length ?? 0;
    publishStatus(running, running || paused ? completed + 1 : completed);
  }, [running, paused, run]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Evolve</p>
      </div>
    );
  }

  if (preset !== "darwin" && preset !== "synapse") {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Evolve</p>
        <p className="mt-4 text-muted">This preset does not evolve. Play it on the board.</p>
        <Link href="/play" className="mt-4 inline-block text-sm opacity-80 hover:opacity-100">
          Play
        </Link>
      </div>
    );
  }

  const budget = budgetRef.current;
  const last = run?.generations[run.generations.length - 1];
  const ranked = last ? [...last.scores].sort((a, b) => b.fitness - a.fitness || a.id.localeCompare(b.id)) : [];

  function remember(next: Run | null) {
    runRef.current = next;
    setRun(next);
    saveRun(next, presetRef.current === "synapse" ? "synapse" : "darwin");
  }

  function launch(nextMode: "run" | "step", source?: Run) {
    const current = source ?? runRef.current ?? (presetRef.current === "synapse" ? createSynapseRun(seed, APP_VERSION) : createDarwinRun(seed, APP_VERSION));
    if (!runRef.current) remember(current);
    const ticket = epoch.current;
    mode.current = nextMode;
    setError(null);
    setRunning(true);
    setPaused(false);
    handle.current = requestGeneration({ run: current, budget: budgetRef.current }, {
      onProgress: (done, total) => {
        if (ticket !== epoch.current) return;
        setProgress({ done, total });
      },
      onPaused: (done, total) => {
        if (ticket !== epoch.current) return;
        setProgress({ done, total });
        setRunning(false);
        setPaused(true);
        publishStatus(false, (runRef.current?.generations.length ?? 0) + 1);
      },
      onDone: (result) => {
        if (ticket !== epoch.current) return;
        const prev = runRef.current;
        handle.current = null;
        setPaused(false);
        setProgress(null);
        if (!prev) return;
        const next = mergeGeneration(prev, result);
        remember(next);
        if (mode.current === "run") {
          publishStatus(true, next.generations.length + 1);
          launch("run", next);
        } else {
          mode.current = "idle";
          setRunning(false);
          publishStatus(false, next.generations.length);
        }
      },
      onError: (message) => {
        if (ticket !== epoch.current) return;
        setError(message);
        setRunning(false);
        setPaused(false);
        mode.current = "idle";
        handle.current = null;
      },
    });
  }

  function abandon() {
    epoch.current += 1;
    mode.current = "idle";
    discardActiveGeneration();
    handle.current = null;
    setRunning(false);
    setPaused(false);
    setProgress(null);
  }

  function start(nextMode: "run" | "step") {
    if (activeGeneration()?.paused) {
      mode.current = nextMode;
      setRunning(true);
      setPaused(false);
      resumeActiveGeneration();
      return;
    }
    if (running) {
      mode.current = nextMode;
      return;
    }
    launch(nextMode);
  }

  function pause() {
    mode.current = "idle";
    pauseActiveGeneration();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Evolve</p>
      <h1 className="mt-3 text-4xl font-medium tracking-[0.08em]">{preset === "synapse" ? "SYNAPSE" : "DARWIN"}</h1>
      <div className="mt-6 flex flex-wrap items-end gap-6 text-sm">
        <label className="text-faint">
          Seed
          <input
            className="mt-2 block w-28 border border-line bg-black px-2 py-2 text-white"
            type="number"
            value={seed}
            disabled={Boolean(run)}
            onChange={(event) => setSeed(Number(event.target.value))}
          />
        </label>
        <p className="text-muted">
          {budgetName} · depth {budget.maxDepth} · {budget.maxNodes.toLocaleString("en-US")} nodes
        </p>
      </div>
      <div className="mt-6 grid grid-cols-2 border border-line text-sm">
        <BudgetButton name="Rapid" budget={RAPID_BUDGET} selected={budgetName === "Rapid"} onSelect={() => setBudgetName("Rapid")} />
        <BudgetButton name="Standard" budget={STANDARD_BUDGET} selected={budgetName === "Standard"} onSelect={() => setBudgetName("Standard")} />
      </div>
      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <button type="button" className="opacity-80 hover:opacity-100" onClick={() => (running ? pause() : start("run"))}>
          {running ? "Pause" : "Start"}
        </button>
        <button type="button" className="opacity-80 hover:opacity-100" onClick={() => start("step")}>
          Step one generation
        </button>
      </div>
      <p className="mt-4 text-sm text-muted">
        {progress ? `${progress.done} / ${progress.total} games` : "Ready"}
      </p>
      {error ? <p className="mt-2 text-sm text-signal">Worker error. {error}</p> : null}
      <table className="mt-8 w-full text-left text-sm">
        <thead className="text-[11px] tracking-[0.14em] text-faint uppercase">
          <tr>
            <th className="py-2 font-normal">Rank</th>
            <th className="font-normal">Id</th>
            <th className="font-normal">Fitness</th>
            <th className="font-normal">Anchor</th>
            <th className="font-normal">Elite</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((score, index) => {
            const open = openId === score.id;
            return (
              <tr key={score.id} className="cursor-pointer border-t border-line" onClick={() => setOpenId(open ? null : score.id)}>
                <td className="py-2">{index + 1}</td>
                <td>{score.id.slice(0, 8)}</td>
                <td>{score.fitness.toFixed(2)}</td>
                <td>{score.anchorPoints.toFixed(2)}</td>
                <td>{index < 2 ? "yes" : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {openId && last ? <GenomeDetail individual={last.population.find((entry) => entry.id === openId)} /> : null}
      <div className="mt-8 flex flex-wrap gap-4 text-sm">
        <button type="button" className="opacity-80 hover:opacity-100" onClick={() => run && downloadJson(`${run.id}.json`, run)}>
          Export run
        </button>
        <label className="cursor-pointer opacity-80 hover:opacity-100">
          Import run
          <input
            className="hidden"
            type="file"
            accept="application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              try {
                const next = parseRun(JSON.parse(await file.text()));
                if (next.presetId !== presetRef.current) throw new Error("Schema mismatch");
                abandon();
                setImportError(null);
                setSeed(next.seed);
                remember(next);
              } catch {
                setImportError("Schema mismatch");
              }
            }}
          />
        </label>
        <button type="button" className="opacity-80 hover:opacity-100" onClick={() => setConfirming(true)}>
          New run
        </button>
      </div>
      {importError ? <p className="mt-2 text-sm text-signal">{importError}</p> : null}
      {confirming ? (
        <div className="mt-3 flex gap-4 text-sm">
          <span className="text-muted">Clear the current run?</span>
          <button
            type="button"
            onClick={() => {
              abandon();
              remember(null);
              setConfirming(false);
              setOpenId(null);
            }}
          >
            Confirm
          </button>
          <button type="button" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BudgetButton({
  name,
  budget,
  selected,
  onSelect,
}: {
  name: string;
  budget: Budget;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" className={`px-4 py-3 text-left ${selected ? "text-white" : "text-faint"}`} onClick={onSelect}>
      <span className="block text-[11px] tracking-[0.14em] uppercase">{name}</span>
      <span className="mt-1 block text-sm">
        Depth {budget.maxDepth} · {budget.maxNodes.toLocaleString("en-US")}
      </span>
    </button>
  );
}

function GenomeDetail({ individual }: { individual: Individual | undefined }) {
  if (!individual) return null;
  return (
    <div className="mt-4 border border-line p-4 text-sm">
      <p className="text-muted">
        {isNetworkGenome(individual.genome)
          ? `Weights ${individual.genome.weights.length.toLocaleString("en-US")}`
          : `Material ${individual.genome.material.join(" ")}`}
      </p>
      <p className="mt-2 text-faint">Parents {individual.parents ? individual.parents.join(" ") : "none"}</p>
      <button type="button" className="mt-3 opacity-80 hover:opacity-100" onClick={() => downloadJson(`${individual.genome.id}.json`, individual.genome)}>
        Export genome
      </button>
    </div>
  );
}

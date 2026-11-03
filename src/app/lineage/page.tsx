"use client";

import { useEffect, useState } from "react";
import { bestIndividual } from "@/engine/evolve";
import { ancestorChain, findIndividual } from "@/engine/lineage";
import type { Run } from "@/engine/types";
import { PRESET_EVENT, loadSelectedPreset } from "@/store/preset";
import { RUN_EVENT, loadRunForPreset } from "@/store/run";

export default function LineagePage() {
  const [ready, setReady] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setRun(loadRunForPreset(loadSelectedPreset()));
    read();
    setReady(true);
    window.addEventListener(RUN_EVENT, read);
    window.addEventListener(PRESET_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(RUN_EVENT, read);
      window.removeEventListener(PRESET_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Lineage</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Lineage</p>
        <p className="mt-4 text-muted">No lineage yet.</p>
      </div>
    );
  }

  const focus = selectedId && findIndividual(run, selectedId) ? selectedId : (bestIndividual(run)?.id ?? run.population[0]?.id ?? null);
  const chain = focus ? ancestorChain(run, focus) : [];
  const played = run.generations[run.generations.length - 1]?.population ?? [];

  return (
    <div className="mx-auto grid max-w-5xl gap-10 min-[960px]:grid-cols-[280px_auto]">
      <div>
        <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Lineage</p>
        <h1 className="mt-3 text-4xl font-medium tracking-[0.08em] uppercase">{run.presetId}</h1>
        <p className="mt-3 text-sm text-muted">Seed {run.seed}</p>
        <Roster title="Played" ids={played.map((individual) => individual.id)} selected={focus} onSelect={setSelectedId} run={run} />
        <Roster title="Next" ids={run.population.map((individual) => individual.id)} selected={focus} onSelect={setSelectedId} run={run} />
      </div>
      <div>
        {chain.length === 0 ? <p className="text-muted">No lineage yet.</p> : null}
        <ol>
          {chain.map((step, index) => {
            const parents = step.individual.parents;
            const elite = parents !== null && parents[0] === parents[1];
            return (
              <li key={step.individual.id} className="border-t border-line py-4">
                <p className="text-[11px] tracking-[0.14em] text-faint uppercase">
                  Gen {String(step.individual.generation).padStart(2, "0")}
                  {index === 0 ? " · Selected" : ""}
                  {elite ? " · Elite" : ""}
                </p>
                <p className="mt-2 text-2xl tracking-[0.04em]">{step.individual.id}</p>
                <p className="mt-1 text-sm text-muted">{step.individual.genome.id}</p>
                <p className="mt-3 text-sm text-muted">Anchor {step.anchorPoints === null ? "—" : step.anchorPoints.toFixed(2)}</p>
                <p className="mt-2 text-sm">
                  <span className="text-faint">Parents </span>
                  {parents ? (
                    <>
                      <ParentButton id={parents[0]} onSelect={setSelectedId} />
                      {parents[1] !== parents[0] ? (
                        <>
                          <span className="text-faint"> </span>
                          <ParentButton id={parents[1]} onSelect={setSelectedId} />
                        </>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted">none</span>
                  )}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function Roster({
  title,
  ids,
  selected,
  onSelect,
  run,
}: {
  title: string;
  ids: string[];
  selected: string | null;
  onSelect: (id: string) => void;
  run: Run;
}) {
  if (ids.length === 0) return null;
  return (
    <div className="mt-8">
      <p className="text-[11px] tracking-[0.14em] text-faint uppercase">{title}</p>
      <div className="mt-2 border-t border-line">
        {ids.map((id) => {
          const step = findIndividual(run, id);
          const parents = step?.individual.parents;
          const elite = parents !== null && parents?.[0] === parents?.[1];
          return (
            <button
              key={`${title}-${id}`}
              type="button"
              className={`block w-full border-b border-line py-2 text-left text-sm ${id === selected ? "text-white" : "text-muted opacity-80 hover:opacity-100"}`}
              onClick={() => onSelect(id)}
            >
              {id}
              {elite ? " · elite" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ParentButton({ id, onSelect }: { id: string; onSelect: (id: string) => void }) {
  return (
    <button type="button" className="opacity-80 hover:opacity-100" onClick={() => onSelect(id)}>
      {id}
    </button>
  );
}

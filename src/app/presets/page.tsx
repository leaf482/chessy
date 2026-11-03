"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATALOG, isPlayablePreset } from "@/engine/presets";
import { saveSelectedPreset, type SelectedPreset } from "@/store/preset";
import { activeGeneration, discardActiveGeneration } from "@/worker/client";

export default function PresetsPage() {
  const router = useRouter();
  const [pending, setPending] = useState<SelectedPreset | null>(null);

  function apply(id: SelectedPreset) {
    discardActiveGeneration();
    saveSelectedPreset(id);
    router.push(id === "darwin" ? "/evolve" : "/play");
  }

  function choose(id: SelectedPreset) {
    if (activeGeneration()) {
      setPending(id);
      return;
    }
    saveSelectedPreset(id);
    router.push(id === "darwin" ? "/evolve" : "/play");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Presets</p>
      <p className="mt-4 max-w-xl text-muted">Search paired with an evaluation. Evolution is on for Darwin only.</p>
      <div className="mt-10 grid gap-px bg-line sm:grid-cols-2">
        {CATALOG.map((entry) => {
          const playableId = isPlayablePreset(entry.id) ? entry.id : null;
          return (
          <article key={entry.id} className="bg-background p-5">
            <p className="text-[11px] tracking-[0.14em] text-faint">{entry.index}</p>
            <h1 className="mt-3 text-2xl font-medium tracking-[0.08em]">{entry.name.toUpperCase()}</h1>
            <p className="mt-3 min-h-12 text-sm text-muted">{entry.summary}</p>
            <dl className="mt-6 grid grid-cols-[88px_1fr] gap-y-2 text-sm">
              <dt className="text-[11px] tracking-[0.14em] text-faint uppercase">Search</dt>
              <dd>{entry.search}</dd>
              <dt className="text-[11px] tracking-[0.14em] text-faint uppercase">Genome</dt>
              <dd>{entry.genome}</dd>
              <dt className="text-[11px] tracking-[0.14em] text-faint uppercase">Evolves</dt>
              <dd>{entry.evolves}</dd>
              <dt className="text-[11px] tracking-[0.14em] text-faint uppercase">Budget</dt>
              <dd>{entry.budget}</dd>
            </dl>
            {playableId || entry.id === "darwin" ? (
              <button
                type="button"
                className="mt-6 border border-white/30 px-3 py-2 text-sm opacity-80 hover:opacity-100"
                onClick={() => {
                  if (entry.id === "darwin") choose("darwin");
                  else if (playableId) choose(playableId);
                }}
              >
                Use preset
              </button>
            ) : (
              <p className="mt-6 text-sm text-faint">{entry.later}</p>
            )}
          </article>
          );
        })}
      </div>
      {pending ? (
        <div className="mt-6 flex gap-4 text-sm">
          <span className="text-muted">Stop the current generation?</span>
          <button type="button" onClick={() => apply(pending)}>
            Confirm
          </button>
          <button type="button" onClick={() => setPending(null)}>
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}

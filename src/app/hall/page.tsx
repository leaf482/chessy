"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isNetworkGenome } from "@/engine/network";
import type { HallEntry, Run } from "@/engine/types";
import { PRESET_EVENT, loadSelectedPreset, saveOpponent } from "@/store/preset";
import { RUN_EVENT, loadRunForPreset } from "@/store/run";

export default function HallPage() {
  const router = useRouter();
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
      <div className="mx-auto max-w-3xl">
        <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Hall</p>
      </div>
    );
  }

  const hall = run?.hallOfFame ?? [];
  const selected = hall.find((entry) => entry.individual.id === selectedId) ?? hall[0] ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Hall</p>
      {run ? <h1 className="mt-3 text-4xl font-medium tracking-[0.08em] uppercase">{run.presetId}</h1> : null}
      {run ? <p className="mt-3 text-sm text-muted">Seed {run.seed}</p> : null}
      {hall.length === 0 ? <p className="mt-4 text-muted">No hall yet.</p> : null}
      {hall.length > 0 ? (
        <table className="mt-8 w-full text-left text-sm">
          <thead className="text-[11px] tracking-[0.14em] text-faint uppercase">
            <tr>
              <th className="py-2 font-normal">Rank</th>
              <th className="py-2 font-normal">Id</th>
              <th className="py-2 font-normal">Anchor</th>
              <th className="py-2 font-normal">Gen</th>
            </tr>
          </thead>
          <tbody>
            {hall.map((entry, index) => (
              <tr
                key={entry.individual.id}
                className={`cursor-pointer border-t border-line ${entry.individual.id === selected?.individual.id ? "text-white" : "text-muted"}`}
                onClick={() => setSelectedId(entry.individual.id)}
              >
                <td className="py-2">{String(index + 1).padStart(2, "0")}</td>
                <td className="py-2">
                  <button type="button" className="opacity-80 hover:opacity-100" onClick={() => setSelectedId(entry.individual.id)}>
                    {entry.individual.id}
                  </button>
                </td>
                <td className="py-2">{entry.anchorPoints.toFixed(2)}</td>
                <td className="py-2">{String(entry.individual.generation).padStart(2, "0")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {selected ? (
        <HallDetail
          entry={selected}
          onPlay={() => {
            saveOpponent(selected.individual.genome);
            router.push("/play");
          }}
        />
      ) : null}
    </div>
  );
}

function HallDetail({ entry, onPlay }: { entry: HallEntry; onPlay: () => void }) {
  const genome = entry.individual.genome;
  return (
    <div className="mt-6 border border-line p-4 text-sm">
      <p className="text-muted">{genome.id}</p>
      <p className="mt-2 text-muted">
        {isNetworkGenome(genome) ? `Weights ${genome.weights.length.toLocaleString("en-US")}` : `Material ${genome.material.join(" ")}`}
      </p>
      <button type="button" className="mt-4 border border-white/40 px-4 py-3 opacity-80 hover:opacity-100" onClick={onPlay}>
        Play
      </button>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PRESET_EVENT, loadPlayPreset, type PlayPresetId } from "@/store/preset";

export default function EvolvePage() {
  const [preset, setPreset] = useState<PlayPresetId>("classic");

  useEffect(() => {
    const read = () => setPreset(loadPlayPreset());
    read();
    window.addEventListener(PRESET_EVENT, read);
    return () => window.removeEventListener(PRESET_EVENT, read);
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Evolve</p>
      <h1 className="mt-3 text-4xl font-medium tracking-[0.08em]">DARWIN</h1>
      <p className="mt-4 text-muted">depth 2 · population 12 · generation loop is the next step</p>
      <div className="mt-8 border border-line">
        <div className="grid grid-cols-3 border-b border-line text-[11px] tracking-[0.14em] text-faint uppercase">
          <div className="px-4 py-3">Rapid</div>
          <div className="px-4 py-3">Depth 2</div>
          <div className="px-4 py-3">2,000 nodes</div>
        </div>
        <div className="grid grid-cols-3 text-[11px] tracking-[0.14em] text-faint uppercase">
          <div className="px-4 py-3">Standard</div>
          <div className="px-4 py-3">Depth 3</div>
          <div className="px-4 py-3">8,000 nodes</div>
        </div>
      </div>
      <p className="mt-8 text-sm text-muted">
        {preset === "classic" || preset === "positional"
          ? "This preset does not evolve. Play it on the board."
          : "Darwin plays its first generation in the next step."}
      </p>
      <Link href="/play" className="mt-4 inline-block text-sm text-white opacity-80 hover:opacity-100">
        Play
      </Link>
    </div>
  );
}

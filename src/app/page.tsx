import Link from "next/link";
import { APP_VERSION } from "@/version";

export default function MissionPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl flex-col">
      <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Generation</p>
      <p className="mt-3 text-[80px] leading-none font-medium tracking-tight">00</p>
      <p className="mt-8 text-[11px] tracking-[0.14em] text-faint uppercase">Darwin</p>
      <p className="mt-3 max-w-xl text-muted">
        Self-play under one budget. Evaluations that outscore the anchor carry into the next generation.
      </p>
      <p className="mt-2 text-sm text-faint">depth 2 · population 12 · seed —</p>
      <dl className="mt-12 grid max-w-xl grid-cols-3 gap-6">
        <Stat value="00" label="Generation" />
        <Stat value="—" label="Anchor" />
        <Stat value="—" label="Nodes/s" />
      </dl>
      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/evolve" className="border border-white/40 px-4 py-3 text-sm opacity-80 hover:opacity-100">
          Start evolution
        </Link>
        <span className="border border-white/15 px-4 py-3 text-sm text-faint">Play best</span>
      </div>
      <footer className="mt-auto flex gap-6 pt-16 text-[11px] tracking-[0.14em] text-faint uppercase">
        <span>{APP_VERSION}</span>
        <a className="hover:opacity-100" href="https://github.com/leaf482/chessy/blob/main/docs/plan.md">
          Docs
        </a>
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-[0.14em] text-faint uppercase">{label}</dt>
      <dd className="mt-2 text-3xl font-medium">{value}</dd>
    </div>
  );
}

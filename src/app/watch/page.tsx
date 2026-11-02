import { Board } from "@/components/board";

export default function WatchPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Watch</p>
      <p className="mt-4 text-muted">No games in this generation</p>
      <div className="mt-8">
        <Board board={Array<number>(64).fill(0)} orientation="w" selected={null} targets={[]} lastMove={null} />
      </div>
    </div>
  );
}

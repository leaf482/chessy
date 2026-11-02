"use client";

import { useEffect, useMemo, useState } from "react";
import { Board } from "@/components/board";
import { applyMove, startPosition, uciToMove } from "@/engine/rules";
import type { GameRecord, Run } from "@/engine/types";
import { RUN_EVENT, loadRun } from "@/store/run";

export default function WatchPage() {
  const [ready, setReady] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [generationIndex, setGenerationIndex] = useState(0);
  const [gameIndex, setGameIndex] = useState(0);
  const [ply, setPly] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const read = () => setRun(loadRun());
    read();
    setReady(true);
    window.addEventListener(RUN_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(RUN_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  const generation = run?.generations[generationIndex];
  const game = generation?.games[gameIndex];

  useEffect(() => {
    if (!playing || !game) return;
    const timer = setInterval(() => {
      setPly((current) => (current >= game.moves.length ? current : current + 1));
    }, 600);
    return () => clearInterval(timer);
  }, [playing, game]);

  const position = useMemo(() => replay(game, ply), [game, ply]);
  const last = ply > 0 && game ? moveEnds(game.moves[ply - 1]) : null;

  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Watch</p>
      </div>
    );
  }

  if (!generation || generation.games.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Watch</p>
        <p className="mt-4 text-muted">No games in this generation</p>
        <div className="mt-8">
          <Board board={emptyBoard()} orientation="w" selected={null} targets={[]} lastMove={null} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 min-[960px]:grid-cols-[220px_auto]">
      <div>
        <label className="block text-[11px] tracking-[0.14em] text-faint uppercase">
          Generation
          <select
            className="mt-2 block w-full border border-line bg-black px-2 py-2 text-sm text-white"
            value={generationIndex}
            onChange={(event) => {
              setGenerationIndex(Number(event.target.value));
              setGameIndex(0);
              setPly(0);
              setPlaying(false);
            }}
          >
            {run?.generations.map((record, index) => (
              <option key={record.index} value={index}>
                {record.index}
              </option>
            ))}
          </select>
        </label>
        <ul className="mt-4 max-h-80 overflow-auto text-sm">
          {generation.games.map((entry, index) => (
            <li key={entry.id}>
              <button
                type="button"
                className={`py-1 ${index === gameIndex ? "text-white" : "text-faint"}`}
                onClick={() => {
                  setGameIndex(index);
                  setPly(0);
                  setPlaying(false);
                }}
              >
                {entry.whiteId.slice(0, 8)} {entry.result} {entry.blackId.slice(0, 8)}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <Board board={position.board} orientation="w" selected={null} targets={[]} lastMove={last} />
        <div className="mt-4 flex gap-4 text-sm">
          <button type="button" className="opacity-80 hover:opacity-100" onClick={() => setPly((current) => Math.max(0, current - 1))}>
            Previous
          </button>
          <button
            type="button"
            className="opacity-80 hover:opacity-100"
            onClick={() => setPly((current) => Math.min(game?.moves.length ?? 0, current + 1))}
          >
            Next
          </button>
          <button type="button" className="opacity-80 hover:opacity-100" onClick={() => setPlaying((value) => !value)}>
            {playing ? "Pause" : "Play"}
          </button>
        </div>
        <p className="mt-3 text-sm text-faint">
          {game?.result} · {game?.reason}
        </p>
      </div>
    </div>
  );
}

function emptyBoard(): number[] {
  return Array.from({ length: 64 }, () => 0);
}

function replay(game: GameRecord | undefined, ply: number) {
  let position = startPosition();
  if (!game) return position;
  for (const uci of game.moves.slice(0, ply)) position = applyMove(position, uciToMove(uci));
  return position;
}

function moveEnds(uci: string): { from: number; to: number } {
  const move = uciToMove(uci);
  return { from: move.from, to: move.to };
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Board } from "@/components/board";
import { formatCoordinate, replayMoves, startPosition, uciToMove } from "@/engine/rules";
import type { Run } from "@/engine/types";
import { latestPlayedIndex } from "@/engine/watch";
import { PRESET_EVENT, loadSelectedPreset } from "@/store/preset";
import { RUN_EVENT, loadRunForPreset } from "@/store/run";

export default function WatchPage() {
  const [ready, setReady] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [generationIndex, setGenerationIndex] = useState(0);
  const [gameIndex, setGameIndex] = useState(0);
  const [ply, setPly] = useState(0);
  const [playing, setPlaying] = useState(false);
  const presetKey = useRef<string | null>(null);
  const currentMove = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const read = () => {
      const preset = loadSelectedPreset();
      const next = loadRunForPreset(preset);
      setRun(next);
      if (presetKey.current !== preset) {
        presetKey.current = preset;
        setGenerationIndex(latestPlayedIndex(next?.generations ?? []));
        setGameIndex(0);
        setPly(0);
        setPlaying(false);
      }
    };
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

  const generation = run?.generations[generationIndex];
  const game = generation?.games[gameIndex];

  useEffect(() => {
    if (!playing || !game) return;
    const timer = setInterval(() => {
      setPly((current) => (current >= game.moves.length ? current : current + 1));
    }, 600);
    return () => clearInterval(timer);
  }, [playing, game]);

  useEffect(() => {
    currentMove.current?.scrollIntoView({ block: "nearest" });
  }, [ply, gameIndex, generationIndex]);

  const position = useMemo(() => {
    if (!game) return startPosition();
    return replayMoves(
      game.moves.map((uci) => uciToMove(uci)),
      ply,
    );
  }, [game, ply]);
  const last = ply > 0 && game ? moveEnds(game.moves[ply - 1]) : null;

  function stopAt(nextPly: number) {
    setPly(nextPly);
    setPlaying(false);
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Watch</p>
      </div>
    );
  }

  if (!generation || generation.games.length === 0 || !game) {
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
          <button
            type="button"
            className="opacity-80 hover:opacity-100 disabled:opacity-40"
            disabled={ply === 0}
            onClick={() => stopAt(Math.max(0, ply - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="opacity-80 hover:opacity-100 disabled:opacity-40"
            disabled={ply >= game.moves.length}
            onClick={() => stopAt(Math.min(game.moves.length, ply + 1))}
          >
            Next
          </button>
          <button type="button" className="opacity-80 hover:opacity-100" onClick={() => setPlaying((value) => !value)}>
            {playing ? "Pause" : "Play"}
          </button>
        </div>
        <p className="mt-3 text-sm text-faint">
          {game.result} · {game.reason}
        </p>
        <ol className="mt-4 max-h-48 space-y-1 overflow-auto text-sm">
          {game.moves.map((uci, index) => (
            <li key={`${uci}-${index}`}>
              <button
                ref={index + 1 === ply ? currentMove : undefined}
                type="button"
                className={index + 1 === ply ? "text-white" : "text-muted"}
                onClick={() => stopAt(index + 1)}
              >
                {formatCoordinate(uciToMove(uci))}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function emptyBoard(): number[] {
  return Array.from({ length: 64 }, () => 0);
}

function moveEnds(uci: string): { from: number; to: number } {
  const move = uciToMove(uci);
  return { from: move.from, to: move.to };
}

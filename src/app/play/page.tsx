"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Board } from "@/components/board";
import { PLAY_BUDGET, SURVEYOR_BUDGET, createGenome } from "@/engine/presets";
import {
  WHITE,
  applyMove,
  formatCoordinate,
  gameResult,
  inCheck,
  legalMoves,
  pieceColor,
  positionKey,
  startPosition,
  toFen,
  uciToMove,
} from "@/engine/rules";
import type { GameResult, Genome, Move, Position, Promotion } from "@/engine/types";
import { OPPONENT_EVENT, PRESET_EVENT, loadOpponent, loadSelectedPreset, type SelectedPreset } from "@/store/preset";
import { requestSearch } from "@/worker/client";

const PROMOTIONS: Array<{ id: Promotion; label: string }> = [
  { id: "q", label: "Queen" },
  { id: "r", label: "Rook" },
  { id: "b", label: "Bishop" },
  { id: "n", label: "Knight" },
];

export default function PlayPage() {
  const [preset, setPreset] = useState<SelectedPreset>("classic");
  const [opponent, setOpponent] = useState<Genome | null>(null);
  const [pos, setPos] = useState<Position>(() => startPosition());
  const [history, setHistory] = useState<string[]>(() => [positionKey(startPosition())]);
  const [log, setLog] = useState<Move[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>(null);
  const [orientation, setOrientation] = useState<"w" | "b">("w");
  const [pending, setPending] = useState(false);
  const [end, setEnd] = useState<GameResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ score: number; nodes: number; pv: string[]; tieBreak: boolean } | null>(null);
  const [gameId, setGameId] = useState(0);

  useEffect(() => {
    const read = () => {
      setPreset(loadSelectedPreset());
      setOpponent(loadOpponent());
    };
    read();
    window.addEventListener(PRESET_EVENT, read);
    window.addEventListener(OPPONENT_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(PRESET_EVENT, read);
      window.removeEventListener(OPPONENT_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  useEffect(() => {
    setPos(startPosition());
    setHistory([positionKey(startPosition())]);
    setLog([]);
    setSelected(null);
    setPromo(null);
    setLastMove(null);
    setPending(false);
    setEnd(null);
    setError(null);
    setInfo(null);
  }, [preset, opponent, gameId]);

  const genome = useMemo(() => {
    if (opponent) return opponent;
    if (preset === "classic" || preset === "positional" || preset === "horizon" || preset === "surveyor") return createGenome(preset);
    return null;
  }, [opponent, preset]);
  const searchKind = !opponent && preset === "horizon" ? "horizon" : !opponent && preset === "surveyor" ? "mcts" : "negamax";
  const budget = !opponent && preset === "surveyor" ? SURVEYOR_BUDGET : PLAY_BUDGET;
  const legal = useMemo(() => legalMoves(pos), [pos]);
  const targets = selected === null ? [] : legal.filter((move) => move.from === selected).map((move) => move.to);

  useEffect(() => {
    if (!pending || end || !genome) return;
    let live = true;
    const job = requestSearch({ fen: toFen(pos), genome, budget, seed: 1, search: searchKind });
    job.done
      .then((hit) => {
        if (!live) return;
        applyChoice(uciToMove(hit.move));
        setInfo({ score: hit.score, nodes: hit.nodes, pv: hit.pv, tieBreak: hit.tieBreak });
        setPending(false);
      })
      .catch((reason: Error) => {
        if (!live) return;
        setError(reason.message || "Worker error");
        setPending(false);
      });
    return () => {
      live = false;
      job.cancel();
    };
    // applyChoice closes over the position captured when the search started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, gameId, genome, budget, searchKind]);

  function applyChoice(move: Move) {
    const next = applyMove(pos, move);
    const nextHistory = [...history, positionKey(next)];
    setPos(next);
    setHistory(nextHistory);
    setLog((entries) => [...entries, move]);
    setLastMove({ from: move.from, to: move.to });
    setSelected(null);
    setPromo(null);
    const result = gameResult(next, nextHistory);
    setEnd(result);
    if (!result && next.side === "b") setPending(true);
  }

  function onSquare(square: number) {
    if (pending || end || pos.side !== "w") return;
    if (selected !== null) {
      const options = legal.filter((move) => move.from === selected && move.to === square);
      if (options.length > 1 || options[0]?.promotion) {
        setPromo({ from: selected, to: square });
        return;
      }
      if (options.length === 1) {
        applyChoice(options[0]);
        return;
      }
    }
    const piece = pos.board[square];
    if (piece && pieceColor(piece) === WHITE) setSelected(square);
    else setSelected(null);
  }

  function choosePromotion(promotion: Promotion) {
    if (!promo) return;
    const move = legal.find((entry) => entry.from === promo.from && entry.to === promo.to && entry.promotion === promotion);
    if (move) applyChoice(move);
  }

  if (!genome) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Play</p>
        <p className="mt-4 text-muted">No best individual yet. Run a generation on Evolve.</p>
        <Link href="/evolve" className="mt-4 inline-block text-sm opacity-80 hover:opacity-100">
          Evolve
        </Link>
      </div>
    );
  }

  const label = opponent ? opponent.id : preset;
  const status = end
    ? end.reason
    : pending
      ? "Thinking"
      : inCheck(pos, pos.side)
        ? "Check"
        : pos.side === "w"
          ? "White to move"
          : "Black to move";

  return (
    <div className="mx-auto grid max-w-5xl gap-10 min-[960px]:grid-cols-[auto_280px]">
      <div>
        <Board
          board={pos.board}
          orientation={orientation}
          selected={selected}
          targets={targets}
          lastMove={lastMove}
          onSquare={onSquare}
        />
        {promo ? (
          <div className="mt-4 flex gap-2">
            {PROMOTIONS.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className="border border-white/30 px-3 py-2 text-sm opacity-80 hover:opacity-100"
                onClick={() => choosePromotion(choice.id)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <aside className="border border-line bg-surface p-4">
        <p className="text-[11px] tracking-[0.14em] text-faint uppercase">{label}</p>
        <h1 className="mt-2 text-2xl font-medium capitalize">{label}</h1>
        <p className="mt-6 text-[11px] tracking-[0.14em] text-faint uppercase">Budget</p>
        <p className="mt-2 text-sm text-muted">
          {budget.simulations > 0
            ? `${budget.simulations.toLocaleString("en-US")} simulations`
            : `Depth ${budget.maxDepth} · Nodes ${budget.maxNodes.toLocaleString("en-US")}`}
        </p>
        <p className="mt-6 text-[11px] tracking-[0.14em] text-faint uppercase">Status</p>
        <p className="mt-2 text-sm capitalize">{status}</p>
        {error ? <p className="mt-3 text-sm text-signal">Worker error. {error}</p> : null}
        {error && pos.side === "b" && !end ? (
          <button type="button" className="mt-3 text-sm text-muted opacity-80 hover:opacity-100" onClick={() => { setError(null); setPending(true); }}>
            Retry
          </button>
        ) : null}
        <p className="mt-6 text-[11px] tracking-[0.14em] text-faint uppercase">Last search</p>
        <p className="mt-2 text-sm text-muted">
          {info
            ? `score ${info.score} · nodes ${info.nodes.toLocaleString("en-US")}`
            : "—"}
        </p>
        {info?.tieBreak ? <p className="mt-1 text-sm text-faint">Tie-break</p> : null}
        {info && info.pv.length > 0 ? <p className="mt-2 text-sm break-words text-faint">{info.pv.join(" ")}</p> : null}
        <p className="mt-6 text-[11px] tracking-[0.14em] text-faint uppercase">Game</p>
        <ol className="mt-2 max-h-48 space-y-1 overflow-auto text-sm text-muted">
          {log.length === 0 ? <li className="text-faint">No moves</li> : null}
          {log.map((move, index) => (
            <li key={`${formatCoordinate(move)}-${index}`}>{formatCoordinate(move)}</li>
          ))}
        </ol>
        <div className="mt-6 flex gap-4 text-sm">
          <button
            type="button"
            className="text-muted opacity-80 hover:opacity-100"
            onClick={() => setGameId((value) => value + 1)}
          >
            New game
          </button>
          <button
            type="button"
            className="text-muted opacity-80 hover:opacity-100"
            onClick={() => setOrientation((value) => (value === "w" ? "b" : "w"))}
          >
            Flip board
          </button>
        </div>
      </aside>
    </div>
  );
}

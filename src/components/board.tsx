"use client";

import type { KeyboardEvent } from "react";
import { pieceGlyph, pieceInfo, squareName, stepSquare } from "../engine/rules";

type BoardProps = {
  board: number[];
  orientation: "w" | "b";
  selected: number | null;
  targets: number[];
  lastMove: { from: number; to: number } | null;
  onSquare?: (square: number) => void;
};

export function Board({ board, orientation, selected, targets, lastMove, onSquare = () => {} }: BoardProps) {
  const ranks = orientation === "w" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const files = orientation === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = event.target;
    if (!(current instanceof HTMLButtonElement) || current.dataset.square === undefined) return;
    if (event.key === "Enter") {
      event.preventDefault();
      current.click();
      return;
    }
    const next = stepSquare(Number(current.dataset.square), event.key, orientation);
    if (next === null) return;
    event.preventDefault();
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-square="${next}"]`)?.focus();
  }

  return (
    <div className="w-[min(560px,calc(100vw-32px))]">
      <div className="flex gap-2">
        <div className="flex w-4 flex-col">
          {ranks.map((rank) => (
            <div key={rank} className="flex flex-1 items-center justify-center text-[11px] text-faint">
              {rank + 1}
            </div>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-8" onKeyDown={onKeyDown}>
          {ranks.flatMap((rank) =>
            files.map((file) => {
              const square = rank * 8 + file;
              const piece = board[square] ?? 0;
              const info = pieceInfo(piece);
              const light = (file + rank) % 2 === 1;
              const last = lastMove?.from === square || lastMove?.to === square;
              const isSelected = selected === square;
              const target = targets.includes(square);
              const label = info ? `${squareName(square)} ${info.color} ${info.name}` : squareName(square);
              return (
                <button
                  key={square}
                  type="button"
                  data-square={square}
                  aria-label={label}
                  onClick={() => onSquare(square)}
                  className={`relative flex aspect-square items-center justify-center text-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${light ? "bg-board-light" : "bg-board-dark"} ${isSelected ? "outline outline-1 outline-white" : ""}`}
                  style={last ? { boxShadow: "inset 0 0 0 1px #d6e4ff" } : undefined}
                >
                  {target && !piece ? <span className="h-2 w-2 bg-white/50" /> : null}
                  {target && piece ? <span className="pointer-events-none absolute inset-1 border border-white/50" /> : null}
                  {piece ? (
                    <span
                      className={info?.color === "white" ? "text-white" : "text-black"}
                      style={{ textShadow: info?.color === "white" ? "0 0 1px #111" : "0 0 1px #fff" }}
                    >
                      {pieceGlyph(piece)}
                    </span>
                  ) : null}
                </button>
              );
            }),
          )}
        </div>
      </div>
      <div className="mt-1 flex gap-2">
        <div className="w-4" />
        <div className="grid flex-1 grid-cols-8">
          {files.map((file) => (
            <div key={file} className="text-center text-[11px] text-faint">
              {"abcdefgh"[file]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

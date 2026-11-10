import { describe, expect, it } from "vitest";
import {
  applyMove,
  gameResult,
  legalMoves,
  moveToUci,
  parseFen,
  parseSquare,
  replayMoves,
  stepSquare,
  uciToMove,
  perft,
  positionKey,
  startPosition,
  toFen,
} from "./rules";

describe("rules", () => {
  it("round-trips the starting FEN", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(toFen(parseFen(fen))).toBe(fen);
  });

  it("matches published perft counts", () => {
    const start = startPosition();
    expect(perft(start, 1)).toBe(20);
    expect(perft(start, 2)).toBe(400);
    expect(perft(start, 3)).toBe(8902);

    const kiwipete = parseFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
    expect(perft(kiwipete, 1)).toBe(48);
    expect(perft(kiwipete, 2)).toBe(2039);

    const position3 = parseFen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1");
    expect(perft(position3, 1)).toBe(14);
    expect(perft(position3, 2)).toBe(191);
    expect(perft(position3, 3)).toBe(2812);
  });

  it("plays en passant and removes the captured pawn", () => {
    const pos = parseFen("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    const ep = legalMoves(pos).find((move) => moveToUci(move) === "e5d6");
    expect(ep).toBeTruthy();
    const next = applyMove(pos, ep!);
    expect(next.board[43]).not.toBe(0);
    expect(next.board[35]).toBe(0);
    expect(next.side).toBe("b");
  });

  it("castles only through safe squares", () => {
    const open = parseFen("4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    const openUci = legalMoves(open).map(moveToUci);
    expect(openUci).toContain("e1g1");
    expect(openUci).toContain("e1c1");

    const throughCheck = parseFen("4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1");
    const blocked = legalMoves(throughCheck).map(moveToUci);
    expect(blocked).not.toContain("e1g1");
    expect(blocked).toContain("e1c1");
  });

  it("promotes to four pieces", () => {
    const pos = parseFen("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
    const moves = legalMoves(pos).map(moveToUci);
    expect(moves).toEqual(expect.arrayContaining(["a7a8q", "a7a8r", "a7a8b", "a7a8n"]));
  });

  it("ends games on mate, stalemate, the fifty-move rule, and threefold repetition", () => {
    const mate = parseFen("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1");
    const mating = legalMoves(mate).find((move) => moveToUci(move) === "f7h7");
    const mated = applyMove(mate, mating!);
    expect(gameResult(mated, [positionKey(mated)])).toEqual({ result: "1-0", reason: "checkmate" });

    const stalemate = parseFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(gameResult(stalemate, [positionKey(stalemate)])).toEqual({
      result: "1/2-1/2",
      reason: "stalemate",
    });

    const fifty = parseFen("4k3/8/8/8/8/8/8/4K3 w - - 100 80");
    expect(gameResult(fifty, [positionKey(fifty)])?.reason).toBe("fifty-move");

    const key = positionKey(startPosition());
    expect(gameResult(startPosition(), [key, key, key])?.reason).toBe("threefold");
  });

  it("replays a prefix of the move list", () => {
    const moves = [uciToMove("e2e4"), uciToMove("e7e5")];
    const first = applyMove(startPosition(), moves[0]);
    const second = applyMove(first, moves[1]);
    expect(replayMoves(moves, 0)).toEqual(startPosition());
    expect(replayMoves(moves, 1)).toEqual(first);
    expect(replayMoves(moves, 2)).toEqual(second);
    expect(replayMoves(moves, 9)).toEqual(second);
    expect(replayMoves([], 1)).toEqual(startPosition());
  });

  it("steps one square in the direction on screen", () => {
    expect(stepSquare(parseSquare("e2"), "ArrowUp", "w")).toBe(parseSquare("e3"));
    expect(stepSquare(parseSquare("e2"), "ArrowRight", "w")).toBe(parseSquare("f2"));
    expect(stepSquare(parseSquare("e2"), "ArrowUp", "b")).toBe(parseSquare("e1"));
    expect(stepSquare(parseSquare("d4"), "ArrowLeft", "b")).toBe(parseSquare("e4"));
    expect(stepSquare(parseSquare("a1"), "ArrowLeft", "w")).toBe(parseSquare("a1"));
    expect(stepSquare(parseSquare("h8"), "ArrowUp", "w")).toBe(parseSquare("h8"));
    expect(stepSquare(parseSquare("e2"), "Enter", "w")).toBeNull();
  });
});

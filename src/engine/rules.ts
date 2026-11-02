import type { Color, GameResult, Move, PieceType, Position, Promotion } from "./types";

export const WHITE = 0;
export const BLACK = 1;
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

export const WK = 1;
export const WQ = 2;
export const BK = 4;
export const BQ = 8;

const PROMOTIONS: Promotion[] = ["q", "r", "b", "n"];
const PROMO_TYPE: Record<Promotion, number> = { q: QUEEN, r: ROOK, b: BISHOP, n: KNIGHT };
const TYPE_CHAR = ["", "p", "n", "b", "r", "q", "k"];
const NAME = ["", "pawn", "knight", "bishop", "rook", "queen", "king"];

const KNIGHT_DELTAS: Array<[number, number]> = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

const KING_DELTAS: Array<[number, number]> = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

const BISHOP_DIRS: Array<[number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const ROOK_DIRS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function encode(color: number, type: number): number {
  return (color << 3) | type;
}

export function pieceColor(piece: number): number {
  return piece >> 3;
}

export function pieceType(piece: number): number {
  return piece & 7;
}

export function squareName(square: number): string {
  return "abcdefgh"[square & 7] + String((square >> 3) + 1);
}

export function parseSquare(text: string): number {
  return text.charCodeAt(0) - 97 + (text.charCodeAt(1) - 49) * 8;
}

export function moveToUci(move: Move): string {
  return squareName(move.from) + squareName(move.to) + (move.promotion ?? "");
}

export function uciToMove(uci: string): Move {
  const promotion = uci[4] as Promotion | undefined;
  return {
    from: parseSquare(uci.slice(0, 2)),
    to: parseSquare(uci.slice(2, 4)),
    promotion: promotion && promotion in PROMO_TYPE ? promotion : undefined,
  };
}

export function formatCoordinate(move: Move): string {
  const base = `${squareName(move.from)}-${squareName(move.to)}`;
  return move.promotion ? `${base}${move.promotion}` : base;
}

export function pieceInfo(piece: number): { color: "white" | "black"; name: string } | null {
  if (!piece) return null;
  return {
    color: pieceColor(piece) === WHITE ? "white" : "black",
    name: NAME[pieceType(piece)] ?? "piece",
  };
}

export function pieceGlyph(piece: number): string {
  const glyphs = ["", "♙", "♘", "♗", "♖", "♕", "♔"];
  return glyphs[pieceType(piece)] ?? "";
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function startPosition(): Position {
  return parseFen(START_FEN);
}

export function parseFen(fen: string): Position {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) throw new Error(`Invalid FEN: ${fen}`);
  const [placement, side, castling, ep, half = "0", full = "1"] = parts;
  const ranks = placement.split("/");
  if (ranks.length !== 8) throw new Error(`Invalid FEN: ${fen}`);
  const board = Array<number>(64).fill(0);
  for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) {
    let file = 0;
    for (const char of ranks[rankIndex]) {
      const skip = char >= "1" && char <= "8" ? Number(char) : 0;
      if (skip) {
        file += skip;
        continue;
      }
      const type = TYPE_CHAR.indexOf(char.toLowerCase());
      if (type < 1 || file > 7) throw new Error(`Invalid FEN: ${fen}`);
      const color = char === char.toUpperCase() ? WHITE : BLACK;
      board[(7 - rankIndex) * 8 + file] = encode(color, type);
      file += 1;
    }
    if (file !== 8) throw new Error(`Invalid FEN: ${fen}`);
  }
  let rights = 0;
  if (castling.includes("K")) rights |= WK;
  if (castling.includes("Q")) rights |= WQ;
  if (castling.includes("k")) rights |= BK;
  if (castling.includes("q")) rights |= BQ;
  return {
    board,
    side: side === "b" ? "b" : "w",
    castling: rights,
    ep: ep === "-" ? -1 : parseSquare(ep),
    halfmove: Number(half),
    fullmove: Number(full),
  };
}

export function toFen(pos: Position): string {
  const ranks: string[] = [];
  for (let rank = 7; rank >= 0; rank -= 1) {
    let row = "";
    let empty = 0;
    for (let file = 0; file < 8; file += 1) {
      const piece = pos.board[rank * 8 + file];
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty) {
        row += String(empty);
        empty = 0;
      }
      const char = TYPE_CHAR[pieceType(piece)];
      row += pieceColor(piece) === WHITE ? char.toUpperCase() : char;
    }
    if (empty) row += String(empty);
    ranks.push(row);
  }
  let rights = "";
  if (pos.castling & WK) rights += "K";
  if (pos.castling & WQ) rights += "Q";
  if (pos.castling & BK) rights += "k";
  if (pos.castling & BQ) rights += "q";
  if (!rights) rights = "-";
  return `${ranks.join("/")} ${pos.side} ${rights} ${pos.ep < 0 ? "-" : squareName(pos.ep)} ${pos.halfmove} ${pos.fullmove}`;
}

export function positionKey(pos: Position): string {
  return toFen(pos).split(" ").slice(0, 4).join(" ");
}

function findKing(board: number[], color: number): number {
  const target = encode(color, KING);
  for (let square = 0; square < 64; square += 1) {
    if (board[square] === target) return square;
  }
  return -1;
}

function onBoard(file: number, rank: number): boolean {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

export function isAttacked(board: number[], square: number, by: number): boolean {
  const file = square & 7;
  const rank = square >> 3;

  for (const [df, dr] of KNIGHT_DELTAS) {
    const nextFile = file + df;
    const nextRank = rank + dr;
    if (!onBoard(nextFile, nextRank)) continue;
    const piece = board[nextRank * 8 + nextFile];
    if (piece && pieceColor(piece) === by && pieceType(piece) === KNIGHT) return true;
  }

  for (const [df, dr] of KING_DELTAS) {
    const nextFile = file + df;
    const nextRank = rank + dr;
    if (!onBoard(nextFile, nextRank)) continue;
    const piece = board[nextRank * 8 + nextFile];
    if (piece && pieceColor(piece) === by && pieceType(piece) === KING) return true;
  }

  if (by === WHITE) {
    if (file > 0) {
      const from = square - 9;
      if (from >= 0 && board[from] === encode(WHITE, PAWN)) return true;
    }
    if (file < 7) {
      const from = square - 7;
      if (from >= 0 && board[from] === encode(WHITE, PAWN)) return true;
    }
  } else {
    if (file > 0) {
      const from = square + 7;
      if (from < 64 && board[from] === encode(BLACK, PAWN)) return true;
    }
    if (file < 7) {
      const from = square + 9;
      if (from < 64 && board[from] === encode(BLACK, PAWN)) return true;
    }
  }

  const rays: Array<Array<[number, number]>> = [BISHOP_DIRS, ROOK_DIRS];
  const rayTypes = [
    [BISHOP, QUEEN],
    [ROOK, QUEEN],
  ];
  for (let group = 0; group < rays.length; group += 1) {
    for (const [df, dr] of rays[group]) {
      let nextFile = file + df;
      let nextRank = rank + dr;
      while (onBoard(nextFile, nextRank)) {
        const piece = board[nextRank * 8 + nextFile];
        if (piece) {
          if (pieceColor(piece) === by && rayTypes[group].includes(pieceType(piece))) return true;
          break;
        }
        nextFile += df;
        nextRank += dr;
      }
    }
  }
  return false;
}

export function inCheck(pos: Position, color: Color): boolean {
  const numeric = color === "w" ? WHITE : BLACK;
  const king = findKing(pos.board, numeric);
  if (king < 0) return false;
  return isAttacked(pos.board, king, numeric === WHITE ? BLACK : WHITE);
}

function pushPawnMoves(
  moves: Move[],
  from: number,
  to: number,
  promote: boolean,
): void {
  if (!promote) {
    moves.push({ from, to });
    return;
  }
  for (const promotion of PROMOTIONS) moves.push({ from, to, promotion });
}

function pseudoMoves(pos: Position): Move[] {
  const moves: Move[] = [];
  const color = pos.side === "w" ? WHITE : BLACK;
  const board = pos.board;
  for (let from = 0; from < 64; from += 1) {
    const piece = board[from];
    if (!piece || pieceColor(piece) !== color) continue;
    const type = pieceType(piece);
    const file = from & 7;
    const rank = from >> 3;
    if (type === PAWN) {
      const forward = color === WHITE ? 8 : -8;
      const startRank = color === WHITE ? 1 : 6;
      const promoRank = color === WHITE ? 6 : 1;
      const one = from + forward;
      if (board[one] === 0) {
        pushPawnMoves(moves, from, one, rank === promoRank);
        const two = from + forward * 2;
        if (rank === startRank && board[two] === 0) moves.push({ from, to: two });
      }
      const captureOffsets = color === WHITE ? [7, 9] : [-9, -7];
      const captureFiles = [file - 1, file + 1];
      for (let index = 0; index < 2; index += 1) {
        if (captureFiles[index] < 0 || captureFiles[index] > 7) continue;
        const to = from + captureOffsets[index];
        const target = board[to];
        if (target && pieceColor(target) !== color) pushPawnMoves(moves, from, to, rank === promoRank);
        if (pos.ep === to) moves.push({ from, to });
      }
      continue;
    }
    if (type === KNIGHT) {
      addLeapers(moves, board, from, color, KNIGHT_DELTAS);
      continue;
    }
    if (type === BISHOP || type === ROOK || type === QUEEN) {
      const dirs = type === BISHOP ? BISHOP_DIRS : type === ROOK ? ROOK_DIRS : [...BISHOP_DIRS, ...ROOK_DIRS];
      for (const [df, dr] of dirs) addRay(moves, board, from, color, df, dr);
      continue;
    }
    if (type === KING) {
      addLeapers(moves, board, from, color, KING_DELTAS);
      addCastling(moves, pos, from, color);
    }
  }
  return moves;
}

function addLeapers(
  moves: Move[],
  board: number[],
  from: number,
  color: number,
  deltas: Array<[number, number]>,
): void {
  const file = from & 7;
  const rank = from >> 3;
  for (const [df, dr] of deltas) {
    const nextFile = file + df;
    const nextRank = rank + dr;
    if (!onBoard(nextFile, nextRank)) continue;
    const to = nextRank * 8 + nextFile;
    const target = board[to];
    if (target && pieceColor(target) === color) continue;
    moves.push({ from, to });
  }
}

function addRay(
  moves: Move[],
  board: number[],
  from: number,
  color: number,
  df: number,
  dr: number,
): void {
  let file = (from & 7) + df;
  let rank = (from >> 3) + dr;
  while (onBoard(file, rank)) {
    const to = rank * 8 + file;
    const target = board[to];
    if (!target) moves.push({ from, to });
    else {
      if (pieceColor(target) !== color) moves.push({ from, to });
      break;
    }
    file += df;
    rank += dr;
  }
}

function addCastling(moves: Move[], pos: Position, from: number, color: number): void {
  const board = pos.board;
  const enemy = color === WHITE ? BLACK : WHITE;
  if (color === WHITE && from === 4) {
    if (
      pos.castling & WK &&
      board[5] === 0 &&
      board[6] === 0 &&
      board[7] === encode(WHITE, ROOK) &&
      !isAttacked(board, 4, enemy) &&
      !isAttacked(board, 5, enemy) &&
      !isAttacked(board, 6, enemy)
    ) {
      moves.push({ from: 4, to: 6 });
    }
    if (
      pos.castling & WQ &&
      board[1] === 0 &&
      board[2] === 0 &&
      board[3] === 0 &&
      board[0] === encode(WHITE, ROOK) &&
      !isAttacked(board, 4, enemy) &&
      !isAttacked(board, 3, enemy) &&
      !isAttacked(board, 2, enemy)
    ) {
      moves.push({ from: 4, to: 2 });
    }
  }
  if (color === BLACK && from === 60) {
    if (
      pos.castling & BK &&
      board[61] === 0 &&
      board[62] === 0 &&
      board[63] === encode(BLACK, ROOK) &&
      !isAttacked(board, 60, enemy) &&
      !isAttacked(board, 61, enemy) &&
      !isAttacked(board, 62, enemy)
    ) {
      moves.push({ from: 60, to: 62 });
    }
    if (
      pos.castling & BQ &&
      board[57] === 0 &&
      board[58] === 0 &&
      board[59] === 0 &&
      board[56] === encode(BLACK, ROOK) &&
      !isAttacked(board, 60, enemy) &&
      !isAttacked(board, 59, enemy) &&
      !isAttacked(board, 58, enemy)
    ) {
      moves.push({ from: 60, to: 58 });
    }
  }
}

export function applyMove(pos: Position, move: Move): Position {
  const board = pos.board.slice();
  const mover = board[move.from];
  const color = pieceColor(mover);
  const type = pieceType(mover);
  const target = board[move.to];
  const epCapture = type === PAWN && target === 0 && (move.from & 7) !== (move.to & 7);

  board[move.from] = 0;
  if (epCapture) {
    const captured = color === WHITE ? move.to - 8 : move.to + 8;
    board[captured] = 0;
  }
  board[move.to] = move.promotion ? encode(color, PROMO_TYPE[move.promotion]) : mover;

  if (type === KING && Math.abs((move.to & 7) - (move.from & 7)) === 2) {
    if (move.to === 6) {
      board[5] = board[7];
      board[7] = 0;
    } else if (move.to === 2) {
      board[3] = board[0];
      board[0] = 0;
    } else if (move.to === 62) {
      board[61] = board[63];
      board[63] = 0;
    } else if (move.to === 58) {
      board[59] = board[56];
      board[56] = 0;
    }
  }

  let castling = pos.castling;
  if (type === KING) castling &= color === WHITE ? ~(WK | WQ) : ~(BK | BQ);
  if (move.from === 0 || move.to === 0) castling &= ~WQ;
  if (move.from === 7 || move.to === 7) castling &= ~WK;
  if (move.from === 56 || move.to === 56) castling &= ~BQ;
  if (move.from === 63 || move.to === 63) castling &= ~BK;

  const ep =
    type === PAWN && Math.abs(move.to - move.from) === 16
      ? color === WHITE
        ? move.from + 8
        : move.from - 8
      : -1;

  return {
    board,
    side: color === WHITE ? "b" : "w",
    castling,
    ep,
    halfmove: type === PAWN || target !== 0 || epCapture ? 0 : pos.halfmove + 1,
    fullmove: color === BLACK ? pos.fullmove + 1 : pos.fullmove,
  };
}

export function legalMoves(pos: Position): Move[] {
  const legal: Move[] = [];
  for (const move of pseudoMoves(pos)) {
    const next = applyMove(pos, move);
    if (!inCheck(next, pos.side)) legal.push(move);
  }
  return legal;
}

export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const move of moves) nodes += perft(applyMove(pos, move), depth - 1);
  return nodes;
}

export function perftDivide(pos: Position, depth: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const move of legalMoves(pos)) {
    out[moveToUci(move)] = depth === 1 ? 1 : perft(applyMove(pos, move), depth - 1);
  }
  return out;
}

function insufficient(pos: Position): boolean {
  const minors: number[] = [];
  for (const piece of pos.board) {
    if (!piece) continue;
    const type = pieceType(piece);
    if (type === KING) continue;
    if (type !== KNIGHT && type !== BISHOP) return false;
    minors.push(piece);
  }
  if (minors.length === 0) return true;
  if (minors.length === 1) return true;
  if (minors.length === 2 && minors.every((piece) => pieceType(piece) === BISHOP)) {
    const squares = pos.board.flatMap((piece, square) => (piece && pieceType(piece) === BISHOP ? [square] : []));
    return ((squares[0] & 7) + (squares[0] >> 3)) % 2 === ((squares[1] & 7) + (squares[1] >> 3)) % 2;
  }
  return false;
}

export function gameResult(pos: Position, history: string[]): GameResult | null {
  const moves = legalMoves(pos);
  if (moves.length === 0) {
    if (inCheck(pos, pos.side)) {
      return { result: pos.side === "w" ? "0-1" : "1-0", reason: "checkmate" };
    }
    return { result: "1/2-1/2", reason: "stalemate" };
  }
  if (pos.halfmove >= 100) return { result: "1/2-1/2", reason: "fifty-move" };
  const key = positionKey(pos);
  if (history.filter((entry) => entry === key).length >= 3) {
    return { result: "1/2-1/2", reason: "threefold" };
  }
  if (insufficient(pos)) return { result: "1/2-1/2", reason: "insufficient" };
  return null;
}

export function pieceTypeChar(type: PieceType): string {
  return type;
}

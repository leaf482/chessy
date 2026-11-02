import type { Genome } from "../engine/types";
import { parseOpponent } from "./run";

const KEY = "chessy.preset.v1";
const OPPONENT_KEY = "chessy.opponent.v1";
export const PRESET_EVENT = "chessy-preset";
export const OPPONENT_EVENT = "chessy-opponent";

export type SelectedPreset = "classic" | "positional" | "darwin" | "horizon" | "surveyor";

export function loadSelectedPreset(): SelectedPreset {
  if (typeof window === "undefined") return "classic";
  const value = localStorage.getItem(KEY);
  if (value === "positional" || value === "darwin" || value === "horizon" || value === "surveyor") return value;
  return "classic";
}

export function saveSelectedPreset(id: SelectedPreset): void {
  localStorage.setItem(KEY, id);
  if (id !== "darwin") localStorage.removeItem(OPPONENT_KEY);
  window.dispatchEvent(new Event(PRESET_EVENT));
  window.dispatchEvent(new Event(OPPONENT_EVENT));
}

export function loadOpponent(): Genome | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(OPPONENT_KEY);
  if (!raw) return null;
  try {
    return parseOpponent(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveOpponent(genome: Genome): void {
  localStorage.setItem(OPPONENT_KEY, JSON.stringify(genome));
  window.dispatchEvent(new Event(OPPONENT_EVENT));
}

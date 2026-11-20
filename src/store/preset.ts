import { isNetworkGenome } from "../engine/network";
import type { AnyGenome } from "../engine/types";
import { parseOpponent } from "./run";

const KEY = "chessy.preset.v1";
const OPPONENT_KEY = "chessy.opponent.v1";
export const PRESET_EVENT = "chessy-preset";
export const OPPONENT_EVENT = "chessy-opponent";

export type SelectedPreset = "classic" | "positional" | "darwin" | "horizon" | "surveyor" | "synapse" | "pilot";

export function loadSelectedPreset(): SelectedPreset {
  if (typeof window === "undefined") return "classic";
  const value = localStorage.getItem(KEY);
  if (value === "positional" || value === "darwin" || value === "horizon" || value === "surveyor" || value === "synapse" || value === "pilot") return value;
  return "classic";
}

export function keepOpponent(id: SelectedPreset, opponent: AnyGenome | null): boolean {
  if (!opponent) return false;
  const network = isNetworkGenome(opponent);
  const classic = !network && opponent.presetId === "classic";
  const pilot = !network && opponent.presetId === "pilot";
  if (id === "synapse") return network || classic;
  if (id === "pilot") return pilot || classic;
  if (id === "darwin") return !network && !pilot;
  return false;
}

export function saveSelectedPreset(id: SelectedPreset): void {
  localStorage.setItem(KEY, id);
  if (!keepOpponent(id, loadOpponent())) localStorage.removeItem(OPPONENT_KEY);
  window.dispatchEvent(new Event(PRESET_EVENT));
  window.dispatchEvent(new Event(OPPONENT_EVENT));
}

export function loadOpponent(): AnyGenome | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(OPPONENT_KEY);
  if (!raw) return null;
  try {
    return parseOpponent(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveOpponent(genome: AnyGenome): void {
  localStorage.setItem(OPPONENT_KEY, JSON.stringify(genome));
  window.dispatchEvent(new Event(OPPONENT_EVENT));
}

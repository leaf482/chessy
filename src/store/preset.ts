import { isPlayablePreset } from "../engine/presets";

const KEY = "chessy.preset.v1";
export const PRESET_EVENT = "chessy-preset";

export type PlayPresetId = "classic" | "positional";

export function loadPlayPreset(): PlayPresetId {
  if (typeof window === "undefined") return "classic";
  const value = localStorage.getItem(KEY);
  return value === "positional" ? "positional" : "classic";
}

export function savePlayPreset(id: PlayPresetId): void {
  if (!isPlayablePreset(id)) return;
  localStorage.setItem(KEY, id);
  window.dispatchEvent(new Event(PRESET_EVENT));
}

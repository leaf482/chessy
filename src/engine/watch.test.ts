import { describe, expect, it } from "vitest";
import { latestPlayedIndex } from "./watch";

describe("watch", () => {
  it("selects the last generation that played a game", () => {
    expect(latestPlayedIndex([])).toBe(0);
    expect(latestPlayedIndex([{ games: [] }, { games: [] }])).toBe(0);
    expect(latestPlayedIndex([{ games: ["a"] }, { games: [] }, { games: ["b"] }, { games: [] }])).toBe(2);
  });
});

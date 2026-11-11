import { describe, expect, it } from "vitest";
import { createNetworkGenome } from "../engine/network";
import { createGenome, createPilotPrior } from "../engine/presets";
import { keepOpponent } from "./preset";

describe("keepOpponent", () => {
  it("keeps a Classic override on Darwin, Synapse, and Pilot", () => {
    const classic = createGenome("classic");
    expect(keepOpponent("darwin", classic)).toBe(true);
    expect(keepOpponent("synapse", classic)).toBe(true);
    expect(keepOpponent("pilot", classic)).toBe(true);
    expect(keepOpponent("classic", classic)).toBe(false);
    expect(keepOpponent("horizon", classic)).toBe(false);
  });

  it("keeps each evolvable opponent on its own preset only", () => {
    const darwin = { ...createGenome("positional"), id: "gene-1-00", presetId: "darwin" as const };
    const network = createNetworkGenome(1);
    const pilot = createPilotPrior();
    expect(keepOpponent("darwin", darwin)).toBe(true);
    expect(keepOpponent("synapse", darwin)).toBe(false);
    expect(keepOpponent("synapse", network)).toBe(true);
    expect(keepOpponent("darwin", network)).toBe(false);
    expect(keepOpponent("pilot", pilot)).toBe(true);
    expect(keepOpponent("darwin", pilot)).toBe(false);
  });
});

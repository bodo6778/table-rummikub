import { describe, it, expect } from "vitest";
import {
  isValidRun,
  isValidGroup,
  isValidMeld,
  areAllMeldsValid,
  canAnnounceWin,
} from "./validation";
import type { Tile, Meld } from "../types";

function tile(id: string, color: Tile["color"], number: number): Tile {
  return { id, color, number, isJoker: false };
}

function joker(id: string): Tile {
  return { id, color: "red", number: 0, isJoker: true };
}

function meld(id: string, tiles: Tile[]): Meld {
  return { id, tiles };
}

describe("isValidRun (client)", () => {
  it("accepts a simple 3-tile run", () => {
    expect(isValidRun([tile("r1", "red", 1), tile("r2", "red", 2), tile("r3", "red", 3)])).toBe(true);
  });

  it("rejects run with fewer than 3 tiles", () => {
    expect(isValidRun([tile("r1", "red", 1), tile("r2", "red", 2)])).toBe(false);
  });

  it("rejects run with mixed colors", () => {
    expect(isValidRun([tile("r1", "red", 1), tile("b2", "blue", 2), tile("r3", "red", 3)])).toBe(false);
  });

  it("rejects run with a gap and no joker", () => {
    expect(isValidRun([tile("r1", "red", 1), tile("r2", "red", 2), tile("r4", "red", 4)])).toBe(false);
  });

  it("accepts run with joker filling a gap", () => {
    expect(isValidRun([tile("r1", "red", 1), joker("j0"), tile("r3", "red", 3)])).toBe(true);
  });

  it("accepts run with joker at the start", () => {
    expect(isValidRun([joker("j0"), tile("r2", "red", 2), tile("r3", "red", 3)])).toBe(true);
  });

  it("accepts run with joker at the end", () => {
    expect(isValidRun([tile("r1", "red", 1), tile("r2", "red", 2), joker("j0")])).toBe(true);
  });

  it("rejects all-joker run", () => {
    expect(isValidRun([joker("j0"), joker("j1"), joker("j2")])).toBe(false);
  });

  it("rejects run with duplicate numbers", () => {
    expect(isValidRun([tile("r1a", "red", 1), tile("r1b", "red", 1), tile("r2", "red", 2)])).toBe(false);
  });

  it("accepts a longer run (5 tiles)", () => {
    expect(
      isValidRun([
        tile("b3", "blue", 3),
        tile("b4", "blue", 4),
        tile("b5", "blue", 5),
        tile("b6", "blue", 6),
        tile("b7", "blue", 7),
      ])
    ).toBe(true);
  });

  it("rejects a run where jokers can't fill all internal gaps", () => {
    // sorted=[1,5]: neededForGaps=3, jokerCount=1 → 3 > 1 → false
    expect(isValidRun([tile("r1", "red", 1), joker("j0"), tile("r5", "red", 5)])).toBe(false);
  });

  it("accepts a run with two jokers extending the sequence", () => {
    expect(isValidRun([tile("r1", "red", 1), tile("r2", "red", 2), joker("j0"), joker("j1")])).toBe(true);
  });

  it("accepts a run where a joker extends to 13", () => {
    expect(isValidRun([tile("r11", "red", 11), tile("r12", "red", 12), joker("j0")])).toBe(true);
  });
});

describe("isValidGroup (client)", () => {
  it("accepts a 3-tile group with different colors", () => {
    expect(
      isValidGroup([tile("r7", "red", 7), tile("b7", "blue", 7), tile("y7", "yellow", 7)])
    ).toBe(true);
  });

  it("accepts a 4-tile group with all 4 colors", () => {
    expect(
      isValidGroup([
        tile("r7", "red", 7),
        tile("b7", "blue", 7),
        tile("y7", "yellow", 7),
        tile("k7", "black", 7),
      ])
    ).toBe(true);
  });

  it("rejects group with fewer than 3 tiles", () => {
    expect(isValidGroup([tile("r7", "red", 7), tile("b7", "blue", 7)])).toBe(false);
  });

  it("rejects group with 5 tiles", () => {
    expect(
      isValidGroup([
        tile("r7", "red", 7),
        tile("b7", "blue", 7),
        tile("y7", "yellow", 7),
        tile("k7", "black", 7),
        joker("j0"),
      ])
    ).toBe(false);
  });

  it("rejects group with duplicate colors", () => {
    expect(
      isValidGroup([tile("r7a", "red", 7), tile("r7b", "red", 7), tile("b7", "blue", 7)])
    ).toBe(false);
  });

  it("rejects group with different numbers", () => {
    expect(
      isValidGroup([tile("r7", "red", 7), tile("b8", "blue", 8), tile("y7", "yellow", 7)])
    ).toBe(false);
  });

  it("accepts group with a joker", () => {
    expect(
      isValidGroup([tile("r7", "red", 7), tile("b7", "blue", 7), joker("j0")])
    ).toBe(true);
  });
});

describe("isValidMeld (client)", () => {
  it("returns true for valid run", () => {
    expect(isValidMeld([tile("r1", "red", 1), tile("r2", "red", 2), tile("r3", "red", 3)])).toBe(true);
  });

  it("returns true for valid group", () => {
    expect(
      isValidMeld([tile("r7", "red", 7), tile("b7", "blue", 7), tile("y7", "yellow", 7)])
    ).toBe(true);
  });

  it("returns false for invalid tiles", () => {
    expect(isValidMeld([tile("r1", "red", 1), tile("b7", "blue", 7)])).toBe(false);
  });
});

describe("areAllMeldsValid (client)", () => {
  it("returns true when all melds are valid", () => {
    const melds: Meld[] = [
      meld("m1", [tile("r1", "red", 1), tile("r2", "red", 2), tile("r3", "red", 3)]),
      meld("m2", [tile("r7", "red", 7), tile("b7", "blue", 7), tile("y7", "yellow", 7)]),
    ];
    expect(areAllMeldsValid(melds)).toBe(true);
  });

  it("returns false when one meld is invalid", () => {
    const melds: Meld[] = [
      meld("m1", [tile("r1", "red", 1), tile("r2", "red", 2), tile("r3", "red", 3)]),
      meld("m2", [tile("r1", "red", 1), tile("b7", "blue", 7)]),
    ];
    expect(areAllMeldsValid(melds)).toBe(false);
  });

  it("returns true for empty array", () => {
    expect(areAllMeldsValid([])).toBe(true);
  });
});

describe("canAnnounceWin (client)", () => {
  it("returns true when all rack tiles are in valid melds", () => {
    const rack: Tile[] = [
      tile("r1", "red", 1),
      tile("r2", "red", 2),
      tile("r3", "red", 3),
      tile("b5", "blue", 5),
      tile("y5", "yellow", 5),
      tile("k5", "black", 5),
    ];
    const melds: Meld[] = [
      meld("m1", [rack[0], rack[1], rack[2]]),
      meld("m2", [rack[3], rack[4], rack[5]]),
    ];
    expect(canAnnounceWin(rack, melds)).toBe(true);
  });

  it("returns false when meld tile count doesn't match rack", () => {
    const rack: Tile[] = [tile("r1", "red", 1), tile("r2", "red", 2), tile("r3", "red", 3)];
    const melds: Meld[] = [meld("m1", [rack[0], rack[1]])]; // missing one tile
    expect(canAnnounceWin(rack, melds)).toBe(false);
  });

  it("returns false when melds are invalid", () => {
    const rack: Tile[] = [tile("r1", "red", 1), tile("b7", "blue", 7)];
    const melds: Meld[] = [meld("m1", rack)];
    expect(canAnnounceWin(rack, melds)).toBe(false);
  });

  it("returns false when melds cover more tiles than the rack", () => {
    const rack: Tile[] = [tile("r1", "red", 1), tile("r2", "red", 2), tile("r3", "red", 3)];
    const extra = tile("r4", "red", 4);
    const melds: Meld[] = [meld("m1", [...rack, extra])]; // 4 tiles in meld, 3 in rack
    expect(canAnnounceWin(rack, melds)).toBe(false);
  });
});

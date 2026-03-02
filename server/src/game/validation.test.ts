import { describe, it, expect } from "vitest";
import {
  isValidRun,
  isValidGroup,
  isValidMeld,
  areAllMeldsValid,
  verifyTilesMatch,
  canAnnounceWin,
} from "./validation.js";
import type { Tile, Meld } from "../../types/index.js";

function tile(id: string, color: Tile["color"], number: number): Tile {
  return { id, color, number, isJoker: false };
}

function joker(id: string): Tile {
  return { id, color: "red", number: 0, isJoker: true };
}

function meld(id: string, tiles: Tile[]): Meld {
  return { id, tiles };
}

describe("isValidRun", () => {
  it("accepts a simple 3-tile run", () => {
    expect(isValidRun([tile("r1", "red", 1), tile("r2", "red", 2), tile("r3", "red", 3)])).toBe(true);
  });

  it("accepts a longer run", () => {
    expect(
      isValidRun([
        tile("r5", "red", 5),
        tile("r6", "red", 6),
        tile("r7", "red", 7),
        tile("r8", "red", 8),
      ])
    ).toBe(true);
  });

  it("rejects a run shorter than 3", () => {
    expect(isValidRun([tile("r1", "red", 1), tile("r2", "red", 2)])).toBe(false);
  });

  it("rejects a run with mixed colors", () => {
    expect(isValidRun([tile("r1", "red", 1), tile("b2", "blue", 2), tile("r3", "red", 3)])).toBe(false);
  });

  it("rejects a run with a gap and no joker", () => {
    expect(isValidRun([tile("r1", "red", 1), tile("r2", "red", 2), tile("r4", "red", 4)])).toBe(false);
  });

  it("accepts a run with a joker filling a gap", () => {
    expect(isValidRun([tile("r1", "red", 1), joker("j0"), tile("r3", "red", 3)])).toBe(true);
  });

  it("accepts a run with a joker at the start", () => {
    expect(isValidRun([joker("j0"), tile("r2", "red", 2), tile("r3", "red", 3)])).toBe(true);
  });

  it("accepts a run with a joker at the end", () => {
    expect(isValidRun([tile("r1", "red", 1), tile("r2", "red", 2), joker("j0")])).toBe(true);
  });

  it("rejects a run with duplicate numbers", () => {
    expect(isValidRun([tile("r1a", "red", 1), tile("r1b", "red", 1), tile("r2", "red", 2)])).toBe(false);
  });

  it("rejects all jokers", () => {
    expect(isValidRun([joker("j0"), joker("j1"), joker("j2")])).toBe(false);
  });

  it("rejects a run where jokers can't fill all internal gaps", () => {
    // sorted=[1,5]: rangeSize=5, regularTiles=2, neededForGaps=3, jokerCount=1 → 3 > 1 → false
    expect(isValidRun([tile("r1", "red", 1), joker("j0"), tile("r5", "red", 5)])).toBe(false);
  });

  it("accepts a run with two jokers extending the sequence", () => {
    // [1, 2] + 2 jokers → extends to [1, 2, 3, 4]
    expect(isValidRun([tile("r1", "red", 1), tile("r2", "red", 2), joker("j0"), joker("j1")])).toBe(true);
  });

  it("accepts a run where a joker extends to exactly 13", () => {
    // [11, 12] + joker → joker = 13
    expect(isValidRun([tile("r11", "red", 11), tile("r12", "red", 12), joker("j0")])).toBe(true);
  });

  it("accepts a run where a joker extends down to exactly 1", () => {
    // joker + [2, 3] → joker = 1
    expect(isValidRun([joker("j0"), tile("r2", "red", 2), tile("r3", "red", 3)])).toBe(true);
  });
});

describe("isValidGroup", () => {
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

  it("rejects a group with fewer than 3 tiles", () => {
    expect(isValidGroup([tile("r7", "red", 7), tile("b7", "blue", 7)])).toBe(false);
  });

  it("rejects a group with 5 tiles", () => {
    const tiles = [
      tile("r7", "red", 7),
      tile("b7", "blue", 7),
      tile("y7", "yellow", 7),
      tile("k7", "black", 7),
      joker("j0"),
    ];
    expect(isValidGroup(tiles)).toBe(false);
  });

  it("rejects a group with duplicate colors", () => {
    expect(
      isValidGroup([tile("r7a", "red", 7), tile("r7b", "red", 7), tile("b7", "blue", 7)])
    ).toBe(false);
  });

  it("rejects a group with different numbers", () => {
    expect(
      isValidGroup([tile("r7", "red", 7), tile("b8", "blue", 8), tile("y7", "yellow", 7)])
    ).toBe(false);
  });

  it("accepts a group with a joker substituting one tile", () => {
    expect(
      isValidGroup([tile("r7", "red", 7), tile("b7", "blue", 7), joker("j0")])
    ).toBe(true);
  });

  it("rejects all jokers", () => {
    expect(isValidGroup([joker("j0"), joker("j1"), joker("j2")])).toBe(false);
  });

  it("accepts a group with 2 jokers and 1 regular tile", () => {
    // red-7 + 2 jokers → jokers fill any 2 other colors → valid 3-tile group
    expect(isValidGroup([tile("r7", "red", 7), joker("j0"), joker("j1")])).toBe(true);
  });
});

describe("isValidMeld", () => {
  it("returns true for a valid run", () => {
    expect(isValidMeld([tile("r1", "red", 1), tile("r2", "red", 2), tile("r3", "red", 3)])).toBe(true);
  });

  it("returns true for a valid group", () => {
    expect(
      isValidMeld([tile("r7", "red", 7), tile("b7", "blue", 7), tile("y7", "yellow", 7)])
    ).toBe(true);
  });

  it("returns false for invalid tiles", () => {
    expect(isValidMeld([tile("r1", "red", 1), tile("b7", "blue", 7), tile("y3", "yellow", 3)])).toBe(false);
  });
});

describe("areAllMeldsValid", () => {
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

  it("returns true for empty melds array", () => {
    expect(areAllMeldsValid([])).toBe(true);
  });
});

describe("verifyTilesMatch", () => {
  it("returns true when rack and melds contain the same tiles", () => {
    const rack: Tile[] = [
      tile("r1", "red", 1),
      tile("r2", "red", 2),
      tile("r3", "red", 3),
    ];
    const melds: Meld[] = [meld("m1", rack)];
    expect(verifyTilesMatch(rack, melds)).toBe(true);
  });

  it("returns false when melds have extra tiles", () => {
    const rack: Tile[] = [tile("r1", "red", 1), tile("r2", "red", 2)];
    const melds: Meld[] = [
      meld("m1", [tile("r1", "red", 1), tile("r2", "red", 2), tile("r3", "red", 3)]),
    ];
    expect(verifyTilesMatch(rack, melds)).toBe(false);
  });

  it("returns false when rack has tiles not in melds", () => {
    const rack: Tile[] = [tile("r1", "red", 1), tile("r2", "red", 2), tile("r3", "red", 3)];
    const melds: Meld[] = [meld("m1", [tile("r1", "red", 1), tile("r2", "red", 2)])];
    expect(verifyTilesMatch(rack, melds)).toBe(false);
  });

  it("returns false when a tile appears twice in melds", () => {
    const rack: Tile[] = [tile("r1", "red", 1), tile("r2", "red", 2), tile("r3", "red", 3)];
    const melds: Meld[] = [
      meld("m1", [tile("r1", "red", 1), tile("r2", "red", 2)]),
      meld("m2", [tile("r1", "red", 1)]), // duplicate r1
    ];
    expect(verifyTilesMatch(rack, melds)).toBe(false);
  });
});

describe("canAnnounceWin", () => {
  it("returns valid when all tiles form valid melds", () => {
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
    expect(canAnnounceWin(rack, melds)).toEqual({ valid: true });
  });

  it("returns invalid when tiles don't match rack", () => {
    const rack: Tile[] = [
      tile("r1", "red", 1),
      tile("r2", "red", 2),
      tile("r3", "red", 3),
    ];
    const melds: Meld[] = [
      meld("m1", [tile("b1", "blue", 1), tile("b2", "blue", 2), tile("b3", "blue", 3)]),
    ];
    const result = canAnnounceWin(rack, melds);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("returns invalid when melds are not all valid", () => {
    const rack: Tile[] = [
      tile("r1", "red", 1),
      tile("b2", "blue", 2),
    ];
    const melds: Meld[] = [meld("m1", rack)];
    const result = canAnnounceWin(rack, melds);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });
});

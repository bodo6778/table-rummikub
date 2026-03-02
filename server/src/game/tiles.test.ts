import { describe, it, expect, vi } from "vitest";
import { generateTilePool, shuffleTiles, dealTiles } from "./tiles.js";

describe("generateTilePool", () => {
  it("generates exactly 106 tiles", () => {
    const pool = generateTilePool();
    expect(pool).toHaveLength(106);
  });

  it("contains exactly 2 jokers", () => {
    const pool = generateTilePool();
    const jokers = pool.filter((t) => t.isJoker);
    expect(jokers).toHaveLength(2);
  });

  it("contains 104 numbered tiles", () => {
    const pool = generateTilePool();
    const numbered = pool.filter((t) => !t.isJoker);
    expect(numbered).toHaveLength(104);
  });

  it("has each color-number combination exactly twice", () => {
    const pool = generateTilePool();
    const numbered = pool.filter((t) => !t.isJoker);
    const colors = ["red", "blue", "yellow", "black"] as const;

    for (const color of colors) {
      for (let n = 1; n <= 13; n++) {
        const count = numbered.filter((t) => t.color === color && t.number === n).length;
        expect(count).toBe(2);
      }
    }
  });

  it("all tile IDs are unique", () => {
    const pool = generateTilePool();
    const ids = pool.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(pool.length);
  });

  it("jokers have number 0 and isJoker true", () => {
    const pool = generateTilePool();
    const jokers = pool.filter((t) => t.isJoker);
    for (const joker of jokers) {
      expect(joker.number).toBe(0);
      expect(joker.isJoker).toBe(true);
    }
  });

  it("numbered tiles all have numbers between 1 and 13", () => {
    const pool = generateTilePool();
    const numbered = pool.filter((t) => !t.isJoker);
    for (const tile of numbered) {
      expect(tile.number).toBeGreaterThanOrEqual(1);
      expect(tile.number).toBeLessThanOrEqual(13);
    }
  });
});

describe("shuffleTiles", () => {
  it("returns an array of the same length", () => {
    const pool = generateTilePool();
    const shuffled = shuffleTiles(pool);
    expect(shuffled).toHaveLength(pool.length);
  });

  it("contains the same elements", () => {
    const pool = generateTilePool();
    const shuffled = shuffleTiles(pool);
    const original = new Set(pool.map((t) => t.id));
    for (const tile of shuffled) {
      expect(original.has(tile.id)).toBe(true);
    }
  });

  it("does not mutate the original array", () => {
    const pool = generateTilePool();
    const originalIds = pool.map((t) => t.id);
    shuffleTiles(pool);
    expect(pool.map((t) => t.id)).toEqual(originalIds);
  });

  it("produces a different order than the input", () => {
    const pool = generateTilePool();
    // Control Math.random so the test is deterministic (not statistically flaky)
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const shuffled = shuffleTiles(pool);
    // Assert before restoring so we can inspect the result
    const identical = pool.every((t, i) => t.id === shuffled[i].id);
    vi.restoreAllMocks();
    expect(identical).toBe(false);
  });
});

describe("dealTiles", () => {
  it("deals 14 tiles to each player by default", () => {
    const pool = generateTilePool();
    const { racks } = dealTiles(pool, 2);
    for (const rack of racks) {
      expect(rack).toHaveLength(14);
    }
  });

  it("deals the correct number of racks for player count", () => {
    const pool = generateTilePool();
    for (const count of [2, 3, 4]) {
      const { racks } = dealTiles(pool, count);
      expect(racks).toHaveLength(count);
    }
  });

  it("remaining pool has correct size after dealing", () => {
    const pool = generateTilePool();
    const playerCount = 4;
    const tilesPerPlayer = 14;
    const { pool: remaining } = dealTiles(pool, playerCount, tilesPerPlayer);
    expect(remaining).toHaveLength(106 - playerCount * tilesPerPlayer);
  });

  it("no tile appears in multiple racks or pool", () => {
    const pool = generateTilePool();
    const { racks, pool: remaining } = dealTiles(pool, 4);
    const allIds = [
      ...racks.flat().map((t) => t.id),
      ...remaining.map((t) => t.id),
    ];
    const unique = new Set(allIds);
    expect(unique.size).toBe(allIds.length);
  });

  it("all tiles are accounted for after dealing", () => {
    const pool = generateTilePool();
    const { racks, pool: remaining } = dealTiles(pool, 3);
    const total = racks.reduce((sum, r) => sum + r.length, 0) + remaining.length;
    expect(total).toBe(106);
  });

  it("respects custom tilesPerPlayer", () => {
    const pool = generateTilePool();
    const { racks } = dealTiles(pool, 2, 7);
    for (const rack of racks) {
      expect(rack).toHaveLength(7);
    }
  });

  it("deals fewer than requested tiles when pool is smaller than needed", () => {
    // Pool has only 5 tiles but 2 players × 14 = 28 are requested
    const smallPool = generateTilePool().slice(0, 5);
    const { racks, pool: remaining } = dealTiles(smallPool, 2, 14);
    const totalDealt = racks.reduce((sum, r) => sum + r.length, 0);
    expect(totalDealt).toBe(5);
    expect(remaining).toHaveLength(0);
  });
});

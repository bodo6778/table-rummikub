import { Tile } from "../../types/index.js";

const COLORS: Array<"red" | "blue" | "yellow" | "black"> = [
  "red",
  "blue",
  "yellow",
  "black",
];
const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

/**
 * Generates a pool of 106 tiles:
 * - 2 sets of tiles numbered 1-13 in 4 colors (104 tiles)
 * - 2 jokers
 */
export function generateTilePool(): Tile[] {
  const tiles: Tile[] = [];

  // Generate 2 sets of numbered tiles
  for (let set = 0; set < 2; set++) {
    for (const color of COLORS) {
      for (const number of NUMBERS) {
        tiles.push({
          id: `${color}-${number}-${set}`,
          color,
          number,
          isJoker: false,
        });
      }
    }
  }

  // Add 2 jokers
  tiles.push({
    id: "joker-0",
    color: "red", // Jokers have a color but it's not used in validation
    number: 0,
    isJoker: true,
  });

  tiles.push({
    id: "joker-1",
    color: "blue",
    number: 0,
    isJoker: true,
  });

  return tiles;
}

/**
 * Shuffles an array using Fisher-Yates algorithm
 */
export function shuffleTiles<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deals tiles to players from the pool
 * @param pool - The tile pool to deal from
 * @param playerCount - Number of players
 * @param tilesPerPlayer - Number of tiles each player gets (default 14)
 * @returns Object with player racks and remaining pool
 */
export function dealTiles(
  pool: Tile[],
  playerCount: number,
  tilesPerPlayer: number = 14
): { racks: Tile[][]; pool: Tile[] } {
  const shuffled = shuffleTiles(pool);
  const racks: Tile[][] = [];

  for (let i = 0; i < playerCount; i++) {
    racks.push([]);
  }

  // Deal tiles round-robin style
  let currentPlayer = 0;
  let dealtCount = 0;
  const totalToDeal = playerCount * tilesPerPlayer;

  while (dealtCount < totalToDeal && shuffled.length > 0) {
    const tile = shuffled.shift()!;
    racks[currentPlayer].push(tile);
    currentPlayer = (currentPlayer + 1) % playerCount;
    dealtCount++;
  }

  return {
    racks,
    pool: shuffled,
  };
}

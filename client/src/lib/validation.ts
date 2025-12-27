import { Tile, Meld } from "../types";

/**
 * Validates if tiles form a valid run
 * A run is 3+ consecutive numbers of the same color
 * Jokers can substitute any tile
 */
export function isValidRun(tiles: Tile[]): boolean {
  if (tiles.length < 3) return false;

  const regularTiles = tiles.filter((t) => !t.isJoker);
  const jokerCount = tiles.length - regularTiles.length;

  if (regularTiles.length === 0) return false;

  const color = regularTiles[0].color;
  if (!regularTiles.every((t) => t.color === color)) return false;

  const sorted = [...regularTiles].sort((a, b) => a.number - b.number);

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].number === sorted[i - 1].number) return false;
  }

  const minNumber = sorted[0].number;
  const maxNumber = sorted[sorted.length - 1].number;
  const rangeSize = maxNumber - minNumber + 1;
  const neededTiles = rangeSize - regularTiles.length;

  return neededTiles === jokerCount;
}

/**
 * Validates if tiles form a valid group
 * A group is 3-4 tiles with the same number but different colors
 * Jokers can substitute any tile
 */
export function isValidGroup(tiles: Tile[]): boolean {
  if (tiles.length < 3 || tiles.length > 4) return false;

  const regularTiles = tiles.filter((t) => !t.isJoker);

  if (regularTiles.length === 0) return false;

  const number = regularTiles[0].number;
  if (!regularTiles.every((t) => t.number === number)) return false;

  const colors = new Set(regularTiles.map((t) => t.color));
  if (colors.size !== regularTiles.length) return false;

  return tiles.length <= 4;
}

/**
 * Validates if tiles form a valid meld (run or group)
 */
export function isValidMeld(tiles: Tile[]): boolean {
  return isValidRun(tiles) || isValidGroup(tiles);
}

/**
 * Validates if all melds are valid
 */
export function areAllMeldsValid(melds: Meld[]): boolean {
  return melds.every((meld) => isValidMeld(meld.tiles));
}

/**
 * Client-side check if player can announce a win
 * (Server will do the final validation)
 */
export function canAnnounceWin(rack: Tile[], melds: Meld[]): boolean {
  // Count tiles
  const meldTileCount = melds.reduce((sum, m) => sum + m.tiles.length, 0);
  if (meldTileCount !== rack.length) return false;

  // Check all melds are valid
  return areAllMeldsValid(melds);
}

import { Tile, Meld } from "../../types/index.js";

/**
 * Validates if tiles form a valid run
 * A run is 3+ consecutive numbers of the same color
 * Jokers can substitute any tile
 */
export function isValidRun(tiles: Tile[]): boolean {
  if (tiles.length < 3) return false;

  // Separate jokers from regular tiles
  const regularTiles = tiles.filter((t) => !t.isJoker);
  const jokerCount = tiles.length - regularTiles.length;

  if (regularTiles.length === 0) return false; // Can't have all jokers

  // All regular tiles must be the same color
  const color = regularTiles[0].color;
  if (!regularTiles.every((t) => t.color === color)) return false;

  // Special case: the only valid wrap-around is exactly [12, 13, 1] (3 tiles, same color)
  if (tiles.length === 3) {
    const nums = regularTiles.map((t) => t.number);
    if (
      nums.every((n) => [1, 12, 13].includes(n)) &&
      new Set(nums).size === nums.length
    ) {
      return true;
    }
  }

  // Sort regular tiles by number
  const sorted = [...regularTiles].sort((a, b) => a.number - b.number);

  // Check for duplicates (same number)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].number === sorted[i - 1].number) return false;
  }

  // Check if tiles can form a consecutive sequence with jokers
  const minNumber = sorted[0].number;
  const maxNumber = sorted[sorted.length - 1].number;
  const rangeSize = maxNumber - minNumber + 1;

  // Jokers needed to fill internal gaps between regular tiles
  const neededForGaps = rangeSize - regularTiles.length;
  if (neededForGaps > jokerCount) return false;

  // Remaining jokers can extend the sequence at either end (within 1–13)
  const externalJokers = jokerCount - neededForGaps;
  if (externalJokers === 0) return true;

  const maxExtendLeft = minNumber - 1;
  const maxExtendRight = 13 - maxNumber;
  return maxExtendLeft + maxExtendRight >= externalJokers;
}

/**
 * Validates if tiles form a valid group
 * A group is 3-4 tiles with the same number but different colors
 * Jokers can substitute any tile
 */
export function isValidGroup(tiles: Tile[]): boolean {
  if (tiles.length < 3 || tiles.length > 4) return false;

  // Separate jokers from regular tiles
  const regularTiles = tiles.filter((t) => !t.isJoker);

  if (regularTiles.length === 0) return false; // Can't have all jokers

  // All regular tiles must have the same number
  const number = regularTiles[0].number;
  if (!regularTiles.every((t) => t.number === number)) return false;

  // All regular tiles must have different colors
  const colors = new Set(regularTiles.map((t) => t.color));
  if (colors.size !== regularTiles.length) return false;

  // With jokers, we can't have more than 4 tiles total (4 colors max)
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
 * Verifies that the claimed melds contain exactly the same tiles as the player's rack
 * Prevents cheating by adding/removing tiles
 */
export function verifyTilesMatch(rack: Tile[], melds: Meld[]): boolean {
  // Get all tile IDs from melds
  const meldTileIds = new Set<string>();
  for (const meld of melds) {
    for (const tile of meld.tiles) {
      if (meldTileIds.has(tile.id)) {
        return false; // Duplicate tile in melds
      }
      meldTileIds.add(tile.id);
    }
  }

  // Get all tile IDs from rack
  const rackTileIds = new Set(rack.map((t) => t.id));

  // Check they match exactly
  if (meldTileIds.size !== rackTileIds.size) return false;

  for (const id of meldTileIds) {
    if (!rackTileIds.has(id)) return false;
  }

  return true;
}

/**
 * Validates a winning announcement
 * - All tiles in rack must be organized into valid melds
 * - Melds must contain exactly the same tiles as the rack (no cheating)
 */
export function canAnnounceWin(
  rack: Tile[],
  melds: Meld[],
  winningTileId: string
): { valid: boolean; reason?: string } {
  // Verify winning tile is in rack
  if (!rack.some((t) => t.id === winningTileId)) {
    return { valid: false, reason: "Winning tile not in rack" };
  }

  // Verify melds cover all rack tiles except the winning tile
  const rackWithoutWinner = rack.filter((t) => t.id !== winningTileId);
  if (!verifyTilesMatch(rackWithoutWinner, melds)) {
    return { valid: false, reason: "Tiles don't match your rack" };
  }

  // Check all melds are valid
  if (!areAllMeldsValid(melds)) {
    return { valid: false, reason: "Not all melds are valid" };
  }

  return { valid: true };
}

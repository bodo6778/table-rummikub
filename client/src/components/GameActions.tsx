import type { Meld } from "../types";
import { areAllMeldsValid } from "../lib/validation";

interface GameActionsProps {
  melds: Meld[];
  selectedTileId: string | null;
  canDrop: boolean;
  isDropping?: boolean;
  isAnnouncing?: boolean;
  onDropTile: () => void;
  onAnnounceWin: () => void;
}

export default function GameActions({
  melds,
  selectedTileId,
  canDrop,
  isDropping = false,
  isAnnouncing = false,
  onDropTile,
  onAnnounceWin,
}: GameActionsProps) {
  // Check if all tiles are in valid melds
  const allMeldsValid = areAllMeldsValid(melds);
  const totalTilesInMelds = melds.reduce((sum, m) => sum + m.tiles.length, 0);
  const canAnnounce = allMeldsValid && totalTilesInMelds === 14;
  const isLoading = isDropping || isAnnouncing;

  return (
    <div className="flex gap-4 items-center justify-center">
      {/* Drop tile button */}
      <button
        onClick={onDropTile}
        disabled={!canDrop || !selectedTileId || isLoading}
        className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
          canDrop && selectedTileId && !isLoading
            ? "bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
      >
        {isDropping && (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {selectedTileId ? "Drop Selected Tile" : "Select a tile to drop"}
      </button>

      {/* Announce win button */}
      <button
        onClick={onAnnounceWin}
        disabled={!canAnnounce || !canDrop || isLoading}
        className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
          canAnnounce && canDrop && !isLoading
            ? "bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-white shadow-lg hover:shadow-xl animate-pulse"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
      >
        {isAnnouncing && (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        Announce Win!
      </button>

      {/* Validation feedback */}
      {!canAnnounce && totalTilesInMelds > 0 && !isLoading && (
        <div className="text-sm text-gray-500">
          {!allMeldsValid
            ? "Some melds are invalid"
            : totalTilesInMelds !== 14
              ? `${totalTilesInMelds}/14 tiles in melds`
              : ""}
        </div>
      )}
    </div>
  );
}

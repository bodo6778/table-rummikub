import type { Meld } from "../types";
import { areAllMeldsValid } from "../lib/validation";

interface GameActionsProps {
  melds: Meld[];
  selectedTileId: string | null;
  canDrop: boolean;
  onDropTile: () => void;
  onAnnounceWin: () => void;
}

export default function GameActions({
  melds,
  selectedTileId,
  canDrop,
  onDropTile,
  onAnnounceWin,
}: GameActionsProps) {
  // Check if all tiles are in valid melds
  const allMeldsValid = areAllMeldsValid(melds);
  const totalTilesInMelds = melds.reduce((sum, m) => sum + m.tiles.length, 0);
  const canAnnounce = allMeldsValid && totalTilesInMelds === 14;

  return (
    <div className="flex gap-4 items-center justify-center">
      {/* Drop tile button */}
      <button
        onClick={onDropTile}
        disabled={!canDrop || !selectedTileId}
        className={`px-6 py-3 rounded-lg font-semibold transition-all ${
          canDrop && selectedTileId
            ? "bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
      >
        {selectedTileId ? "Drop Selected Tile" : "Select a tile to drop"}
      </button>

      {/* Announce win button */}
      <button
        onClick={onAnnounceWin}
        disabled={!canAnnounce || !canDrop}
        className={`px-6 py-3 rounded-lg font-semibold transition-all ${
          canAnnounce && canDrop
            ? "bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-white shadow-lg hover:shadow-xl animate-pulse"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
      >
        Announce Win!
      </button>

      {/* Validation feedback */}
      {!canAnnounce && totalTilesInMelds > 0 && (
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

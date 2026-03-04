import type { Meld } from "../types";
import { areAllMeldsValid } from "../lib/validation";

const TILES_IN_WINNING_MELDS = 14;

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
  // Check if all tiles except the winning tile are in valid melds
  const allMeldsValid = areAllMeldsValid(melds);
  const totalTilesInMelds = melds.reduce((sum, m) => sum + m.tiles.length, 0);
  const winningTileInMeld = selectedTileId
    ? melds.some((m) => m.tiles.some((t) => t.id === selectedTileId))
    : false;
  const canAnnounce =
    allMeldsValid &&
    totalTilesInMelds === TILES_IN_WINNING_MELDS &&
    !!selectedTileId &&
    !winningTileInMeld;
  const isLoading = isDropping || isAnnouncing;

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-center justify-center">
      {/* Drop tile button */}
      <button
        onClick={onDropTile}
        disabled={!canDrop || !selectedTileId || isLoading}
        className={`w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${
          canDrop && selectedTileId && !isLoading
            ? "bg-status-error/90 hover:bg-status-error text-white shadow-lg"
            : "bg-surface-600 text-text-muted cursor-not-allowed"
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
        className={`w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${
          canAnnounce && canDrop && !isLoading
            ? "bg-gradient-to-r from-accent-400 to-accent-600 hover:from-accent-500 hover:to-accent-600 text-surface-900 shadow-lg animate-pulse-glow"
            : "bg-surface-600 text-text-muted cursor-not-allowed"
        }`}
      >
        {isAnnouncing && (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        Announce Win!
      </button>

      {/* Validation feedback */}
      {!canAnnounce && totalTilesInMelds > 0 && !isLoading && (
        <div className="text-sm text-text-muted">
          {!allMeldsValid
            ? "Some melds are invalid"
            : totalTilesInMelds !== TILES_IN_WINNING_MELDS
              ? `${totalTilesInMelds}/${TILES_IN_WINNING_MELDS} tiles in melds`
              : !selectedTileId || winningTileInMeld
              ? "Select your winning tile"
              : ""}
        </div>
      )}
    </div>
  );
}

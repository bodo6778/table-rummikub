import type { Player } from "../types";
import Tile from "./Tile";

interface OpponentInfoProps {
  player: Player;
  isCurrentTurn: boolean;
  tileCount: number;
}

export default function OpponentInfo({
  player,
  isCurrentTurn,
  tileCount,
}: OpponentInfoProps) {
  const isDisconnected = !player.connected;

  return (
    <div
      className={`flex items-center gap-2 sm:gap-3 px-3 py-2 sm:px-4 sm:py-3 rounded-xl transition-all duration-300 ${
        isDisconnected
          ? "bg-surface-700 border border-status-warning/40 opacity-70"
          : isCurrentTurn
            ? "bg-surface-700 border-2 border-accent-500 shadow-[0_0_12px_rgba(20,184,166,0.15)]"
            : "bg-surface-700 border border-surface-400"
      }`}
    >
      {/* Player avatar/initial */}
      <div
        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-base text-surface-900 ${
          isDisconnected
            ? "bg-status-warning"
            : isCurrentTurn
              ? "bg-accent-500"
              : "bg-text-secondary"
        }`}
      >
        {player.name.charAt(0).toUpperCase()}
      </div>

      {/* Player info */}
      <div className="flex flex-col">
        <span className="font-semibold text-text-primary text-sm sm:text-base truncate">
          {player.name}
          {isDisconnected && <span className="text-status-warning text-xs sm:text-sm ml-1">(offline)</span>}
        </span>
        <span className="text-xs sm:text-sm text-text-muted">{tileCount} tiles</span>
      </div>

      {/* Last dropped tile */}
      {player.lastDroppedTile && (
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-text-muted">Dropped:</span>
          <div className="scale-75 origin-right">
            <Tile tile={player.lastDroppedTile} />
          </div>
        </div>
      )}

      {/* Current turn indicator */}
      {isCurrentTurn && (
        <div className="ml-2 w-3 h-3 bg-accent-400 rounded-full animate-pulse" />
      )}
    </div>
  );
}

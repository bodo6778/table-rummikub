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
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        isCurrentTurn
          ? "bg-green-100 border-2 border-green-400 shadow-lg"
          : "bg-white border border-gray-200 shadow"
      }`}
    >
      {/* Player avatar/initial */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
          isCurrentTurn ? "bg-green-500" : "bg-gray-400"
        }`}
      >
        {player.name.charAt(0).toUpperCase()}
      </div>

      {/* Player info */}
      <div className="flex flex-col">
        <span className="font-semibold text-gray-800">{player.name}</span>
        <span className="text-sm text-gray-500">{tileCount} tiles</span>
      </div>

      {/* Last dropped tile */}
      {player.lastDroppedTile && (
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">Dropped:</span>
          <div className="scale-75 origin-right">
            <Tile tile={player.lastDroppedTile} />
          </div>
        </div>
      )}

      {/* Current turn indicator */}
      {isCurrentTurn && (
        <div className="ml-2 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
      )}
    </div>
  );
}

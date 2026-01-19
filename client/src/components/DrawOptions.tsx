import type { Tile as TileType } from "../types";
import Tile from "./Tile";

interface DrawOptionsProps {
  poolSize: number;
  neighborDroppedTile: TileType | null;
  neighborName: string | null;
  canDraw: boolean;
  hasDrawnThisTurn: boolean;
  onDrawFromPool: () => void;
  onDrawFromNeighbor: () => void;
}

export default function DrawOptions({
  poolSize,
  neighborDroppedTile,
  neighborName,
  canDraw,
  hasDrawnThisTurn,
  onDrawFromPool,
  onDrawFromNeighbor,
}: DrawOptionsProps) {
  const isMyTurn = canDraw && !hasDrawnThisTurn;

  return (
    <div className="flex gap-6 items-center justify-center">
      {/* Draw from pool */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={onDrawFromPool}
          disabled={!isMyTurn || poolSize === 0}
          className={`w-16 h-20 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
            isMyTurn && poolSize > 0
              ? "bg-gradient-to-br from-blue-500 to-blue-700 border-blue-400 hover:from-blue-400 hover:to-blue-600 cursor-pointer shadow-lg hover:shadow-xl"
              : "bg-gray-400 border-gray-500 cursor-not-allowed opacity-60"
          }`}
        >
          <span className="text-white font-bold text-lg">?</span>
          <span className="text-white text-xs">{poolSize}</span>
        </button>
        <span className="text-gray-600 text-sm">Pool</span>
      </div>

      {/* Draw from neighbor */}
      <div className="flex flex-col items-center gap-2">
        {neighborDroppedTile ? (
          <>
            <button
              onClick={onDrawFromNeighbor}
              disabled={!isMyTurn}
              className={`transition-all ${
                isMyTurn
                  ? "hover:scale-105 cursor-pointer"
                  : "cursor-not-allowed opacity-60"
              }`}
            >
              <Tile tile={neighborDroppedTile} />
            </button>
            <span className="text-gray-600 text-sm">
              {neighborName ? `From ${neighborName}` : "Neighbor's tile"}
            </span>
          </>
        ) : (
          <>
            <div className="w-12 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
              <span className="text-gray-400 text-xs">None</span>
            </div>
            <span className="text-gray-400 text-sm">No tile available</span>
          </>
        )}
      </div>

      {/* Status indicator */}
      {hasDrawnThisTurn && (
        <div className="text-amber-600 font-medium text-sm bg-amber-50 px-3 py-1 rounded-full">
          Already drawn - drop a tile
        </div>
      )}
    </div>
  );
}

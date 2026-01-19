import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Meld as MeldType } from "../types";
import SortableTile from "./SortableTile";
import { isValidMeld } from "../lib/validation";

interface MeldProps {
  meld: MeldType;
  onTileClick?: (tileId: string) => void;
  selectedTileId?: string | null;
}

export default function Meld({ meld, onTileClick, selectedTileId }: MeldProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `meld-${meld.id}`,
    data: { type: "meld", meldId: meld.id },
  });

  const isValid = meld.tiles.length >= 3 && isValidMeld(meld.tiles);
  const tileIds = meld.tiles.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      className={`flex gap-1 p-2 rounded-lg border-2 border-dashed transition-colors min-h-[80px] items-center ${
        isOver
          ? "border-purple-400 bg-purple-50"
          : isValid
            ? "border-green-400 bg-green-50"
            : meld.tiles.length > 0
              ? "border-red-300 bg-red-50"
              : "border-gray-300 bg-gray-50"
      }`}
    >
      <SortableContext items={tileIds} strategy={horizontalListSortingStrategy}>
        {meld.tiles.map((tile) => (
          <SortableTile
            key={tile.id}
            tile={tile}
            isSelected={selectedTileId === tile.id}
            onClick={() => onTileClick?.(tile.id)}
          />
        ))}
      </SortableContext>
      {meld.tiles.length === 0 && (
        <span className="text-gray-400 text-sm px-4">Drop tiles here</span>
      )}
    </div>
  );
}

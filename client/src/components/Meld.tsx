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
      className={`flex gap-0.5 sm:gap-1 p-1.5 sm:p-2 rounded-lg border-2 border-dashed transition-colors min-h-[56px] sm:min-h-[80px] items-center overflow-x-auto ${
        isOver
          ? "border-accent-400/60 bg-accent-500/10"
          : isValid
            ? "border-status-success/50 bg-status-success/10"
            : meld.tiles.length > 0
              ? "border-status-error/40 bg-status-error/10"
              : "border-surface-400/50 bg-surface-800/50"
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
        <span className="text-text-muted text-sm px-4">Drop tiles here</span>
      )}
    </div>
  );
}

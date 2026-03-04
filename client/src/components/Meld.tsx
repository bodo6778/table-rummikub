import { useState, useEffect, useRef } from "react";
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
  justDrawnTileId?: string | null;
  droppingTileId?: string | null;
  activeTileId?: string | null;
}

export default function Meld({ meld, onTileClick, selectedTileId, justDrawnTileId, droppingTileId, activeTileId }: MeldProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `meld-${meld.id}`,
    data: { type: "meld", meldId: meld.id },
  });

  const isValid = meld.tiles.length >= 3 && isValidMeld(meld.tiles);
  // Exclude the actively-dragged tile so it's never registered in two SortableContexts simultaneously
  const visibleTiles = meld.tiles.filter((t) => t.id !== activeTileId);
  const tileIds = visibleTiles.map((t) => t.id);

  // Track previous validity to trigger glow/shake on change
  const prevValidRef = useRef<boolean | null>(null);
  const prevTileCountRef = useRef(meld.tiles.length);
  const [animClass, setAnimClass] = useState("");

  useEffect(() => {
    // Only animate after initial render and when tiles change
    if (prevValidRef.current === null) {
      prevValidRef.current = isValid;
      prevTileCountRef.current = meld.tiles.length;
      return;
    }

    if (meld.tiles.length >= 3 && prevTileCountRef.current !== meld.tiles.length) {
      if (isValid && !prevValidRef.current) {
        setAnimClass("animate-valid-glow");
        setTimeout(() => setAnimClass(""), 700);
      } else if (!isValid && prevValidRef.current) {
        setAnimClass("animate-shake");
        setTimeout(() => setAnimClass(""), 500);
      }
    }

    prevValidRef.current = isValid;
    prevTileCountRef.current = meld.tiles.length;
  }, [isValid, meld.tiles.length]);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-wrap gap-0.5 sm:gap-1 p-1.5 sm:p-2 rounded-lg border-2 border-dashed transition-colors min-h-[56px] sm:min-h-[80px] items-center ${animClass} ${
        isOver
          ? "border-accent-400/60 bg-accent-500/10"
          : isValid
            ? "border-status-success/50 bg-status-success/10"
            : meld.tiles.length > 0
              ? "border-status-error/40 bg-status-error/10"
              : "border-surface-400/50 bg-surface-800/50"
      }`}
    >
      {tileIds.length > 0 && (
        <SortableContext items={tileIds} strategy={horizontalListSortingStrategy}>
          {visibleTiles.map((tile) => (
            <SortableTile
              key={tile.id}
              tile={tile}
              isSelected={selectedTileId === tile.id}
              onClick={() => onTileClick?.(tile.id)}
              isJustDrawn={justDrawnTileId === tile.id}
              isDropping={droppingTileId === tile.id}
            />
          ))}
        </SortableContext>
      )}
      {meld.tiles.length === 0 && (
        <span className="text-text-muted text-sm px-4">Drop tiles here</span>
      )}
    </div>
  );
}

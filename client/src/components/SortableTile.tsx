import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Tile as TileType } from "../types";
import Tile from "./Tile";

interface SortableTileProps {
  tile: TileType;
  isSelected?: boolean;
  onClick?: () => void;
  isJustDrawn?: boolean;
  isDropping?: boolean;
}

export default function SortableTile({
  tile,
  isSelected,
  onClick,
  isJustDrawn,
  isDropping,
}: SortableTileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: tile.id,
    data: { type: "tile", tile },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 200ms ease",
    zIndex: isDragging ? 100 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="touch-manipulation p-0.5 sm:p-0"
    >
      <Tile
        tile={tile}
        isSelected={isSelected}
        isDragging={isDragging}
        isJustDrawn={isJustDrawn}
        isDropping={isDropping}
        onClick={onClick}
      />
    </div>
  );
}

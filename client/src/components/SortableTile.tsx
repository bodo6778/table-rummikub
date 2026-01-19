import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Tile as TileType } from "../types";
import Tile from "./Tile";

interface SortableTileProps {
  tile: TileType;
  isSelected?: boolean;
  onClick?: () => void;
}

export default function SortableTile({
  tile,
  isSelected,
  onClick,
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
    transition,
    zIndex: isDragging ? 100 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Tile
        tile={tile}
        isSelected={isSelected}
        isDragging={isDragging}
        onClick={onClick}
      />
    </div>
  );
}

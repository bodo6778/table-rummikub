import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import type { Tile as TileType, Meld as MeldType } from "../types";
import Meld from "./Meld";
import Tile from "./Tile";
import { v4 as uuidv4 } from "uuid";

interface RackProps {
  tiles: TileType[];
  melds: MeldType[];
  onMeldsChange: (melds: MeldType[]) => void;
  selectedTileId: string | null;
  onTileSelect: (tileId: string | null) => void;
}

export default function Rack({
  tiles,
  melds,
  onMeldsChange,
  selectedTileId,
  onTileSelect,
}: RackProps) {
  const [activeTile, setActiveTile] = useState<TileType | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Find which meld contains a tile
  const findMeldContainingTile = useCallback(
    (tileId: string): string | null => {
      for (const meld of melds) {
        if (meld.tiles.some((t) => t.id === tileId)) {
          return meld.id;
        }
      }
      return null;
    },
    [melds]
  );

  // Get tiles that are not in any meld (unassigned)
  const unassignedTiles = tiles.filter(
    (tile) => !findMeldContainingTile(tile.id)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const tile = active.data.current?.tile as TileType | undefined;
    if (tile) {
      setActiveTile(tile);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeTileId = active.id as string;
    const overId = over.id as string;

    // Find source meld
    const sourceMeldId = findMeldContainingTile(activeTileId);

    // Determine target meld
    let targetMeldId: string | null = null;
    if (overId.startsWith("meld-")) {
      targetMeldId = overId.replace("meld-", "");
    } else if (overId === "unassigned") {
      targetMeldId = null;
    } else {
      // Over another tile - find its meld
      targetMeldId = findMeldContainingTile(overId);
    }

    // If moving between melds
    if (sourceMeldId !== targetMeldId) {
      const newMelds = melds.map((meld) => {
        if (meld.id === sourceMeldId) {
          // Remove from source
          return {
            ...meld,
            tiles: meld.tiles.filter((t) => t.id !== activeTileId),
          };
        }
        if (meld.id === targetMeldId) {
          // Add to target
          const tile = tiles.find((t) => t.id === activeTileId);
          if (tile && !meld.tiles.some((t) => t.id === activeTileId)) {
            return {
              ...meld,
              tiles: [...meld.tiles, tile],
            };
          }
        }
        return meld;
      });
      onMeldsChange(newMelds);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTile(null);

    if (!over) return;

    const activeTileId = active.id as string;
    const overId = over.id as string;

    // Handle reordering within same meld
    const activeMeldId = findMeldContainingTile(activeTileId);
    const overMeldId = findMeldContainingTile(overId);

    if (activeMeldId && activeMeldId === overMeldId && activeTileId !== overId) {
      const newMelds = melds.map((meld) => {
        if (meld.id === activeMeldId) {
          const oldIndex = meld.tiles.findIndex((t) => t.id === activeTileId);
          const newIndex = meld.tiles.findIndex((t) => t.id === overId);
          return {
            ...meld,
            tiles: arrayMove(meld.tiles, oldIndex, newIndex),
          };
        }
        return meld;
      });
      onMeldsChange(newMelds);
    }
  };

  const handleAddMeld = () => {
    const newMeld: MeldType = {
      id: uuidv4(),
      tiles: [],
    };
    onMeldsChange([...melds, newMeld]);
  };

  const handleRemoveEmptyMelds = () => {
    onMeldsChange(melds.filter((m) => m.tiles.length > 0));
  };

  const handleTileClick = (tileId: string) => {
    if (selectedTileId === tileId) {
      onTileSelect(null);
    } else {
      onTileSelect(tileId);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="bg-gradient-to-b from-amber-800 to-amber-900 rounded-xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-amber-100 font-semibold">Your Rack</h3>
          <div className="flex gap-2">
            <button
              onClick={handleAddMeld}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded transition-colors"
            >
              + Add Meld
            </button>
            {melds.some((m) => m.tiles.length === 0) && (
              <button
                onClick={handleRemoveEmptyMelds}
                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded transition-colors"
              >
                Remove Empty
              </button>
            )}
          </div>
        </div>

        {/* Melds */}
        <div className="flex flex-wrap gap-3 mb-4">
          {melds.map((meld) => (
            <Meld
              key={meld.id}
              meld={meld}
              onTileClick={handleTileClick}
              selectedTileId={selectedTileId}
            />
          ))}
        </div>

        {/* Unassigned tiles */}
        {unassignedTiles.length > 0 && (
          <div className="border-t border-amber-700 pt-3">
            <p className="text-amber-200 text-sm mb-2">
              Unassigned tiles ({unassignedTiles.length})
            </p>
            <Meld
              meld={{ id: "unassigned", tiles: unassignedTiles }}
              onTileClick={handleTileClick}
              selectedTileId={selectedTileId}
            />
          </div>
        )}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeTile ? <Tile tile={activeTile} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

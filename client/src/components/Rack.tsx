import { useState, useCallback, useEffect, useRef } from "react";
import { ArrowUpDown, Plus, Trash2 } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import type { Tile as TileType, Meld as MeldType } from "../types";
import Meld from "./Meld";
import Tile from "./Tile";
import { v4 as uuidv4 } from "uuid";

const COLOR_ORDER: Record<string, number> = {
  red: 0,
  blue: 1,
  yellow: 2,
  black: 3,
};

interface RackProps {
  tiles: TileType[];
  melds: MeldType[];
  onMeldsChange: (melds: MeldType[]) => void;
  selectedTileId: string | null;
  onTileSelect: (tileId: string | null) => void;
  justDrawnTileId?: string | null;
  droppingTileId?: string | null;
}

export default function Rack({
  tiles,
  melds,
  onMeldsChange,
  selectedTileId,
  onTileSelect,
  justDrawnTileId,
  droppingTileId,
}: RackProps) {
  const [activeTile, setActiveTile] = useState<TileType | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Always-fresh ref so drag handlers don't close over stale melds
  const meldsRef = useRef(melds);
  meldsRef.current = melds;

  // Pointer-within first: requires the pointer to be inside a droppable, not just closest
  // to its center. Falls back to rect intersection. Prevents oscillation at boundaries.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return rectIntersection(args);
  }, []);

  // Local tile order for sorting unassigned tiles
  const [tileOrder, setTileOrder] = useState<string[]>(() =>
    tiles.map((t) => t.id),
  );

  // Sync order when tiles change (new tile drawn, tile dropped)
  useEffect(() => {
    setTileOrder((prev) => {
      const currentIds = new Set(tiles.map((t) => t.id));
      const kept = prev.filter((id) => currentIds.has(id));
      const added = tiles.filter((t) => !prev.includes(t.id)).map((t) => t.id);
      return [...kept, ...added];
    });
  }, [tiles]);

  // Prevent page scroll while dragging on touch devices
  useEffect(() => {
    if (!isDragging) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => document.removeEventListener("touchmove", prevent);
  }, [isDragging]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Find which meld contains a tile — reads from ref so it's always fresh
  const findMeldContainingTile = useCallback(
    (tileId: string): string | null => {
      for (const meld of meldsRef.current) {
        if (meld.tiles.some((t) => t.id === tileId)) {
          return meld.id;
        }
      }
      return null;
    },
    [],
  );

  // Get tiles that are not in any meld (unassigned), in current sort order
  const unassignedTiles = tileOrder
    .map((id) => tiles.find((t) => t.id === id))
    .filter((t): t is TileType => !!t && !findMeldContainingTile(t.id));

  const sortUnassigned = useCallback(
    (compareFn: (a: TileType, b: TileType) => number) => {
      setTileOrder((prev) => {
        const unassignedIds = new Set(
          tiles.filter((t) => !findMeldContainingTile(t.id)).map((t) => t.id),
        );
        const sorted = tiles
          .filter((t) => unassignedIds.has(t.id))
          .sort(compareFn)
          .map((t) => t.id);
        let idx = 0;
        return prev.map((id) => (unassignedIds.has(id) ? sorted[idx++] : id));
      });
    },
    [tiles, findMeldContainingTile],
  );

  const handleSortByColor = useCallback(() => {
    sortUnassigned((a, b) => {
      if (a.isJoker) return 1;
      if (b.isJoker) return -1;
      const colorDiff = COLOR_ORDER[a.color] - COLOR_ORDER[b.color];
      return colorDiff !== 0 ? colorDiff : a.number - b.number;
    });
  }, [sortUnassigned]);

  const handleSortByNumber = useCallback(() => {
    sortUnassigned((a, b) => {
      if (a.isJoker) return 1;
      if (b.isJoker) return -1;
      const numDiff = a.number - b.number;
      return numDiff !== 0
        ? numDiff
        : COLOR_ORDER[a.color] - COLOR_ORDER[b.color];
    });
  }, [sortUnassigned]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const tile = active.data.current?.tile as TileType | undefined;
    if (tile) {
      setActiveTile(tile);
      setIsDragging(true);
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
      const newMelds = meldsRef.current.map((meld) => {
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
    setIsDragging(false);

    if (!over) return;

    const activeTileId = active.id as string;
    const overId = over.id as string;

    // Handle reordering within same meld
    const activeMeldId = findMeldContainingTile(activeTileId);
    const overMeldId = findMeldContainingTile(overId);

    if (
      activeMeldId &&
      activeMeldId === overMeldId &&
      activeTileId !== overId
    ) {
      const newMelds = meldsRef.current.map((meld) => {
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

    // Reorder within unassigned tiles
    if (!activeMeldId && !overMeldId && activeTileId !== overId) {
      setTileOrder((prev) => {
        const oldIndex = prev.indexOf(activeTileId);
        const newIndex = prev.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
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
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveTile(null);
        setIsDragging(false);
      }}
    >
      <div className="bg-surface-700 border border-surface-400 rounded-xl p-2 sm:p-4 shadow-xl">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <h3 className="text-text-secondary font-semibold text-sm sm:text-base">
            Your Rack
          </h3>
          <div className="flex gap-2">
            {unassignedTiles.length > 1 && (
              <>
                <button
                  onClick={handleSortByColor}
                  title="Sort unassigned tiles by color"
                  className="flex items-center gap-1.5 px-3 py-1 bg-surface-500/30 hover:bg-surface-500/50 text-text-secondary text-sm rounded-lg border border-surface-400/40 transition-colors"
                >
                  <ArrowUpDown size={13} />
                  Color
                </button>
                <button
                  onClick={handleSortByNumber}
                  title="Sort unassigned tiles by number"
                  className="flex items-center gap-1.5 px-3 py-1 bg-surface-500/30 hover:bg-surface-500/50 text-text-secondary text-sm rounded-lg border border-surface-400/40 transition-colors"
                >
                  <ArrowUpDown size={13} />
                  Number
                </button>
              </>
            )}
            <button
              onClick={handleAddMeld}
              className="flex items-center gap-1.5 px-3 py-1 bg-accent-500/20 hover:bg-accent-500/30 text-accent-400 text-sm rounded-lg border border-accent-500/30 transition-colors"
            >
              <Plus size={13} />
              Add Meld
            </button>
            {melds.some((m) => m.tiles.length === 0) && (
              <button
                onClick={handleRemoveEmptyMelds}
                className="flex items-center gap-1.5 px-3 py-1 bg-status-error/20 hover:bg-status-error/30 text-status-error text-sm rounded-lg border border-status-error/30 transition-colors"
              >
                <Trash2 size={13} />
                Remove Empty
              </button>
            )}
          </div>
        </div>

        {/* Melds */}
        <div className="flex flex-wrap gap-2 sm:gap-3 mb-3 sm:mb-4">
          {melds.map((meld) => (
            <Meld
              key={meld.id}
              meld={meld}
              onTileClick={handleTileClick}
              selectedTileId={selectedTileId}
              justDrawnTileId={justDrawnTileId}
              droppingTileId={droppingTileId}
              activeTileId={activeTile?.id}
            />
          ))}
        </div>

        {/* Unassigned tiles */}
        {unassignedTiles.length > 0 && (
          <div className="border-t border-surface-400 pt-3">
            <p className="text-text-muted text-sm mb-2">
              Unassigned tiles ({unassignedTiles.length})
            </p>
            <Meld
              meld={{ id: "unassigned", tiles: unassignedTiles }}
              onTileClick={handleTileClick}
              selectedTileId={selectedTileId}
              justDrawnTileId={justDrawnTileId}
              droppingTileId={droppingTileId}
              activeTileId={activeTile?.id}
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

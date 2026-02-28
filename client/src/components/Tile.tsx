import { forwardRef } from "react";
import type { Tile as TileType } from "../types";

interface TileProps {
  tile: TileType;
  isSelected?: boolean;
  isDragging?: boolean;
  onClick?: () => void;
  className?: string;
}

const colorClasses: Record<TileType["color"], string> = {
  red: "text-tile-red",
  blue: "text-tile-blue",
  yellow: "text-tile-gold",
  black: "text-gray-900",
};

const Tile = forwardRef<HTMLDivElement, TileProps>(
  ({ tile, isSelected, isDragging, onClick, className = "" }, ref) => {
    const baseClasses =
      "w-9 h-12 sm:w-12 sm:h-16 bg-tile-bg rounded-md sm:rounded-lg border border-tile-border flex items-center justify-center font-bold text-lg sm:text-2xl select-none transition-all cursor-pointer shadow-sm";

    const stateClasses = isDragging
      ? "opacity-50 scale-105 shadow-lg"
      : isSelected
        ? "border-accent-500 ring-2 ring-accent-500/30"
        : "hover:border-accent-400";

    if (tile.isJoker) {
      return (
        <div
          ref={ref}
          onClick={onClick}
          className={`${baseClasses} ${stateClasses} ${className}`}
        >
          <span className="text-lg bg-gradient-to-br from-tile-red via-tile-blue to-tile-gold bg-clip-text text-transparent font-black">
            J
          </span>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        onClick={onClick}
        className={`${baseClasses} ${stateClasses} ${colorClasses[tile.color]} ${className}`}
      >
        {tile.number}
      </div>
    );
  }
);

Tile.displayName = "Tile";

export default Tile;

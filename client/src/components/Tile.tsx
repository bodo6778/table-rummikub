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
  red: "text-red-600",
  blue: "text-blue-600",
  yellow: "text-yellow-500",
  black: "text-gray-900",
};

const Tile = forwardRef<HTMLDivElement, TileProps>(
  ({ tile, isSelected, isDragging, onClick, className = "" }, ref) => {
    const baseClasses =
      "w-12 h-16 bg-amber-50 rounded-lg border-2 flex items-center justify-center font-bold text-2xl select-none transition-all cursor-pointer shadow-md";

    const stateClasses = isDragging
      ? "opacity-50 scale-105 shadow-lg"
      : isSelected
        ? "border-purple-500 ring-2 ring-purple-300"
        : "border-amber-200 hover:border-amber-400";

    if (tile.isJoker) {
      return (
        <div
          ref={ref}
          onClick={onClick}
          className={`${baseClasses} ${stateClasses} ${className}`}
        >
          <span className="text-lg bg-gradient-to-br from-red-500 via-blue-500 to-yellow-500 bg-clip-text text-transparent font-black">
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

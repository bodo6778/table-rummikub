import { useState } from "react";
import type { Player } from "../types";
import Tile from "./Tile";

interface OpponentInfoProps {
  player: Player;
  isCurrentTurn: boolean;
  tileCount: number;
}

export default function OpponentInfo({
  player,
  isCurrentTurn,
  tileCount,
}: OpponentInfoProps) {
  const [popupOpen, setPopupOpen] = useState(false);
  const isDisconnected = !player.connected;
  const droppedTiles = player.droppedTiles || [];

  return (
    <div
      className={`flex items-center gap-2 sm:gap-3 px-3 py-2 sm:px-4 sm:py-3 rounded-xl transition-all duration-300 ${
        isDisconnected
          ? "bg-surface-700 border border-status-warning/40 opacity-70"
          : isCurrentTurn
            ? "bg-surface-700 border-2 border-accent-500 shadow-[0_0_12px_rgba(20,184,166,0.15)]"
            : "bg-surface-700 border border-surface-400"
      }`}
    >
      {/* Player avatar/initial */}
      <div
        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-base text-surface-900 flex-shrink-0 ${
          isDisconnected
            ? "bg-status-warning"
            : isCurrentTurn
              ? "bg-accent-500"
              : "bg-text-secondary"
        }`}
      >
        {player.name.charAt(0).toUpperCase()}
      </div>

      {/* Player info */}
      <div className="flex flex-col min-w-0">
        <span className="font-semibold text-text-primary text-sm sm:text-base truncate">
          {player.name}
          {isDisconnected && <span className="text-status-warning text-xs sm:text-sm ml-1">(offline)</span>}
        </span>
        <span className="text-xs sm:text-sm text-text-muted">{tileCount} tiles</span>
      </div>

      {/* Dropped tiles history button */}
      <div className="ml-auto relative flex-shrink-0">
        <button
          className={`px-2 py-1 rounded-lg text-xs border transition-colors ${
            droppedTiles.length > 0
              ? "bg-surface-600 hover:bg-surface-500 border-surface-400 text-text-secondary"
              : "bg-surface-700 border-surface-500/40 text-text-muted cursor-default"
          }`}
          onMouseEnter={() => droppedTiles.length > 0 && setPopupOpen(true)}
          onMouseLeave={() => setPopupOpen(false)}
          onClick={() => droppedTiles.length > 0 && setPopupOpen((prev) => !prev)}
          aria-label={`${player.name}'s dropped tiles`}
        >
          Drops ({droppedTiles.length})
        </button>

        {/* Popup */}
        {popupOpen && droppedTiles.length > 0 && (
          <div
            className="absolute top-full mt-2 right-0 z-50 bg-surface-700 border border-surface-400 rounded-xl shadow-2xl p-3 min-w-max"
            onMouseEnter={() => setPopupOpen(true)}
            onMouseLeave={() => setPopupOpen(false)}
          >
            <p className="text-text-muted text-xs mb-2">{player.name}'s drops</p>
            <div className="flex flex-wrap gap-1 max-w-xs">
              {droppedTiles.map((tile) => (
                <Tile key={tile.id} tile={tile} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Current turn indicator */}
      {isCurrentTurn && (
        <div className="w-3 h-3 bg-accent-400 rounded-full animate-pulse flex-shrink-0" />
      )}
    </div>
  );
}

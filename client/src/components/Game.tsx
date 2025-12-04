import type { Game as GameType, Player } from "../types";

interface GameProps {
  game: GameType;
  currentPlayer: Player;
}

export function Game({ game, currentPlayer }: GameProps) {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-800 rounded-lg p-6 mb-4">
          <h1 className="text-2xl font-bold mb-2">Game Started!</h1>
          <p className="text-gray-400">Game Code: {game.code}</p>
          <p className="text-gray-400">Players: {game.players.length}</p>
          <p className="text-gray-400">Your name: {currentPlayer.name}</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-center text-xl">
            Game UI will be implemented in Phase 3
          </p>
        </div>
      </div>
    </div>
  );
}

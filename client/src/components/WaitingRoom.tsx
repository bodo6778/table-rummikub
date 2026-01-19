import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import type { Game, Player } from "../types";

interface WaitingRoomProps {
  socket: Socket | null;
  game: Game;
  currentPlayer: Player;
  onGameStarted: (game: Game) => void;
  onLeave: () => void;
}

export function WaitingRoom({
  socket,
  game: initialGame,
  currentPlayer,
  onGameStarted,
  onLeave,
}: WaitingRoomProps) {
  const [game, setGame] = useState(initialGame);

  useEffect(() => {
    if (!socket) return;

    socket.on("player-joined", ({ gameState }: { gameState: Game }) => {
      setGame(gameState);
    });

    socket.on("game-started", ({ gameState }: { gameState: Game }) => {
      onGameStarted(gameState);
    });

    socket.on("game-state-update", ({ gameState }: { gameState: Game }) => {
      setGame(gameState);
    });

    socket.on("player-left", ({ gameState }: { gameState: Game }) => {
      setGame(gameState);
    });

    socket.on("player-disconnected", ({ gameState }: { gameState: Game }) => {
      setGame(gameState);
    });

    socket.on("player-reconnected", ({ gameState }: { gameState: Game }) => {
      setGame(gameState);
    });

    return () => {
      socket.off("player-joined");
      socket.off("game-started");
      socket.off("game-state-update");
      socket.off("player-left");
      socket.off("player-disconnected");
      socket.off("player-reconnected");
    };
  }, [socket, onGameStarted]);

  const handleStartGame = () => {
    if (!socket) return;
    socket.emit("start-game", { code: game.code });
  };

  const isHost = game.players[0]?.id === currentPlayer.id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">
          Waiting Room
        </h1>

        <div className="bg-gray-100 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 text-center mb-1">Game Code</p>
          <p className="text-4xl font-bold text-center text-blue-600 tracking-wider">
            {game.code}
          </p>
          <p className="text-xs text-gray-500 text-center mt-1">
            Share this code with friends
          </p>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 text-gray-700">
            Players ({game.players.length}/4)
          </h2>
          <div className="space-y-2">
            {game.players.map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  player.connected ? "bg-gray-50" : "bg-yellow-50"
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full ${
                    !player.connected
                      ? "bg-yellow-500"
                      : player.id === currentPlayer.id
                        ? "bg-green-500"
                        : "bg-blue-500"
                  }`}
                ></div>
                <span className="font-medium text-gray-800">
                  {player.name}
                  {index === 0 && " (Host)"}
                  {player.id === currentPlayer.id && " (You)"}
                  {!player.connected && " - Disconnected"}
                </span>
              </div>
            ))}
            {[...Array(4 - game.players.length)].map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg opacity-50"
              >
                <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                <span className="text-gray-400 italic">
                  Waiting for player...
                </span>
              </div>
            ))}
          </div>
        </div>

        {isHost && (
          <button
            onClick={handleStartGame}
            disabled={game.players.length < 2}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
          >
            {game.players.length < 2 ? "Need at least 2 players" : "Start Game"}
          </button>
        )}

        {!isHost && (
          <div className="text-center text-gray-600 mb-4">
            <p>Waiting for host to start the game...</p>
          </div>
        )}

        <button
          onClick={onLeave}
          className="w-full mt-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition duration-200"
        >
          Leave Game
        </button>
      </div>
    </div>
  );
}

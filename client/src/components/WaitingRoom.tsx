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
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="bg-surface-700 border border-surface-400 rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-2 text-text-primary">
          Waiting Room
        </h1>

        <div className="bg-surface-800 border border-surface-400 rounded-xl p-4 mb-6">
          <p className="text-sm text-text-muted text-center mb-1">Game Code</p>
          <p className="text-4xl font-bold text-center text-accent-400 font-mono tracking-widest">
            {game.code}
          </p>
          <p className="text-xs text-text-muted text-center mt-1">
            Share this code with friends
          </p>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 text-text-secondary">
            Players ({game.players.length}/4)
          </h2>
          <div className="space-y-2">
            {game.players.map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  player.connected ? "bg-surface-600" : "bg-surface-600 border border-status-warning/30"
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full ${
                    !player.connected
                      ? "bg-status-warning"
                      : player.id === currentPlayer.id
                        ? "bg-status-success"
                        : "bg-accent-500"
                  }`}
                ></div>
                <span className="font-medium text-text-primary">
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
                className="flex items-center gap-3 p-3 bg-surface-800 rounded-lg opacity-40"
              >
                <div className="w-3 h-3 rounded-full bg-surface-400"></div>
                <span className="text-text-muted italic">
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
            className="w-full bg-accent-500 hover:bg-accent-400 disabled:bg-surface-500 disabled:text-text-muted text-surface-900 font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {game.players.length < 2 ? "Need at least 2 players" : "Start Game"}
          </button>
        )}

        {!isHost && (
          <div className="text-center text-text-secondary mb-4">
            <p>Waiting for host to start the game...</p>
          </div>
        )}

        <button
          onClick={onLeave}
          className="w-full mt-4 bg-surface-600 hover:bg-surface-500 text-text-secondary font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Leave Game
        </button>
      </div>
    </div>
  );
}

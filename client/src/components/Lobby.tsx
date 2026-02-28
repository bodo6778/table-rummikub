import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import type { Game, Player } from "../types";
import { useToast } from "../contexts/ToastContext";

interface LobbyProps {
  socket: Socket | null;
  onGameJoined: (game: Game, player: Player) => void;
  reconnectError?: string | null;
}

export function Lobby({ socket, onGameJoined, reconnectError }: LobbyProps) {
  const [playerName, setPlayerName] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const { showError, showWarning } = useToast();

  // Show reconnect error as toast
  useEffect(() => {
    if (reconnectError) {
      showWarning(`Could not rejoin previous game: ${reconnectError}`);
    }
  }, [reconnectError, showWarning]);

  const handleCreateGame = () => {
    if (!socket) {
      showError("Not connected to server");
      return;
    }
    if (!playerName.trim()) {
      showError("Please enter your name");
      return;
    }

    setIsCreating(true);

    socket.emit("create-game");

    socket.once("game-created", ({ code }: { code: string }) => {
      socket.emit("join-game", { code, playerName: playerName.trim() });
    });

    socket.once(
      "player-joined",
      ({ player, gameState }: { player: Player; gameState: Game }) => {
        setIsCreating(false);
        onGameJoined(gameState, player);
      }
    );

    socket.once("error", ({ message }: { message: string }) => {
      setIsCreating(false);
      showError(message);
    });
  };

  const handleJoinGame = () => {
    if (!socket) {
      showError("Not connected to server");
      return;
    }
    if (!playerName.trim() || !gameCode.trim()) {
      showError("Please enter your name and game code");
      return;
    }

    setIsJoining(true);

    socket.emit("join-game", {
      code: gameCode.toUpperCase(),
      playerName: playerName.trim(),
    });

    socket.once(
      "player-joined",
      ({ player, gameState }: { player: Player; gameState: Game }) => {
        setIsJoining(false);
        onGameJoined(gameState, player);
      }
    );

    socket.once("error", ({ message }: { message: string }) => {
      setIsJoining(false);
      showError(message);
    });
  };

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-surface-700 border border-surface-400 rounded-2xl shadow-2xl p-5 sm:p-8 max-w-md w-full">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-2 bg-gradient-to-r from-accent-400 to-accent-500 bg-clip-text text-transparent">
          Rummikub
        </h1>
        <p className="text-center text-text-secondary mb-8">Online Multiplayer</p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="playerName"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              Your Name
            </label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-600 border border-surface-400 rounded-lg text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-500 focus:border-transparent outline-none"
              placeholder="Enter your name"
              maxLength={20}
            />
          </div>

          <button
            onClick={handleCreateGame}
            disabled={isCreating || !playerName.trim()}
            className="w-full bg-accent-500 hover:bg-accent-400 disabled:bg-surface-500 disabled:text-text-muted text-surface-900 font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {isCreating ? "Creating..." : "Create New Game"}
          </button>

          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-surface-400"></div>
            <span className="text-text-muted text-sm">OR</span>
            <div className="flex-1 border-t border-surface-400"></div>
          </div>

          <div>
            <label
              htmlFor="gameCode"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              Game Code
            </label>
            <input
              id="gameCode"
              type="text"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-2.5 bg-surface-600 border border-surface-400 rounded-lg text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-500 focus:border-transparent outline-none uppercase"
              placeholder="ABCD"
              maxLength={4}
            />
          </div>

          <button
            onClick={handleJoinGame}
            disabled={isJoining || !playerName.trim() || !gameCode.trim()}
            className="w-full bg-surface-600 hover:bg-surface-500 border border-accent-500 text-accent-400 disabled:border-surface-400 disabled:text-text-muted font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {isJoining ? "Joining..." : "Join Game"}
          </button>
        </div>
      </div>
    </div>
  );
}

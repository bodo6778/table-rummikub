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
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-4xl font-bold text-center mb-2 text-gray-800">
          Rummikub
        </h1>
        <p className="text-center text-gray-600 mb-8">Online Multiplayer</p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="playerName"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Your Name
            </label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your name"
              maxLength={20}
            />
          </div>

          <button
            onClick={handleCreateGame}
            disabled={isCreating || !playerName.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
          >
            {isCreating ? "Creating..." : "Create New Game"}
          </button>

          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="text-gray-500 text-sm">OR</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          <div>
            <label
              htmlFor="gameCode"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Game Code
            </label>
            <input
              id="gameCode"
              type="text"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
              placeholder="ABCD"
              maxLength={4}
            />
          </div>

          <button
            onClick={handleJoinGame}
            disabled={isJoining || !playerName.trim() || !gameCode.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
          >
            {isJoining ? "Joining..." : "Join Game"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useSocket } from "./hooks/useSocket";
import { usePlayerIdentity } from "./hooks/usePlayerIdentity";
import { Lobby } from "./components/Lobby";
import { WaitingRoom } from "./components/WaitingRoom";
import { Game as GameComponent } from "./components/Game";
import type { Game, Player } from "./types";

type AppState = "lobby" | "waiting" | "playing" | "reconnecting";

function App() {
  const socket = useSocket();
  const { playerId, gameCode, saveIdentity, clearIdentity } = usePlayerIdentity();
  const [appState, setAppState] = useState<AppState>("lobby");
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [reconnectError, setReconnectError] = useState<string | null>(null);

  // Attempt to reconnect on mount if we have saved identity
  useEffect(() => {
    if (playerId && gameCode && appState === "lobby") {
      setAppState("reconnecting");
      socket.emit("reconnect-game", { code: gameCode, playerId });
    }
  }, [socket, playerId, gameCode, appState]);

  // Handle reconnection events
  useEffect(() => {
    const handleReconnectSuccess = (data: { player: Player; gameState: Game }) => {
      setCurrentGame(data.gameState);
      setCurrentPlayer(data.player);

      if (data.gameState.status === "waiting") {
        setAppState("waiting");
      } else if (data.gameState.status === "playing") {
        setAppState("playing");
      } else {
        // Game is finished or draw, go to lobby
        clearIdentity();
        setAppState("lobby");
      }
      setReconnectError(null);
    };

    const handleReconnectFailed = (data: { reason: string }) => {
      console.log("Reconnect failed:", data.reason);
      clearIdentity();
      setReconnectError(data.reason);
      setAppState("lobby");
    };

    socket.on("reconnect-success", handleReconnectSuccess);
    socket.on("reconnect-failed", handleReconnectFailed);

    return () => {
      socket.off("reconnect-success", handleReconnectSuccess);
      socket.off("reconnect-failed", handleReconnectFailed);
    };
  }, [socket, clearIdentity]);

  const handleGameJoined = (game: Game, player: Player) => {
    setCurrentGame(game);
    setCurrentPlayer(player);
    saveIdentity(player.id, player.name, game.code);
    setAppState("waiting");
  };

  const handleGameStarted = (game: Game) => {
    setCurrentGame(game);
    setAppState("playing");
  };

  const handleLeaveGame = () => {
    if (currentGame) {
      socket.emit("leave-game", { code: currentGame.code });
    }
    clearIdentity();
    setCurrentGame(null);
    setCurrentPlayer(null);
    setAppState("lobby");
  };

  if (appState === "reconnecting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Reconnecting to game...</p>
        </div>
      </div>
    );
  }

  if (appState === "lobby") {
    return (
      <Lobby
        socket={socket}
        onGameJoined={handleGameJoined}
        reconnectError={reconnectError}
      />
    );
  }

  if (appState === "waiting" && currentGame && currentPlayer) {
    return (
      <WaitingRoom
        socket={socket}
        game={currentGame}
        currentPlayer={currentPlayer}
        onGameStarted={handleGameStarted}
        onLeave={handleLeaveGame}
      />
    );
  }

  if (appState === "playing" && currentGame && currentPlayer) {
    return (
      <GameComponent
        game={currentGame}
        currentPlayer={currentPlayer}
        socket={socket}
        onLeave={handleLeaveGame}
      />
    );
  }

  return null;
}

export default App;

import { useState } from "react";
import { useSocket } from "./hooks/useSocket";
import { Lobby } from "./components/Lobby";
import { WaitingRoom } from "./components/WaitingRoom";
import { Game as GameComponent } from "./components/Game";
import type { Game, Player } from "./types";

type AppState = "lobby" | "waiting" | "playing";

function App() {
  const socket = useSocket();
  const [appState, setAppState] = useState<AppState>("lobby");
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);

  const handleGameJoined = (game: Game, player: Player) => {
    setCurrentGame(game);
    setCurrentPlayer(player);
    setAppState("waiting");
  };

  const handleGameStarted = (game: Game) => {
    setCurrentGame(game);
    setAppState("playing");
  };

  if (appState === "lobby") {
    return <Lobby socket={socket} onGameJoined={handleGameJoined} />;
  }

  if (appState === "waiting" && currentGame && currentPlayer) {
    return (
      <WaitingRoom
        socket={socket}
        game={currentGame}
        currentPlayer={currentPlayer}
        onGameStarted={handleGameStarted}
      />
    );
  }

  if (appState === "playing" && currentGame && currentPlayer) {
    return <GameComponent game={currentGame} currentPlayer={currentPlayer} />;
  }

  return null;
}

export default App;

import { useState, useEffect, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { Game as GameType, Player, Tile, Meld } from "../types";
import Rack from "./Rack";
import DrawOptions from "./DrawOptions";
import TurnIndicator from "./TurnIndicator";
import OpponentInfo from "./OpponentInfo";
import GameActions from "./GameActions";

interface GameProps {
  game: GameType;
  currentPlayer: Player;
  socket: Socket;
}

export function Game({ game: initialGame, currentPlayer, socket }: GameProps) {
  const [game, setGame] = useState<GameType>(initialGame);
  const [melds, setMelds] = useState<Meld[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Find current player's data from game state
  const myPlayer = game.players.find((p) => p.id === currentPlayer.id);
  const myRack = myPlayer?.rack || [];

  // Determine if it's my turn
  const isMyTurn = game.players[game.currentPlayerIndex]?.id === currentPlayer.id;
  const currentTurnPlayer = game.players[game.currentPlayerIndex];

  // Get left neighbor's dropped tile (player to my left, whose tile I can take)
  const myIndex = game.players.findIndex((p) => p.id === currentPlayer.id);
  const leftNeighborIndex = (myIndex - 1 + game.players.length) % game.players.length;
  const leftNeighbor = game.players[leftNeighborIndex];
  const neighborDroppedTile = leftNeighbor?.lastDroppedTile || null;

  // Get opponents (all players except me)
  const opponents = game.players.filter((p) => p.id !== currentPlayer.id);

  // Socket event handlers
  useEffect(() => {
    const handleGameStateUpdate = (data: { gameState: GameType }) => {
      setGame(data.gameState);
    };

    const handleTileDrawn = (data: { tile: Tile; gameState: GameType }) => {
      setGame(data.gameState);
    };

    const handlePlayerDrewTile = (data: { playerIndex: number; poolSize: number }) => {
      setGame((prev) => ({
        ...prev,
        pool: prev.pool.slice(0, data.poolSize),
        hasDrawnThisTurn: prev.currentPlayerIndex === data.playerIndex ? true : prev.hasDrawnThisTurn,
      }));
    };

    const handleTileDropped = (data: { playerIndex: number; tile: Tile; gameState: GameType }) => {
      setGame(data.gameState);
      // Clear selection after dropping
      if (game.players[data.playerIndex]?.id === currentPlayer.id) {
        setSelectedTileId(null);
      }
    };

    const handleTurnChanged = (data: { currentPlayerIndex: number }) => {
      setGame((prev) => ({
        ...prev,
        currentPlayerIndex: data.currentPlayerIndex,
        hasDrawnThisTurn: false,
      }));
    };

    const handleNeighborTileTaken = (data: { takerIndex: number; neighborIndex: number; gameState: GameType }) => {
      setGame(data.gameState);
    };

    const handleGameOver = (data: { winnerId: string; gameState: GameType; winningMelds?: Meld[]; isDraw?: boolean }) => {
      setGame(data.gameState);
    };

    const handleInvalidAnnounce = (data: { reason: string }) => {
      setError(data.reason);
      setTimeout(() => setError(null), 3000);
    };

    const handleError = (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(null), 3000);
    };

    socket.on("game-state-update", handleGameStateUpdate);
    socket.on("tile-drawn", handleTileDrawn);
    socket.on("player-drew-tile", handlePlayerDrewTile);
    socket.on("tile-dropped", handleTileDropped);
    socket.on("turn-changed", handleTurnChanged);
    socket.on("neighbor-tile-taken", handleNeighborTileTaken);
    socket.on("game-over", handleGameOver);
    socket.on("invalid-announce", handleInvalidAnnounce);
    socket.on("error", handleError);

    return () => {
      socket.off("game-state-update", handleGameStateUpdate);
      socket.off("tile-drawn", handleTileDrawn);
      socket.off("player-drew-tile", handlePlayerDrewTile);
      socket.off("tile-dropped", handleTileDropped);
      socket.off("turn-changed", handleTurnChanged);
      socket.off("neighbor-tile-taken", handleNeighborTileTaken);
      socket.off("game-over", handleGameOver);
      socket.off("invalid-announce", handleInvalidAnnounce);
      socket.off("error", handleError);
    };
  }, [socket, currentPlayer.id, game.players]);

  // Actions
  const handleDrawFromPool = useCallback(() => {
    socket.emit("draw-from-pool", { code: game.code });
  }, [socket, game.code]);

  const handleDrawFromNeighbor = useCallback(() => {
    socket.emit("draw-from-neighbor", { code: game.code });
  }, [socket, game.code]);

  const handleDropTile = useCallback(() => {
    if (!selectedTileId) return;
    socket.emit("drop-tile", { code: game.code, tileId: selectedTileId });
    setSelectedTileId(null);
  }, [socket, game.code, selectedTileId]);

  const handleAnnounceWin = useCallback(() => {
    socket.emit("announce-win", { code: game.code, melds });
  }, [socket, game.code, melds]);

  // Render game over screen
  if (game.status === "finished" || game.status === "draw") {
    const winner = game.players.find((p) => p.id === game.winnerId);
    const isWinner = game.winnerId === currentPlayer.id;

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          {game.status === "draw" ? (
            <>
              <h1 className="text-4xl font-bold text-gray-700 mb-4">Game Draw!</h1>
              <p className="text-gray-500 mb-6">The pool ran out with no winner.</p>
            </>
          ) : (
            <>
              <h1
                className={`text-4xl font-bold mb-4 ${
                  isWinner ? "text-yellow-500" : "text-gray-700"
                }`}
              >
                {isWinner ? "You Won!" : `${winner?.name} Wins!`}
              </h1>
              <p className="text-gray-500 mb-6">
                {isWinner
                  ? "Congratulations on your victory!"
                  : "Better luck next time!"}
              </p>
            </>
          )}
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 p-4">
      <div className="max-w-7xl mx-auto flex flex-col gap-4 h-full">
        {/* Header */}
        <div className="flex items-center justify-between bg-white/10 backdrop-blur rounded-xl px-4 py-3">
          <div className="text-white">
            <span className="text-sm opacity-75">Game Code:</span>
            <span className="ml-2 font-mono font-bold text-lg">{game.code}</span>
          </div>
          <TurnIndicator
            currentPlayerName={currentTurnPlayer?.name || ""}
            isMyTurn={isMyTurn}
          />
          <div className="text-white text-sm">
            Pool: <span className="font-bold">{game.pool.length}</span> tiles
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-500 text-white px-4 py-2 rounded-lg text-center animate-pulse">
            {error}
          </div>
        )}

        {/* Opponents row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {opponents.map((opponent) => (
            <OpponentInfo
              key={opponent.id}
              player={opponent}
              isCurrentTurn={game.players[game.currentPlayerIndex]?.id === opponent.id}
              tileCount={opponent.rack.length}
            />
          ))}
        </div>

        {/* Center area - Draw options */}
        <div className="flex-1 flex items-center justify-center bg-green-700/50 rounded-xl p-6">
          <DrawOptions
            poolSize={game.pool.length}
            neighborDroppedTile={neighborDroppedTile}
            neighborName={leftNeighbor?.name || null}
            canDraw={isMyTurn}
            hasDrawnThisTurn={game.hasDrawnThisTurn}
            onDrawFromPool={handleDrawFromPool}
            onDrawFromNeighbor={handleDrawFromNeighbor}
          />
        </div>

        {/* Game actions */}
        {isMyTurn && game.hasDrawnThisTurn && (
          <div className="bg-white/10 backdrop-blur rounded-xl p-4">
            <GameActions
              melds={melds}
              selectedTileId={selectedTileId}
              canDrop={isMyTurn && game.hasDrawnThisTurn}
              onDropTile={handleDropTile}
              onAnnounceWin={handleAnnounceWin}
            />
          </div>
        )}

        {/* Player's rack */}
        <Rack
          tiles={myRack}
          melds={melds}
          onMeldsChange={setMelds}
          selectedTileId={selectedTileId}
          onTileSelect={setSelectedTileId}
        />
      </div>
    </div>
  );
}

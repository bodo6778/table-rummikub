import { useState, useEffect, useCallback } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { Socket } from "socket.io-client";
import type { Game as GameType, Player, Tile, Meld } from "../types";
import Rack from "./Rack";
import DrawOptions from "./DrawOptions";
import TurnIndicator from "./TurnIndicator";
import OpponentInfo from "./OpponentInfo";
import GameActions from "./GameActions";
import { useToast } from "../contexts/ToastContext";
import Confetti from "./Confetti";
import { playDraw, playDrop, playTurnNotify, playWin, playError, unlockAudio } from "../lib/sounds";

interface GameProps {
  game: GameType;
  currentPlayer: Player;
  socket: Socket;
  onLeave: () => void;
}

const GAME_VERSION = 1.2; // Increment this if we make non-backwards-compatible changes to game logic or state

function GameFallback() {
  return (
    <div className="min-h-screen bg-surface-800 flex items-center justify-center p-4">
      <div className="bg-surface-700 border border-surface-400 rounded-2xl shadow-2xl p-8 text-center max-w-sm w-full">
        <p className="text-text-primary font-semibold mb-2">Something went wrong</p>
        <p className="text-text-secondary text-sm mb-6">Please reload the page to continue.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-accent-500 hover:bg-accent-400 text-surface-900 rounded-lg font-semibold transition-colors"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

function getMeldsKey(gameCode: string, playerId: string) {
  return `rummikub_melds_${gameCode}_${playerId}`;
}

function loadMelds(gameCode: string, playerId: string, rackTileIds: Set<string>): Meld[] {
  try {
    const raw = sessionStorage.getItem(getMeldsKey(gameCode, playerId));
    if (!raw) return [];
    const parsed: Meld[] = JSON.parse(raw);
    return parsed
      .map((meld) => ({ ...meld, tiles: meld.tiles.filter((t) => rackTileIds.has(t.id)) }))
      .filter((meld) => meld.tiles.length > 0);
  } catch {
    return [];
  }
}

function GameInner({ game: initialGame, currentPlayer, socket, onLeave }: GameProps) {
  const [game, setGame] = useState<GameType>(initialGame);

  const meldsKey = getMeldsKey(initialGame.code, currentPlayer.id);
  const initialRackIds = new Set(
    (initialGame.players.find((p) => p.id === currentPlayer.id)?.rack ?? []).map((t) => t.id)
  );
  const [melds, setMelds] = useState<Meld[]>(() =>
    loadMelds(initialGame.code, currentPlayer.id, initialRackIds)
  );
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDropping, setIsDropping] = useState(false);
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [justDrawnTileId, setJustDrawnTileId] = useState<string | null>(null);
  const [droppingTileId, setDroppingTileId] = useState<string | null>(null);
  const { showError, showWarning, showInfo } = useToast();

  // Persist melds to sessionStorage whenever they change
  useEffect(() => {
    sessionStorage.setItem(meldsKey, JSON.stringify(melds));
  }, [melds, meldsKey]);

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
      setIsDrawing(false);
      setJustDrawnTileId(data.tile.id);
      setTimeout(() => setJustDrawnTileId(null), 600);
      playDraw();
    };

    const handlePlayerDrewTile = (data: { playerIndex: number; poolSize: number }) => {
      setGame((prev) => {
        const drawingPlayer = prev.players[data.playerIndex];
        const isOpponent = drawingPlayer && drawingPlayer.id !== currentPlayer.id;
        const newPlayers = isOpponent
          ? prev.players.map((player, index) =>
              index === data.playerIndex
                ? {
                    ...player,
                    rack: [
                      ...player.rack,
                      { id: `hidden-${Date.now()}`, color: "black" as const, number: 0, isJoker: false },
                    ],
                  }
                : player
            )
          : prev.players;
        return {
          ...prev,
          players: newPlayers,
          pool: prev.pool.slice(0, data.poolSize),
          hasDrawnThisTurn:
            prev.currentPlayerIndex === data.playerIndex ? true : prev.hasDrawnThisTurn,
        };
      });
    };

    const handleTileDropped = (data: { playerIndex: number; tile: Tile }) => {
      setGame((prev) => {
        const newPlayers = prev.players.map((player, index) => {
          if (index === data.playerIndex) {
            return {
              ...player,
              lastDroppedTile: data.tile,
              droppedTiles: [...(player.droppedTiles || []), data.tile],
              // Own rack: filter by id. Opponent rack: remove one placeholder tile.
              rack:
                player.id === currentPlayer.id
                  ? player.rack.filter((t) => t.id !== data.tile.id)
                  : player.rack.slice(0, -1),
            };
          }
          return player;
        });
        return { ...prev, players: newPlayers };
      });
      // Clear selection if it was my drop
      if (data.tile.id === selectedTileId) {
        setSelectedTileId(null);
      }
    };

    const handleTurnChanged = (data: { currentPlayerIndex: number }) => {
      setGame((prev) => {
        const isNowMyTurn = prev.players[data.currentPlayerIndex]?.id === currentPlayer.id;
        if (isNowMyTurn) {
          playTurnNotify();
        }
        return {
          ...prev,
          currentPlayerIndex: data.currentPlayerIndex,
          hasDrawnThisTurn: false,
        };
      });
      setIsDropping(false);
      setIsDrawing(false);
    };

    const handleNeighborTileTaken = (data: { takerIndex: number; neighborIndex: number }) => {
      setGame((prev) => {
        const newPlayers = prev.players.map((player, index) => {
          if (index === data.neighborIndex) {
            // Clear the neighbor's dropped tile
            return { ...player, lastDroppedTile: null };
          }
          return player;
        });
        return { ...prev, players: newPlayers, hasDrawnThisTurn: true };
      });
    };

    const handleGameOver = (data: { winnerId: string; gameState: GameType; winningMelds?: Meld[]; isDraw?: boolean }) => {
      setGame(data.gameState);
      setIsAnnouncing(false);
      if (data.winnerId === currentPlayer.id) {
        playWin();
      }
    };

    const handleInvalidAnnounce = (data: { reason: string }) => {
      playError();
      showError(`Invalid announcement: ${data.reason}`);
      setIsAnnouncing(false);
    };

    const handleError = (data: { message: string }) => {
      playError();
      showError(data.message);
      setIsDrawing(false);
      setIsDropping(false);
      setIsAnnouncing(false);
    };

    const handlePlayerDisconnected = (data: { playerId: string; playerName: string; gameState: GameType }) => {
      setGame(data.gameState);
      showWarning(`${data.playerName} disconnected`);
    };

    const handlePlayerReconnected = (data: { playerId: string; gameState: GameType }) => {
      setGame(data.gameState);
      const player = data.gameState.players.find(p => p.id === data.playerId);
      if (player) {
        showInfo(`${player.name} reconnected`);
      }
    };

    const handlePlayerLeft = (data: { playerId: string; playerName: string; gameState: GameType }) => {
      setGame(data.gameState);
      showWarning(`${data.playerName} left the game`);
    };

    const handleTurnSkipped = (data: { skippedPlayerId: string; skippedPlayerName: string; gameState: GameType }) => {
      setGame(data.gameState);
      showInfo(`${data.skippedPlayerName}'s turn was skipped`);
    };

    const handleRematchStarted = (data: { gameState: GameType }) => {
      setGame(data.gameState);
      sessionStorage.removeItem(meldsKey);
      setMelds([]);
      setSelectedTileId(null);
      setIsDrawing(false);
      setIsDropping(false);
      setIsAnnouncing(false);
      setJustDrawnTileId(null);
      setDroppingTileId(null);
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
    socket.on("player-disconnected", handlePlayerDisconnected);
    socket.on("player-reconnected", handlePlayerReconnected);
    socket.on("player-left", handlePlayerLeft);
    socket.on("turn-skipped", handleTurnSkipped);
    socket.on("rematch-started", handleRematchStarted);

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
      socket.off("player-disconnected", handlePlayerDisconnected);
      socket.off("player-reconnected", handlePlayerReconnected);
      socket.off("player-left", handlePlayerLeft);
      socket.off("turn-skipped", handleTurnSkipped);
      socket.off("rematch-started", handleRematchStarted);
    };
  }, [socket, currentPlayer.id, selectedTileId, showError, showWarning, showInfo]);

  // Actions
  const handleDrawFromPool = useCallback(() => {
    unlockAudio();
    setIsDrawing(true);
    socket.emit("draw-from-pool", { code: game.code });
  }, [socket, game.code]);

  const handleDrawFromNeighbor = useCallback(() => {
    unlockAudio();
    setIsDrawing(true);
    socket.emit("draw-from-neighbor", { code: game.code });
  }, [socket, game.code]);

  const handleDropTile = useCallback(() => {
    if (!selectedTileId) return;
    playDrop();
    setDroppingTileId(selectedTileId);
    setIsDropping(true);
    // Remove tile from melds if it was in one
    setMelds((prev) =>
      prev.map((meld) => ({
        ...meld,
        tiles: meld.tiles.filter((t) => t.id !== selectedTileId),
      })),
    );
    // Brief delay for drop animation to play
    setTimeout(() => {
      socket.emit("drop-tile", { code: game.code, tileId: selectedTileId });
      setSelectedTileId(null);
      setDroppingTileId(null);
    }, 250);
  }, [socket, game.code, selectedTileId]);

  const handleAnnounceWin = useCallback(() => {
    setIsAnnouncing(true);
    socket.emit("announce-win", { code: game.code, melds, winningTileId: selectedTileId });
  }, [socket, game.code, melds, selectedTileId]);

  const handleRequestSkipTurn = useCallback(() => {
    socket.emit("request-skip-turn", { code: game.code });
  }, [socket, game.code]);

  // Check if current player is disconnected (for skip turn button)
  const isCurrentPlayerDisconnected = currentTurnPlayer && !currentTurnPlayer.connected;

  // Render game over screen
  if (game.status === "finished" || game.status === "draw") {
    const winner = game.players.find((p) => p.id === game.winnerId);
    const isWinner = game.winnerId === currentPlayer.id;

    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4 animate-fade-in">
        {isWinner && <Confetti />}
        <div className="bg-surface-700 border border-surface-400 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center animate-pop-in">
          {game.status === "draw" ? (
            <>
              <h1 className="text-4xl font-bold text-text-primary mb-4 animate-bounce-in">Game Draw!</h1>
              <p className="text-text-secondary mb-6">The pool ran out with no winner.</p>
            </>
          ) : (
            <>
              <h1
                className={`text-4xl font-bold mb-4 animate-bounce-in ${
                  isWinner ? "text-accent-400" : "text-text-primary"
                }`}
              >
                {isWinner ? "You Won!" : `${winner?.name} Wins!`}
              </h1>
              <p className="text-text-secondary mb-6">
                {isWinner
                  ? "Congratulations on your victory!"
                  : "Better luck next time!"}
              </p>
            </>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => socket.emit("rematch", { code: game.code })}
              className="px-6 py-3 bg-accent-500 hover:bg-accent-400 text-surface-900 rounded-lg font-semibold transition-colors"
            >
              Rematch
            </button>
            <button
              onClick={onLeave}
              className="px-6 py-3 bg-surface-600 hover:bg-surface-500 text-text-secondary rounded-lg font-semibold transition-colors border border-surface-400"
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-800 p-2 sm:p-4">
      <div className="max-w-7xl mx-auto flex flex-col gap-3 sm:gap-4 h-full">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-0 sm:justify-between bg-surface-700 border border-surface-400 rounded-xl px-3 py-2 sm:px-4 sm:py-3">
          <div className="text-text-primary">
            <span className="text-xs sm:text-sm text-text-secondary">Code:</span>
            <span className="ml-1 sm:ml-2 font-mono font-bold text-sm sm:text-lg">{game.code}</span>
            <span className="text-xs sm:text-sm text-text-secondary ml-4">Version:</span>
            <span className="ml-1 sm:ml-2 font-mono font-bold text-sm sm:text-lg">{GAME_VERSION}</span>
          </div>
          <TurnIndicator
            currentPlayerName={currentTurnPlayer?.name || ""}
            isMyTurn={isMyTurn}
          />
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="text-text-secondary text-xs sm:text-sm">
              Pool: <span className="font-bold text-text-primary">{game.pool.length}</span>
            </div>
            <button
              onClick={onLeave}
              className="px-2 py-1 sm:px-3 bg-status-error/20 hover:bg-status-error/40 text-status-error text-xs sm:text-sm rounded-lg transition-colors"
            >
              Leave
            </button>
          </div>
        </div>

        {/* Skip turn notice for disconnected player */}
        {isCurrentPlayerDisconnected && !isMyTurn && (
          <div className="bg-status-warning/20 border border-status-warning/40 text-status-warning px-3 py-2 sm:px-4 sm:py-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:justify-between text-sm">
            <span>{currentTurnPlayer?.name} is disconnected. Skip their turn after 60s.</span>
            <button
              onClick={handleRequestSkipTurn}
              className="px-4 py-1 bg-status-warning text-surface-900 rounded-lg font-medium hover:bg-status-warning/80 transition-colors"
            >
              Skip Turn
            </button>
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
        <div className="flex-1 flex items-center justify-center bg-surface-700/50 border border-surface-400/50 rounded-xl p-3 sm:p-6">
          <DrawOptions
            poolSize={game.pool.length}
            neighborDroppedTile={neighborDroppedTile}
            neighborName={leftNeighbor?.name || null}
            canDraw={isMyTurn}
            hasDrawnThisTurn={game.hasDrawnThisTurn}
            isLoading={isDrawing}
            onDrawFromPool={handleDrawFromPool}
            onDrawFromNeighbor={handleDrawFromNeighbor}
          />
        </div>

        {/* Game actions */}
        {isMyTurn && game.hasDrawnThisTurn && (
          <div className="bg-surface-700 border border-surface-400 rounded-xl p-2 sm:p-4">
            <GameActions
              melds={melds}
              selectedTileId={selectedTileId}
              canDrop={isMyTurn && game.hasDrawnThisTurn}
              isDropping={isDropping}
              isAnnouncing={isAnnouncing}
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
          justDrawnTileId={justDrawnTileId}
          droppingTileId={droppingTileId}
        />
      </div>
    </div>
  );
}

export function Game(props: GameProps) {
  return (
    <ErrorBoundary onError={(error, info) => console.log(error, info)} FallbackComponent={GameFallback}>
      <GameInner {...props} />
    </ErrorBoundary>
  );
}

import { Server, Socket } from "socket.io";
import { createGame, getGame, saveGame } from "../game/state.js";
import { Player } from "../../types/index.js";

export function registerSocketHandlers(io: Server, socket: Socket) {
  console.log(`Client connected: ${socket.id}`);

  socket.on("create-game", async () => {
    try {
      const game = await createGame();
      socket.emit("game-created", { code: game.code });
      console.log(`Game created: ${game.code}`);
    } catch (error) {
      console.error("Error creating game:", error);
      socket.emit("error", { message: "Failed to create game" });
    }
  });

  socket.on("join-game", async ({ code, playerName }: { code: string; playerName: string }) => {
    try {
      const game = await getGame(code);

      if (!game) {
        socket.emit("error", { message: "Game not found" });
        return;
      }

      if (game.status !== "waiting") {
        socket.emit("error", { message: "Game already started" });
        return;
      }

      if (game.players.length >= 4) {
        socket.emit("error", { message: "Game is full" });
        return;
      }

      const player: Player = {
        id: crypto.randomUUID(),
        name: playerName,
        socketId: socket.id,
        rack: [],
        board: [],
        hasInitialMeld: false,
      };

      game.players.push(player);
      await saveGame(game);

      socket.join(code);
      socket.emit("player-joined", { player, gameState: game });
      socket.to(code).emit("player-joined", { player, gameState: game });

      console.log(`${playerName} joined game ${code} (${game.players.length}/4)`);
    } catch (error) {
      console.error("Error joining game:", error);
      socket.emit("error", { message: "Failed to join game" });
    }
  });

  socket.on("start-game", async ({ code }: { code: string }) => {
    try {
      const game = await getGame(code);

      if (!game) {
        socket.emit("error", { message: "Game not found" });
        return;
      }

      if (game.players.length < 2) {
        socket.emit("error", { message: "Need at least 2 players to start" });
        return;
      }

      if (game.status !== "waiting") {
        socket.emit("error", { message: "Game already started" });
        return;
      }

      // Game start logic will be implemented in Phase 2
      game.status = "playing";
      await saveGame(game);

      io.to(code).emit("game-started", { gameState: game });
      console.log(`Game ${code} started with ${game.players.length} players`);
    } catch (error) {
      console.error("Error starting game:", error);
      socket.emit("error", { message: "Failed to start game" });
    }
  });

  socket.on("leave-game", async ({ code }: { code: string }) => {
    try {
      const game = await getGame(code);

      if (!game) {
        return;
      }

      game.players = game.players.filter((p) => p.socketId !== socket.id);
      await saveGame(game);

      socket.leave(code);
      socket.to(code).emit("game-state-update", { gameState: game });

      console.log(`Player left game ${code}`);
    } catch (error) {
      console.error("Error leaving game:", error);
    }
  });

  socket.on("disconnect", async () => {
    console.log(`Client disconnected: ${socket.id}`);
    // Handle disconnect - player reconnect logic will be in Phase 4
  });
}

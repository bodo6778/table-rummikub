import { useState } from "react";

// sessionStorage clears on tab close, limiting the window for session hijacking
const PLAYER_ID_KEY = "rummikub_player_id";
const PLAYER_NAME_KEY = "rummikub_player_name";
const GAME_CODE_KEY = "rummikub_game_code";
const RECONNECT_TOKEN_KEY = "rummikub_reconnect_token";

interface PlayerIdentity {
  playerId: string | null;
  playerName: string | null;
  gameCode: string | null;
  reconnectToken: string | null;
}

interface UsePlayerIdentityReturn extends PlayerIdentity {
  saveIdentity: (playerId: string, playerName: string, gameCode: string, reconnectToken: string) => void;
  clearIdentity: () => void;
  updateGameCode: (gameCode: string | null) => void;
}

export function usePlayerIdentity(): UsePlayerIdentityReturn {
  const [identity, setIdentity] = useState<PlayerIdentity>(() => {
    if (typeof window === "undefined") {
      return { playerId: null, playerName: null, gameCode: null, reconnectToken: null };
    }
    return {
      playerId: sessionStorage.getItem(PLAYER_ID_KEY),
      playerName: sessionStorage.getItem(PLAYER_NAME_KEY),
      gameCode: sessionStorage.getItem(GAME_CODE_KEY),
      reconnectToken: sessionStorage.getItem(RECONNECT_TOKEN_KEY),
    };
  });

  const saveIdentity = (
    playerId: string,
    playerName: string,
    gameCode: string,
    reconnectToken: string
  ) => {
    sessionStorage.setItem(PLAYER_ID_KEY, playerId);
    sessionStorage.setItem(PLAYER_NAME_KEY, playerName);
    sessionStorage.setItem(GAME_CODE_KEY, gameCode);
    sessionStorage.setItem(RECONNECT_TOKEN_KEY, reconnectToken);
    setIdentity({ playerId, playerName, gameCode, reconnectToken });
  };

  const clearIdentity = () => {
    sessionStorage.removeItem(PLAYER_ID_KEY);
    sessionStorage.removeItem(PLAYER_NAME_KEY);
    sessionStorage.removeItem(GAME_CODE_KEY);
    sessionStorage.removeItem(RECONNECT_TOKEN_KEY);
    setIdentity({ playerId: null, playerName: null, gameCode: null, reconnectToken: null });
  };

  const updateGameCode = (gameCode: string | null) => {
    if (gameCode) {
      sessionStorage.setItem(GAME_CODE_KEY, gameCode);
    } else {
      sessionStorage.removeItem(GAME_CODE_KEY);
    }
    setIdentity((prev) => ({ ...prev, gameCode }));
  };

  return {
    ...identity,
    saveIdentity,
    clearIdentity,
    updateGameCode,
  };
}

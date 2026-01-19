import { useState } from "react";

const PLAYER_ID_KEY = "rummikub_player_id";
const PLAYER_NAME_KEY = "rummikub_player_name";
const GAME_CODE_KEY = "rummikub_game_code";

interface PlayerIdentity {
  playerId: string | null;
  playerName: string | null;
  gameCode: string | null;
}

interface UsePlayerIdentityReturn extends PlayerIdentity {
  saveIdentity: (playerId: string, playerName: string, gameCode: string) => void;
  clearIdentity: () => void;
  updateGameCode: (gameCode: string | null) => void;
}

export function usePlayerIdentity(): UsePlayerIdentityReturn {
  const [identity, setIdentity] = useState<PlayerIdentity>(() => {
    // Initialize from localStorage
    if (typeof window === "undefined") {
      return { playerId: null, playerName: null, gameCode: null };
    }
    return {
      playerId: localStorage.getItem(PLAYER_ID_KEY),
      playerName: localStorage.getItem(PLAYER_NAME_KEY),
      gameCode: localStorage.getItem(GAME_CODE_KEY),
    };
  });

  const saveIdentity = (playerId: string, playerName: string, gameCode: string) => {
    localStorage.setItem(PLAYER_ID_KEY, playerId);
    localStorage.setItem(PLAYER_NAME_KEY, playerName);
    localStorage.setItem(GAME_CODE_KEY, gameCode);
    setIdentity({ playerId, playerName, gameCode });
  };

  const clearIdentity = () => {
    localStorage.removeItem(PLAYER_ID_KEY);
    localStorage.removeItem(PLAYER_NAME_KEY);
    localStorage.removeItem(GAME_CODE_KEY);
    setIdentity({ playerId: null, playerName: null, gameCode: null });
  };

  const updateGameCode = (gameCode: string | null) => {
    if (gameCode) {
      localStorage.setItem(GAME_CODE_KEY, gameCode);
    } else {
      localStorage.removeItem(GAME_CODE_KEY);
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

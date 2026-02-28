interface TurnIndicatorProps {
  currentPlayerName: string;
  isMyTurn: boolean;
}

export default function TurnIndicator({
  currentPlayerName,
  isMyTurn,
}: TurnIndicatorProps) {
  return (
    <div
      className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full font-semibold text-center text-xs sm:text-sm transition-all ${
        isMyTurn
          ? "bg-accent-500 text-surface-900 animate-pulse-glow"
          : "bg-surface-600 text-text-secondary"
      }`}
    >
      {isMyTurn ? "Your turn!" : `${currentPlayerName}'s turn`}
    </div>
  );
}

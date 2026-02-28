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
      className={`px-4 py-2 rounded-full font-semibold text-center transition-all ${
        isMyTurn
          ? "bg-accent-500 text-surface-900 animate-pulse-glow"
          : "bg-surface-600 text-text-secondary"
      }`}
    >
      {isMyTurn ? "Your turn!" : `${currentPlayerName}'s turn`}
    </div>
  );
}

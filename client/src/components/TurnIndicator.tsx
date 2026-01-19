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
          ? "bg-green-500 text-white animate-pulse"
          : "bg-gray-200 text-gray-700"
      }`}
    >
      {isMyTurn ? "Your turn!" : `${currentPlayerName}'s turn`}
    </div>
  );
}

import type React from 'react';
import { type Game, GameState, Choice } from '../types';

interface RevealChoiceViewProps {
  gameData: Game;
  userPublicKey: string;
  userChoice: number;
  onRevealChoice: () => void;
  loading: boolean;
}

const RevealChoiceView: React.FC<RevealChoiceViewProps> = ({
  gameData,
  userPublicKey,
  userChoice,
  onRevealChoice,
  loading
}) => {
  // Get player info
  const currentPlayer = gameData.players.find(
    player => player.pubkey === userPublicKey
  );

  // Check if player has already revealed
  const hasRevealed = currentPlayer?.revealed;

  // Get choice emoji
  const getChoiceEmoji = (choice: number) => {
    switch (choice) {
      case Choice.Rock:
        return '👊';
      case Choice.Paper:
        return '✋';
      case Choice.Scissors:
        return '✌️';
      default:
        return '❓';
    }
  };

  // Get choice name
  const getChoiceName = (choice: number) => {
    switch (choice) {
      case Choice.Rock:
        return 'Rock';
      case Choice.Paper:
        return 'Paper';
      case Choice.Scissors:
        return 'Scissors';
      default:
        return 'Unknown';
    }
  };

  // Get player status
  const getPlayerStatus = (player: any) => {
    if (player.pubkey === userPublicKey) {
      return hasRevealed ? 'You have revealed your choice' : 'Reveal your choice';
    }
    return player.revealed
      ? 'Has revealed their choice'
      : 'Waiting for reveal';
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Reveal Your Choice</h2>
          <p className="text-gray-300">
            All players have committed their choices. Now it's time to reveal what you selected.
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-pulse">{getChoiceEmoji(userChoice)}</div>
            <h3 className="text-xl font-bold">{getChoiceName(userChoice)}</h3>
            <p className="text-gray-400 mt-1">Your committed choice</p>
          </div>
        </div>

        <div className="text-center mb-8">
          <button
            onClick={onRevealChoice}
            className={`px-8 py-3 rounded-lg font-bold ${
              !hasRevealed && !loading
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                : 'bg-gray-600 cursor-not-allowed opacity-50'
            }`}
            disabled={hasRevealed || loading}
          >
            {loading
              ? 'Revealing...'
              : hasRevealed
              ? 'Choice Revealed'
              : 'Reveal Choice'}
          </button>

          {hasRevealed && (
            <p className="mt-2 text-green-400">
              Your choice has been revealed! Waiting for other players...
            </p>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Player Status</h3>

          <div className="space-y-2">
            {gameData.players.map((player, index) => (
              <div
                key={index}
                className="flex justify-between items-center bg-gray-700 p-3 rounded-lg"
              >
                <div className="flex items-center">
                  <span className="text-xl mr-3">
                    {player.pubkey === userPublicKey ? '👤' : '👥'}
                  </span>
                  <span>
                    {`Player ${index + 1}`}
                    {player.pubkey === userPublicKey && ' (You)'}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className={`text-sm ${
                    player.revealed
                      ? 'text-green-400'
                      : 'text-yellow-400'
                  }`}>
                    {getPlayerStatus(player)}
                  </span>
                  {player.revealed && (
                    <span className="ml-2 text-green-400">✓</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 bg-purple-900 bg-opacity-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">What happens next?</h3>
          <p className="text-gray-300 text-sm">
            Once all players have revealed their choices, the game will determine the winner based on the
            rock-paper-scissors rules. Each player's choice will be compared against all other players,
            and points will be awarded for each winning comparison.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RevealChoiceView;

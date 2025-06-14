import type React from 'react';
import { useState } from 'react';
import { type Game, GameState, Choice } from '../types';

interface CommitChoiceViewProps {
  gameData: Game;
  userPublicKey: string;
  onCommitChoice: (choice: number) => void;
  loading: boolean;
}

const CommitChoiceView: React.FC<CommitChoiceViewProps> = ({
  gameData,
  userPublicKey,
  onCommitChoice,
  loading
}) => {
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  // Get player info
  const currentPlayer = gameData.players.find(
    player => player.pubkey === userPublicKey
  );

  // Check if player has already committed
  const hasCommitted = currentPlayer?.committedChoice?.some(b => b !== 0);

  // Options for the game
  const choices = [
    { value: Choice.Rock, emoji: '👊', label: 'Rock' },
    { value: Choice.Paper, emoji: '✋', label: 'Paper' },
    { value: Choice.Scissors, emoji: '✌️', label: 'Scissors' }
  ];

  // Handle selecting and committing a choice
  const handleSelect = (choice: number) => {
    if (loading || hasCommitted) return;
    setSelectedChoice(choice);
  };

  const handleCommit = () => {
    if (selectedChoice !== null && !loading && !hasCommitted) {
      onCommitChoice(selectedChoice);
    }
  };

  // Get player status
  const getPlayerStatus = (player: any) => {
    if (player.pubkey === userPublicKey) {
      return hasCommitted ? 'You have committed your choice' : 'Make your choice';
    }
    return player.committedChoice?.some(b => b !== 0)
      ? 'Has committed a choice'
      : 'Waiting for choice';
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Make Your Choice</h2>
          <p className="text-gray-300">
            Choose rock, paper, or scissors. Your choice will be kept secret until everyone reveals.
          </p>
        </div>

        <div className="flex flex-col md:flex-row justify-center gap-4 mb-8">
          {choices.map((choice) => (
            <div
              key={choice.value}
              className={`choice-btn ${
                selectedChoice === choice.value
                  ? 'choice-btn-selected'
                  : 'choice-btn-default'
              } ${hasCommitted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              onClick={() => handleSelect(choice.value)}
            >
              <div className="text-5xl mb-2">{choice.emoji}</div>
              <div className="font-medium">{choice.label}</div>
            </div>
          ))}
        </div>

        <div className="text-center mb-8">
          <button
            onClick={handleCommit}
            className={`px-8 py-3 rounded-lg font-bold ${
              selectedChoice !== null && !hasCommitted && !loading
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                : 'bg-gray-600 cursor-not-allowed opacity-50'
            }`}
            disabled={selectedChoice === null || hasCommitted || loading}
          >
            {loading
              ? 'Committing...'
              : hasCommitted
              ? 'Choice Committed'
              : 'Commit Choice'}
          </button>

          {hasCommitted && (
            <p className="mt-2 text-green-400">
              Your choice has been committed! Waiting for other players...
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
                    player.committedChoice?.some(b => b !== 0)
                      ? 'text-green-400'
                      : 'text-yellow-400'
                  }`}>
                    {getPlayerStatus(player)}
                  </span>
                  {player.committedChoice?.some(b => b !== 0) && (
                    <span className="ml-2 text-green-400">✓</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommitChoiceView;

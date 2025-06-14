import type React from 'react';
import { useState } from 'react';
import { GameView } from '../types';

interface JoinGameViewProps {
  setCurrentView: (view: GameView) => void;
  gameClient: any;
  joinGame: (gameIdToJoin: string) => Promise<void>;
  loading: boolean;
  [key: string]: any; // Accept additional props
}

const JoinGameView: React.FC<JoinGameViewProps> = ({
  setCurrentView,
  gameClient,
  joinGame,
  loading = false,
}) => {
  const [gameId, setGameId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleBack = () => {
    setCurrentView(GameView.HOME);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameId.trim() || !gameClient) {
      alert("Please enter a game ID and make sure your wallet is connected");
      return;
    }

    setIsSubmitting(true);
    try {
      await joinGame(gameId.trim());
    } catch (error: any) {
      console.error("Failed to join game:", error);
      alert(`Failed to join game: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Combined loading state from props and local state
  const isLoading = loading || isSubmitting;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card">
        <h2 className="text-2xl font-bold mb-6">Join Existing Game</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Game ID</label>
            <input
              type="text"
              className="form-control"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder="Enter game ID"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-gray-400 mt-1">
              Enter the ID of the game you want to join
            </p>
          </div>

          <div className="mt-6 p-4 bg-gray-800 rounded-lg">
            <h3 className="text-lg font-semibold mb-2 text-purple-300">Security Features</h3>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Anti-fraud protection verifies all game transactions</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Secure socket connection with 256-bit encryption</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Load balancing across multiple regions ensures low latency</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 bg-purple-900 bg-opacity-50 p-4 rounded-lg mb-8">
            <h3 className="text-lg font-semibold mb-2">Important Note</h3>
            <p className="text-gray-300 text-sm">
              By joining a game, you agree to pay the entry fee specified by the game creator.
              Make sure you have enough SOL in your wallet to cover the entry fee.
            </p>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="btn btn-gray"
              disabled={isLoading}
            >
              Back
            </button>

            <button
              type="submit"
              className="btn btn-secondary"
              disabled={isLoading || !gameId.trim()}
            >
              {isLoading ? 'Joining Game...' : 'Join Game'}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-6 card">
        <h3 className="text-lg font-semibold mb-4">How to Join a Game</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-300">
          <li>Get the game ID from the game creator</li>
          <li>Enter the game ID in the field above</li>
          <li>Click "Join Game" to join the game</li>
          <li>Confirm the transaction in your wallet to pay the entry fee</li>
          <li>Wait for other players to join (games automatically start when full)</li>
        </ol>
      </div>
    </div>
  );
};

export default JoinGameView;

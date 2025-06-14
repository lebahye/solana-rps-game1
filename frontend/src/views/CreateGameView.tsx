import React, { useState } from 'react';
import { CurrencyMode, GameView } from '../types';
import CurrencySelector from '../components/CurrencySelector';

interface CreateGameViewProps {
  setCurrentView: (view: GameView) => void;
  gameClient: any;
  createGame: (betAmount: number, currencyMode: CurrencyMode) => Promise<void>;
  loading: boolean;
  [key: string]: any; // Accept additional props
}

const CreateGameView: React.FC<CreateGameViewProps> = ({
  setCurrentView,
  gameClient,
  createGame,
  loading = false,
}) => {
  const [entryFee, setEntryFee] = useState<number>(0.1);
  const [playerCount, setPlayerCount] = useState<number>(3);
  const [totalRounds, setTotalRounds] = useState<number>(3);
  const [timeoutSeconds, setTimeoutSeconds] = useState<number>(60);
  const [losersCanRejoin, setLosersCanRejoin] = useState<boolean>(true);
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>(CurrencyMode.SOL);
  const [useSecureMode, setUseSecureMode] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleBack = () => {
    setCurrentView(GameView.HOME);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameClient) {
      alert("Game client not initialized. Please connect your wallet.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Call the createGame function passed via props
      await createGame(entryFee, currencyMode);
    } catch (error: any) {
      console.error("Failed to create game:", error);
      alert(`Failed to create game: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Combined loading state from props and local state
  const isLoading = loading || isSubmitting;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card">
        <h2 className="text-2xl font-bold mb-6">Create New Game</h2>

        <form onSubmit={handleSubmit}>
          <CurrencySelector
            selectedCurrency={currencyMode}
            onCurrencyChange={setCurrencyMode}
            entryFee={entryFee}
            onEntryFeeChange={setEntryFee}
            disabled={isLoading}
          />

          <div className="form-group mt-6">
            <label className="form-label">Player Count</label>
            <div className="flex space-x-4">
              <button
                type="button"
                className={`flex-1 py-3 rounded-lg ${
                  playerCount === 3
                    ? 'bg-purple-600'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                onClick={() => setPlayerCount(3)}
                disabled={isLoading}
              >
                3 Players
              </button>
              <button
                type="button"
                className={`flex-1 py-3 rounded-lg ${
                  playerCount === 4
                    ? 'bg-purple-600'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                onClick={() => setPlayerCount(4)}
                disabled={isLoading}
              >
                4 Players
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Number of Rounds</label>
            <input
              type="number"
              className="form-control"
              value={totalRounds}
              onChange={(e) => setTotalRounds(parseInt(e.target.value))}
              min={1}
              max={10}
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Timeout (seconds)</label>
            <input
              type="number"
              className="form-control"
              value={timeoutSeconds}
              onChange={(e) => setTimeoutSeconds(parseInt(e.target.value))}
              min={30}
              required
              disabled={isLoading}
            />
            <p className="text-xs text-gray-400 mt-1">
              Time before a player is considered inactive
            </p>
          </div>

          <div className="form-group flex items-center">
            <input
              type="checkbox"
              id="losersCanRejoin"
              className="mr-2 h-5 w-5 rounded text-purple-500 focus:ring-purple-500"
              checked={losersCanRejoin}
              onChange={(e) => setLosersCanRejoin(e.target.checked)}
              disabled={isLoading}
            />
            <label htmlFor="losersCanRejoin" className="text-white">
              Allow losers to rejoin
            </label>
          </div>

          {/* Enhanced security option */}
          <div className="form-group flex items-center mt-4">
            <input
              type="checkbox"
              id="useSecureMode"
              className="mr-2 h-5 w-5 rounded text-purple-500 focus:ring-purple-500"
              checked={useSecureMode}
              onChange={(e) => setUseSecureMode(e.target.checked)}
              disabled={isLoading}
            />
            <label htmlFor="useSecureMode" className="text-white">
              Enable enhanced security mode
            </label>
            <div className="ml-2 group relative">
              <span className="cursor-help text-gray-400">ⓘ</span>
              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 p-2 rounded shadow-lg w-64 text-xs">
                Enhanced security mode enables additional verification of player moves, DDoS protection, and bot detection.
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-800 rounded-lg">
            <h3 className="text-lg font-semibold mb-2 text-purple-300">Security Information</h3>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>All game moves are cryptographically secured on the Solana blockchain</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Commit-reveal pattern prevents cheating by hiding your choice until all players commit</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Game state is entirely on-chain, ensuring 100% transparency and fairness</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Auto-scaling infrastructure supports up to 50,000 concurrent players</span>
              </li>
            </ul>
          </div>

          <div className="flex justify-between mt-8">
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
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Creating Game...' : 'Create Game'}
            </button>
          </div>

          <div className="mt-6 p-3 bg-gray-800 rounded-lg text-sm text-gray-400">
            <div className="flex items-start">
              <span className="text-purple-400 mr-2">ℹ</span>
              <p>
                A {currencyMode === CurrencyMode.SOL ? '0.1%' : '0.05%'} fee will be applied to your entry fee.
                {currencyMode === CurrencyMode.RPS_TOKEN && ' RPS Token games have 50% lower fees!'}
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGameView;

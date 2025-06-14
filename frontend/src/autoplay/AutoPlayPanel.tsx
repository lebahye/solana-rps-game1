import React, { useState, useEffect } from 'react';
import { AutoPlayStats, CurrencyMode, GameHistoryItem, BettingStrategy } from '../types';
import audioService from '../services/audio-service';

interface AutoPlayPanelProps {
  isActive: boolean;
  onToggle: () => void;
  wagerAmount: number;
  setWagerAmount: (amount: number) => void;
  stats: AutoPlayStats;
  selectedCurrency: CurrencyMode;
  onCurrencyChange: (currency: CurrencyMode) => void;
  gameHistory: GameHistoryItem[];
  strategy: BettingStrategy;
  onStrategyChange?: (strategy: BettingStrategy) => void; // Added onStrategyChange prop
  gameSpeed: number;
  onGameSpeedChange?: (speed: number) => void; // Changed to onGameSpeedChange prop
  stopOnProfit: number;
  onStopProfitChange?: (value: number) => void; // Added onStopProfitChange prop
  stopOnLoss: number;
  onStopLossChange?: (value: number) => void; // Added onStopLossChange prop
  useStopLimits: boolean;
  onUseStopLimitsChange?: (value: boolean) => void; // Added onUseStopLimitsChange prop
}

const AutoPlayPanel: React.FC<AutoPlayPanelProps> = ({
  isActive,
  onToggle,
  wagerAmount,
  setWagerAmount,
  stats,
  selectedCurrency,
  onCurrencyChange,
  gameHistory,
  strategy,
  onStrategyChange, // Added onStrategyChange to props
  gameSpeed,
  onGameSpeedChange, // Changed to onGameSpeedChange
  stopOnProfit,
  onStopProfitChange,
  stopOnLoss,
  onStopLossChange,
  useStopLimits,
  onUseStopLimitsChange,
}) => {
  const [animateWins, setAnimateWins] = useState(false);
  const [animateLosses, setAnimateLosses] = useState(false);
  const [animateProfit, setAnimateProfit] = useState(false);

  // Monitor stats changes to trigger animations
  useEffect(() => {
    // Play sounds on significant events
    if (gameHistory.length > 0) {
      const latestGame = gameHistory[gameHistory.length - 1];

      if (latestGame.result === 'win') {
        setAnimateWins(true);
        setTimeout(() => setAnimateWins(false), 1000);

        if (stats.netProfit > 0) {
          setAnimateProfit(true);
          setTimeout(() => setAnimateProfit(false), 1000);
        }
      } else if (latestGame.result === 'loss') {
        setAnimateLosses(true);
        setTimeout(() => setAnimateLosses(false), 1000);
      }
    }
  }, [gameHistory, stats.netProfit]);

  // Button sound effects
  const handleButtonHover = () => {
    audioService.play('hover');
  };

  const handleButtonClick = () => {
    audioService.play('click');
    onToggle();
  };

  // Ensure numeric values are valid and not NaN
  const safeNumber = (value: number | undefined): number => {
    return typeof value === 'number' && !isNaN(value) ? value : 0;
  };

  // Format numeric values for display with protection against NaN
  const formatNumber = (value: number): string => {
    const safeValue = safeNumber(value);
    return safeValue.toFixed(2);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 md:p-6 mb-8 shadow-lg border border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold">Auto Play</h3>
        <div className="flex items-center">
          <span className="mr-3 hidden sm:inline">{isActive ? 'Running' : 'Stopped'}</span>
          <button
            onClick={handleButtonClick}
            onMouseEnter={handleButtonHover}
            className={`px-4 py-2 rounded font-bold transform transition-all duration-150 hover:scale-105 ${
              isActive
                ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-700/20'
                : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-700/20'
            }`}
          >
            {isActive ? 'STOP' : 'START'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
        <div className="bg-gray-900 p-4 rounded-lg shadow-inner">
          <label className="block text-sm font-medium mb-2">Wager Amount</label>
          <div className="flex">
            <input
              type="number"
              value={wagerAmount}
              onChange={(e) => {
                setWagerAmount(parseFloat(e.target.value) || 0.01);
                audioService.play('hover');
              }}
              min="0.01"
              step="0.01"
              disabled={isActive}
              className="w-full px-4 py-2 bg-gray-700 rounded-l border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <select
              value={selectedCurrency}
              onChange={(e) => {
                // Convert string enum value to CurrencyMode enum
                const mode = e.target.value === "SOL" ? CurrencyMode.SOL : CurrencyMode.RPSTOKEN;
                onCurrencyChange(mode);
                audioService.play('click');
              }}
              disabled={isActive}
              className="bg-gray-700 border-l-0 border border-gray-600 rounded-r px-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="SOL">SOL</option>
              <option value="RPS_TOKEN">RPSTOKEN</option>
            </select>
          </div>
        </div>

        <div className="bg-gray-900 p-4 rounded-lg shadow-inner">
          <label className="block text-sm font-medium mb-2">Betting Strategy</label>
          <select
            value={strategy}
            onChange={(e) => {
              // Pass the selected strategy back to parent component
              const selectedStrategy = e.target.value as BettingStrategy;
              if (onStrategyChange) {
                onStrategyChange(selectedStrategy);
              }
              audioService.play('click');
            }}
            disabled={isActive}
            className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value={BettingStrategy.FIXED}>Fixed Bet</option>
            <option value={BettingStrategy.MARTINGALE}>Martingale (Double on Loss)</option>
            <option value={BettingStrategy.DALEMBERT}>D'Alembert (Increase 1 Unit on Loss)</option>
            <option value={BettingStrategy.FIBONACCI}>Fibonacci Sequence</option>
          </select>
        </div>

        <div className="bg-gray-900 p-4 rounded-lg shadow-inner">
          <label className="block text-sm font-medium mb-2">Game Speed (ms)</label>
          <input
            type="range"
            min="500"
            max="5000"
            step="500"
            value={gameSpeed}
            onChange={(e) => {
              if (onGameSpeedChange) { // Changed to onGameSpeedChange
                onGameSpeedChange(parseInt(e.target.value));
              }
              audioService.play('hover');
            }}
            disabled={isActive}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Fast</span>
            <span>{gameSpeed}ms</span>
            <span>Slow</span>
          </div>
        </div>

        <div className="bg-gray-900 p-4 rounded-lg shadow-inner">
          <div className="flex items-center mb-2">
            <input
              type="checkbox"
              id="useStopLimits"
              checked={useStopLimits}
              onChange={(e) => {
                if (onUseStopLimitsChange) {
                  onUseStopLimitsChange(e.target.checked);
                }
                audioService.play('click');
              }}
              disabled={isActive}
              className="mr-2 h-4 w-4 rounded text-purple-500 focus:ring-purple-500"
            />
            <label htmlFor="useStopLimits" className="text-sm font-medium">Auto-Stop Limits</label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400">Stop on Profit</label>
              <input
                type="number"
                value={stopOnProfit}
                onChange={(e) => {
                  if (onStopProfitChange) {
                    onStopProfitChange(parseFloat(e.target.value) || 0);
                  }
                  audioService.play('hover');
                }}
                min="0"
                step="0.1"
                disabled={isActive || !useStopLimits}
                className="w-full px-2 py-1 bg-gray-700 rounded border border-gray-600 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Stop on Loss</label>
              <input
                type="number"
                value={stopOnLoss}
                onChange={(e) => {
                  if (onStopLossChange) {
                    onStopLossChange(parseFloat(e.target.value) || 0);
                  }
                  audioService.play('hover');
                }}
                min="0"
                step="0.1"
                disabled={isActive || !useStopLimits}
                className="w-full px-2 py-1 bg-gray-700 rounded border border-gray-600 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Panel */}
      <div className="bg-gray-900 rounded-lg p-4 shadow-inner">
        <h4 className="text-lg font-medium mb-4">Session Stats</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div className="bg-gray-800 p-3 rounded-lg shadow">
            <div className="text-sm text-gray-400">Current Streak</div>
            <div className={`text-xl font-bold ${
              safeNumber(stats.currentStreak) > 0
                ? 'text-green-400 drop-shadow-glow-green'
                : safeNumber(stats.currentStreak) < 0
                  ? 'text-red-400 drop-shadow-glow-red'
                  : 'text-white'
            }`}>
              {safeNumber(stats.currentStreak) > 0 ? `+${safeNumber(stats.currentStreak)}` : safeNumber(stats.currentStreak)}
            </div>
          </div>

          <div className={`bg-gray-800 p-3 rounded-lg shadow transition-all duration-300 ${animateWins ? 'scale-110 bg-green-900 bg-opacity-50' : ''}`}>
            <div className="text-sm text-gray-400">Wins</div>
            <div className="text-xl font-bold text-green-400">{safeNumber(stats.wins)}</div>
          </div>

          <div className={`bg-gray-800 p-3 rounded-lg shadow transition-all duration-300 ${animateLosses ? 'scale-110 bg-red-900 bg-opacity-50' : ''}`}>
            <div className="text-sm text-gray-400">Losses</div>
            <div className="text-xl font-bold text-red-400">{safeNumber(stats.losses)}</div>
          </div>

          <div className="bg-gray-800 p-3 rounded-lg shadow">
            <div className="text-sm text-gray-400">Total Wagered</div>
            <div className="text-xl font-bold">{formatNumber(stats.totalWagered)} {selectedCurrency === CurrencyMode.SOL ? 'SOL' : 'RPSTOKEN'}</div>
          </div>

          <div className={`bg-gray-800 p-3 rounded-lg shadow transition-all duration-300 ${animateProfit ? 'scale-110 bg-green-900 bg-opacity-50' : ''}`}>
            <div className="text-sm text-gray-400">Net Profit</div>
            <div className={`text-xl font-bold ${safeNumber(stats.netProfit) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {safeNumber(stats.netProfit) > 0 ? '+' : ''}{formatNumber(stats.netProfit)} {selectedCurrency === CurrencyMode.SOL ? 'SOL' : 'RPSTOKEN'}
            </div>
          </div>
        </div>
      </div>

      {/* Game History Visualization */}
      <div className="mt-6">
        <h4 className="text-lg font-medium mb-2">Game History</h4>
        <div className="bg-gray-900 p-3 rounded-lg shadow-inner overflow-x-auto">
          <div className="flex flex-wrap gap-1 min-h-16">
            {gameHistory.map((game, index) => (
              <div
                key={index}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 hover:scale-110 ${
                  game.result === 'win' ? 'bg-green-600 hover:bg-green-500' :
                  game.result === 'loss' ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-600 hover:bg-gray-500'
                }`}
                title={`Game ${index + 1}: ${game.playerChoice} vs ${game.opponentChoices.join(', ')} - ${game.result.toUpperCase()}`}
                onMouseEnter={() => audioService.play('hover')}
              >
                {game.result === 'win' ? 'W' : game.result === 'loss' ? 'L' : 'T'}
              </div>
            ))}
            {gameHistory.length === 0 && (
              <div className="text-gray-500 text-sm py-3">No games played yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoPlayPanel;

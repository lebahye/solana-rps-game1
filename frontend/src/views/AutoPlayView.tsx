import React, { useEffect, useState } from 'react';
import { RPSGameClient } from '../rps-client';
import { RPSAutoPlayer } from '../autoplay/RPSAutoPlayer';
import AutoPlayPanel from '../autoplay/AutoPlayPanel';
import GameAnimation from '../autoplay/GameAnimation';
import { AutoPlayStats, CurrencyMode, GameHistoryItem, GameOutcome, BettingStrategy } from '../types';

interface AutoPlayViewProps {
  gameClient: RPSGameClient;
  onBackToHome: () => void;
}

const AutoPlayView: React.FC<AutoPlayViewProps> = ({ gameClient, onBackToHome }) => {
  const [autoPlayer, setAutoPlayer] = useState<RPSAutoPlayer | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [wagerAmount, setWagerAmount] = useState(0.1);
  const [selectedCurrency, setSelectedCurrency] = useState(CurrencyMode.SOL);
  const [strategy, setStrategy] = useState<BettingStrategy>(BettingStrategy.FIXED);
  const [gameSpeed, setGameSpeed] = useState<number>(2000);
  const [stopOnProfit, setStopOnProfit] = useState<number>(5);
  const [stopOnLoss, setStopOnLoss] = useState<number>(5);
  const [useStopLimits, setUseStopLimits] = useState<boolean>(false);
  const [stats, setStats] = useState<AutoPlayStats>({
    currentStreak: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    totalWagered: 0,
    netProfit: 0,
    gameHistory: [],
  });
  const [currentGame, setCurrentGame] = useState<{
    isPlaying: boolean;
    playerChoice?: number;
    opponentChoice?: number;
    result?: GameOutcome;
  }>({
    isPlaying: false
  });
  const [errorMessage, setErrorMessage] = useState("");

  // Initialize the auto player when the game client changes
  useEffect(() => {
    if (gameClient) {
      setAutoPlayer(new RPSAutoPlayer(gameClient));
    }
  }, [gameClient]);

  // Check for stop conditions
  useEffect(() => {
    if (isAutoPlaying && useStopLimits && autoPlayer) {
      if ((stopOnProfit > 0 && stats.netProfit >= stopOnProfit) ||
          (stopOnLoss > 0 && stats.netProfit <= -stopOnLoss)) {
        handleToggleAutoPlay();
      }
    }
  }, [stats.netProfit, isAutoPlaying, useStopLimits, stopOnProfit, stopOnLoss]);

  // Apply betting strategy to determine next wager
  const getNextWagerAmount = (currentWager: number, lastResult: GameOutcome | undefined, streak: number): number => {
    if (!lastResult || strategy === BettingStrategy.FIXED) {
      return currentWager;
    }

    switch (strategy) {
      case BettingStrategy.MARTINGALE:
        // Double bet after each loss, reset after win
        return lastResult === 'loss' ? currentWager * 2 : wagerAmount;

      case BettingStrategy.DALEMBERT:
        // Increase by 1 unit after loss, decrease by 1 unit after win
        const unit = wagerAmount * 0.1; // 10% of base wager is 1 unit
        if (lastResult === 'loss') {
          return currentWager + unit;
        } else if (lastResult === 'win') {
          return Math.max(wagerAmount, currentWager - unit);
        }
        return currentWager;

      case BettingStrategy.FIBONACCI:
        // Use Fibonacci sequence after losses (1, 1, 2, 3, 5, 8, 13, ...)
        if (lastResult === 'win' || lastResult === 'tie') {
          return wagerAmount; // Reset to base wager
        }

        // Calculate Fibonacci number based on losing streak
        const negStreak = streak < 0 ? Math.abs(streak) : 0;
        if (negStreak <= 1) return wagerAmount;

        // Calculate the Fibonacci number for this position
        let a = 1, b = 1;
        for (let i = 2; i < negStreak; i++) {
          const temp = a + b;
          a = b;
          b = temp;
        }

        return wagerAmount * b;

      default:
        return currentWager;
    }
  };

  // Toggle auto-play
  const handleToggleAutoPlay = async () => {
    if (!autoPlayer) return;

    if (isAutoPlaying) {
      // Stop auto-play
      autoPlayer.stop();
      setIsAutoPlaying(false);
      setCurrentGame({ isPlaying: false });
    } else {
      // Start auto-play
      setIsAutoPlaying(true);
      setErrorMessage("");

      try {
        await autoPlayer.start(
          wagerAmount,
          selectedCurrency,
          strategy,
          gameSpeed,
          (newStats, lastGame, currentWager) => {
            // Calculate next wager based on strategy
            const nextWager = getNextWagerAmount(
              currentWager,
              lastGame.result,
              newStats.currentStreak
            );

            setStats(newStats);
            // Update animation
            setCurrentGame({
              isPlaying: true,
              playerChoice: lastGame.playerChoice,
              opponentChoice: lastGame.opponentChoices[0], // Just show the first opponent for simplicity
              result: lastGame.result
            });

            // Reset animation after a delay
            setTimeout(() => {
              setCurrentGame(prev => ({ ...prev, isPlaying: false }));
              setTimeout(() => {
                setCurrentGame({ isPlaying: true });
              }, 300);
            }, gameSpeed * 0.8); // Animation timing based on game speed

            return nextWager;
          },
          (error) => {
            setErrorMessage(`Error: ${error.message}`);
          }
        );
      } catch (error) {
        console.error("Failed to start auto-play:", error);
        setIsAutoPlaying(false);
        setErrorMessage(`Failed to start auto-play: ${(error as Error).message}`);
      }
    }
  };

  const handleCurrencyChange = (currency: CurrencyMode) => {
    setSelectedCurrency(currency);
  };

  const handleReset = () => {
    if (autoPlayer) {
      autoPlayer.resetStats();
      setStats({
        currentStreak: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        totalWagered: 0,
        netProfit: 0,
        gameHistory: [],
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Automated RPS</h2>
          <button
            onClick={onBackToHome}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
          >
            Back to Home
          </button>
        </div>

        {errorMessage && (
          <div className="bg-red-600 bg-opacity-70 rounded-lg p-4 mb-6 text-center">
            {errorMessage}
          </div>
        )}

        <GameAnimation
          isPlaying={currentGame.isPlaying}
          playerChoice={currentGame.playerChoice}
          opponentChoice={currentGame.opponentChoice}
          result={currentGame.result}
        />

        <AutoPlayPanel
          isActive={isAutoPlaying}
          onToggle={handleToggleAutoPlay}
          wagerAmount={wagerAmount}
          setWagerAmount={setWagerAmount}
          stats={stats}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={handleCurrencyChange}
          gameHistory={stats.gameHistory}
          strategy={strategy}
          onStrategyChange={setStrategy}
          gameSpeed={gameSpeed}
          onGameSpeedChange={setGameSpeed}
          stopOnProfit={stopOnProfit}
          onStopProfitChange={setStopOnProfit}
          stopOnLoss={stopOnLoss}
          onStopLossChange={setStopOnLoss}
          useStopLimits={useStopLimits}
          onUseStopLimitsChange={setUseStopLimits}
        />

        <div className="flex justify-between mt-6">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
            disabled={isAutoPlaying}
          >
            Reset Stats
          </button>

          <div className="text-sm text-gray-400">
            Note: This is a simulation. Real blockchain transactions are not being made.
          </div>
        </div>
      </div>

      <div className="card bg-gray-800 p-6 rounded-lg shadow-lg">
        <h3 className="text-xl font-bold mb-4">Strategy Details</h3>
        <div className="text-gray-300 mb-4">
          <h4 className="font-bold">Betting Strategies:</h4>
          <ul className="list-disc list-inside space-y-1 mt-2 ml-4">
            <li><span className="font-semibold">Fixed:</span> Always bet the same amount</li>
            <li><span className="font-semibold">Martingale:</span> Double your bet after each loss, reset after a win</li>
            <li><span className="font-semibold">D'Alembert:</span> Increase bet by one unit after a loss, decrease by one unit after a win</li>
            <li><span className="font-semibold">Fibonacci:</span> Follow the Fibonacci sequence (1,1,2,3,5,8...) during losing streaks</li>
          </ul>
        </div>

        <div className="text-gray-300">
          <h4 className="font-bold">Auto-Stop Limits:</h4>
          <p className="mt-2 ml-4">
            Set profit or loss limits to automatically stop playing when reached. This helps
            manage your bankroll and avoid excessive losses.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AutoPlayView;

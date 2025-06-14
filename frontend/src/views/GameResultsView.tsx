import React, { useEffect, useState } from 'react';
import type { Game, GameState, Choice, GameView } from '../types';
import { userProfileService } from '../services/user-profile-service';
import { PublicKey } from '@solana/web3.js';

interface GameResultsViewProps {
  gameData: Game;
  userPublicKey: PublicKey;
  setCurrentView: (view: GameView) => void;
}

const GameResultsView: React.FC<GameResultsViewProps> = ({
  gameData,
  userPublicKey,
  setCurrentView
}) => {
  const [currentPlayer, setCurrentPlayer] = useState<any>(null);
  const [isWinner, setIsWinner] = useState(false);
  const [winners, setWinners] = useState<any[]>([]);
  const [isLastRound, setIsLastRound] = useState(false);

  useEffect(() => {
    // Find current player
    const player = gameData.players.find(
      p => p.pubkey === userPublicKey.toString()
    );
    setCurrentPlayer(player);

    // Determine if this is the last round
    setIsLastRound(gameData.currentRound === gameData.totalRounds);

    // Find winners
    const highestScore = Math.max(...gameData.players.map(p => p.score));
    const gameWinners = gameData.players.filter(p => p.score === highestScore);
    setWinners(gameWinners);

    // Check if current player is a winner
    if (player && gameWinners.some(w => w.pubkey === player.pubkey)) {
      setIsWinner(true);
    }
  }, [gameData, userPublicKey]);

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

  // Track user statistics when a game completes
  useEffect(() => {
    const updateUserStats = async () => {
      if (isLastRound && currentPlayer) {
        await userProfileService.trackGameCompletion(
          userPublicKey,
          {
            score: currentPlayer.score,
            winners: winners.map(winner => winner.pubkey),
            gamePot: gameData.gamePot
          }
        );
      }
    };

    updateUserStats();
  }, [isLastRound, currentPlayer, userPublicKey, winners, gameData.gamePot]);

  return (
    <div className="card">
      <h2>Game Results</h2>

      <div className="result-status">
        {isWinner ? (
          <div className="winner">
            <h3>You Won!</h3>
            <p>Congratulations! You've won the game.</p>
          </div>
        ) : (
          <div className="loser">
            <h3>You Lost</h3>
            <p>Better luck next time!</p>
          </div>
        )}
      </div>

      <div className="score-board">
        <h3>Final Scores</h3>
        <ul>
          {gameData.players.map(player => (
            <li key={player.pubkey} className={player.pubkey === userPublicKey.toString() ? 'current-player' : ''}>
              <span className="player-name">{player.pubkey.substring(0, 6)}...{player.pubkey.substring(player.pubkey.length - 4)}</span>
              <span className="player-score">{player.score}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="action-buttons">
        <button onClick={() => setCurrentView(GameView.HOME)}>Back to Home</button>
        <button onClick={() => setCurrentView(GameView.CREATE_GAME)}>Create New Game</button>
        <button onClick={() => setCurrentView(GameView.PROFILE)}>View Profile</button>
      </div>
    </div>
  );
};

export default GameResultsView;

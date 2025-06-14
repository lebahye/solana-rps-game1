import React from 'react';
import SecurityDashboard from '../components/SecurityDashboard';
import { GameView } from '../types';

interface HomeViewProps {
  setCurrentView: (view: GameView) => void;
  connected: boolean;
  [key: string]: any; // Accept additional props
}

const HomeView: React.FC<HomeViewProps> = ({ setCurrentView, connected }) => {
  const handleCreateGame = () => {
    if (!connected) {
      alert("Please connect your wallet first");
      return;
    }
    setCurrentView(GameView.CREATE_GAME);
  };

  const handleJoinGame = () => {
    if (!connected) {
      alert("Please connect your wallet first");
      return;
    }
    setCurrentView(GameView.JOIN_GAME);
  };

  const handleAutoPlay = () => {
    if (!connected) {
      alert("Please connect your wallet first");
      return;
    }
    setCurrentView(GameView.AUTO_PLAY);
  };

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-3xl font-bold mb-8 text-center">
        Multiplayer Rock Paper Scissors on Solana
      </h2>

      <div className="flex flex-col md:flex-row justify-center w-full gap-8 mb-8">
        <div
          className="card flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-gray-700 transition-colors duration-200 w-full md:w-1/3"
          onClick={handleCreateGame}
        >
          <div className="text-5xl mb-4">🎮</div>
          <h3 className="text-2xl font-bold mb-2">Create Game</h3>
          <p className="text-gray-300 text-center">
            Create a new game and invite friends to play
          </p>
          <button className="mt-4 btn btn-primary">Create Game</button>
        </div>

        <div
          className="card flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-gray-700 transition-colors duration-200 w-full md:w-1/3"
          onClick={handleJoinGame}
        >
          <div className="text-5xl mb-4">🎲</div>
          <h3 className="text-2xl font-bold mb-2">Join Game</h3>
          <p className="text-gray-300 text-center">
            Enter a specific game ID to join friends or a tournament game
          </p>
          <button className="mt-4 btn btn-secondary">Join Game</button>
        </div>

        <div
          className="card flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-gray-700 transition-colors duration-200 w-full md:w-1/3"
          onClick={handleAutoPlay}
        >
          <div className="text-5xl mb-4">🤖</div>
          <h3 className="text-2xl font-bold mb-2">Auto Play</h3>
          <p className="text-gray-300 text-center">
            Set your strategy and let the system play for you automatically
          </p>
          <button className="mt-4 btn btn-success">Auto Play</button>
        </div>
      </div>

      {/* Security Dashboard (Compact Version) */}
      <div className="w-full mb-8">
        <SecurityDashboard compact={true} showMetrics={false} />
      </div>

      <div className="card w-full max-w-3xl p-6">
        <h3 className="text-xl font-bold mb-4">How to Play</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-300">
          <li>Connect your Solana wallet (Phantom, Solflare, etc.)</li>
          <li>Choose to join the player queue or enter a specific game ID</li>
          <li>Pay the entry fee in SOL or RPS Tokens</li>
          <li>Choose rock, paper, or scissors manually or set to auto-play</li>
          <li>Win by having the highest score after all rounds!</li>
        </ol>

        <div className="mt-6 p-4 bg-purple-900 bg-opacity-50 rounded-lg">
          <h4 className="font-bold mb-2">Game Rules</h4>
          <ul className="list-disc list-inside space-y-1 text-gray-300">
            <li>Rock beats Scissors</li>
            <li>Scissors beats Paper</li>
            <li>Paper beats Rock</li>
            <li>Each player earns 1 point for each win against another player</li>
            <li>The player with the most points after all rounds wins</li>
            <li>Games require 3-4 players to start automatically</li>
          </ul>
        </div>
      </div>

      {/* Scaling and Security Section */}
      <div className="card w-full max-w-3xl p-6 mt-6">
        <h3 className="text-xl font-bold mb-4">Enterprise-Grade Security & Scaling</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-900 bg-opacity-50 p-4 rounded-lg">
            <h4 className="text-lg font-semibold mb-2 flex items-center">
              <span className="text-xl mr-2">🔒</span>
              <span>Security Features</span>
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Military-grade encryption for all game moves</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Solana blockchain verification prevents cheating</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>AI-powered anti-bot protection</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>DDoS protection with global traffic filtering</span>
              </li>
            </ul>
          </div>

          <div className="bg-gray-900 bg-opacity-50 p-4 rounded-lg">
            <h4 className="text-lg font-semibold mb-2 flex items-center">
              <span className="text-xl mr-2">🚀</span>
              <span>Scaling Capabilities</span>
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Support for 50,000+ concurrent players</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Global infrastructure across 12 regions</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Auto-scaling to handle sudden player surges</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Low latency (&lt; 200ms) gameplay worldwide</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="text-center text-sm text-purple-300 mt-2">
          Our infrastructure can handle thousands of concurrent games with enterprise-grade security.
        </div>
      </div>
    </div>
  );
};

export default HomeView;

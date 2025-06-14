import React from 'react';
import WalletHelper from '../components/WalletHelper';

const WelcomeView: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-gradient-to-b from-purple-900 via-indigo-900 to-blue-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Rock icon */}
        <div className="absolute text-8xl opacity-10 text-white animate-float top-1/4 left-1/4">
          👊
        </div>
        {/* Paper icon */}
        <div className="absolute text-8xl opacity-10 text-white animate-float-delayed top-3/4 right-1/3">
          ✋
        </div>
        {/* Scissors icon */}
        <div className="absolute text-8xl opacity-10 text-white animate-float-reverse top-1/3 right-1/4">
          ✌️
        </div>
        {/* Solana logo */}
        <div className="absolute bottom-10 left-10 opacity-10">
          <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M99.5815 78.0568L83.5815 99.0568C83.3815 99.3235 83.1149 99.5235 82.8149 99.6568C82.5149 99.7902 82.1815 99.8568 81.8482 99.8568H1.84818C1.38151 99.8568 0.948177 99.6568 0.648177 99.2902C0.348177 98.9235 0.215011 98.4235 0.315011 97.9568C0.381677 97.6902 0.515011 97.4568 0.681677 97.2568L16.6817 76.2568C16.8817 75.9902 17.1482 75.7902 17.4482 75.6568C17.7482 75.5235 18.0817 75.4568 18.415 75.4568H98.415C98.8817 75.4568 99.315 75.6568 99.615 76.0235C99.915 76.3902 100.048 76.8902 99.9483 77.3568C99.8817 77.6235 99.7483 77.8568 99.5815 78.0568ZM83.5815 40.2568C83.3815 39.9902 83.1149 39.7902 82.8149 39.6568C82.5149 39.5235 82.1815 39.4568 81.8482 39.4568H1.84818C1.38151 39.4568 0.948177 39.6568 0.648177 40.0235C0.348177 40.3902 0.215011 40.8902 0.315011 41.3568C0.381677 41.6235 0.515011 41.8569 0.681677 42.0568L16.6817 63.0568C16.8817 63.3235 17.1482 63.5235 17.4482 63.6568C17.7482 63.7902 18.0817 63.8568 18.415 63.8568H98.415C98.8817 63.8568 99.315 63.6568 99.615 63.2902C99.915 62.9235 100.048 62.4235 99.9483 61.9568C99.8817 61.6902 99.7483 61.4568 99.5815 61.2568L83.5815 40.2568ZM1.84818 27.8568H81.8482C82.1815 27.8568 82.5149 27.7902 82.8149 27.6568C83.1149 27.5235 83.3815 27.3235 83.5815 27.0568L99.5815 6.05679C99.7483 5.85679 99.8817 5.62346 99.9483 5.35679C100.048 4.89012 99.915 4.39012 99.615 4.02346C99.315 3.65679 98.8817 3.45679 98.415 3.45679H18.415C18.0817 3.45679 17.7482 3.52346 17.4482 3.65679C17.1482 3.79012 16.8817 3.99012 16.6817 4.25679L0.681677 25.2568C0.515011 25.4568 0.381677 25.6902 0.315011 25.9568C0.215011 26.4235 0.348177 26.9235 0.648177 27.2902C0.948177 27.6568 1.38151 27.8568 1.84818 27.8568Z" fill="white"/>
          </svg>
        </div>
      </div>

      {/* Main content */}
      <div className="z-10 text-center p-8 max-w-4xl">
        <h1 className="text-6xl md:text-8xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 animate-pulse">
          Solana Rock Paper Scissors
        </h1>

        <div className="flex justify-center space-x-6 my-12">
          <div className="text-7xl transform transition-all duration-300 hover:scale-125 hover:rotate-12">👊</div>
          <div className="text-7xl transform transition-all duration-300 hover:scale-125 hover:rotate-12">✋</div>
          <div className="text-7xl transform transition-all duration-300 hover:scale-125 hover:rotate-12">✌️</div>
        </div>

        <p className="text-xl md:text-2xl mb-10 text-gray-300">
          Play the classic game on the Solana blockchain. Bet, win, and earn cryptocurrency!
        </p>

        <div className="mb-12">
          <h2 className="text-2xl font-bold text-purple-300 mb-4">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-purple-900 bg-opacity-50 p-6 rounded-xl border border-purple-700 hover:shadow-lg hover:shadow-purple-600/30 transition-all duration-300">
              <div className="text-3xl mb-2">💰</div>
              <h3 className="text-xl font-bold mb-2 text-purple-300">Crypto Betting</h3>
              <p className="text-gray-300">Place bets using SOL or RPS tokens and win real cryptocurrency</p>
            </div>
            <div className="bg-purple-900 bg-opacity-50 p-6 rounded-xl border border-purple-700 hover:shadow-lg hover:shadow-purple-600/30 transition-all duration-300">
              <div className="text-3xl mb-2">🤖</div>
              <h3 className="text-xl font-bold mb-2 text-purple-300">Auto Play</h3>
              <p className="text-gray-300">Set your strategy and let the system play automatically for you</p>
            </div>
            <div className="bg-purple-900 bg-opacity-50 p-6 rounded-xl border border-purple-700 hover:shadow-lg hover:shadow-purple-600/30 transition-all duration-300">
              <div className="text-3xl mb-2">🔒</div>
              <h3 className="text-xl font-bold mb-2 text-purple-300">Secure & Transparent</h3>
              <p className="text-gray-300">All gameplay is secured by the Solana blockchain for fair outcomes</p>
            </div>
          </div>
        </div>

        <div className="py-8">
          {/* Replace the old WalletMultiButton with our new WalletHelper component */}
          <WalletHelper />
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 text-gray-500 text-sm">
        Running on Solana Devnet • © 2025 Solana RPS Game
      </div>
    </div>
  );
};

export default WelcomeView;

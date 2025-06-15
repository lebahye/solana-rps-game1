import React from 'react';
import { TokenBalance } from '../types';

interface TokenDisplayProps {
  balance: TokenBalance;
  loading?: boolean;
  isMobile?: boolean;
  onClick?: () => void;
}

const TokenDisplay: React.FC<TokenDisplayProps> = ({
  balance,
  loading = false,
  isMobile = false,
  onClick
}) => {
  const handleClick = () => {
    if (onClick) onClick();
  };

  // Apply interactive cursor if onClick is provided
  const cursorClass = onClick ? 'cursor-pointer hover:bg-gray-700' : '';
  const transitionClass = onClick ? 'transition-all duration-200' : '';

  if (isMobile) {
    return (
      <div
        className={`flex flex-col items-end space-y-1 ${cursorClass} p-1 rounded-md ${transitionClass}`}
        onClick={handleClick}
      >
        <div className="flex items-center text-sm">
          <img
            src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
            alt="SOL"
            className="w-4 h-4 mr-1"
          />
          <span className="text-white font-medium">
            {loading ? '...' : balance.sol.toFixed(4)}
          </span>
        </div>
        <div className="flex items-center text-sm">
          <img
            src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png"
            alt="RPS"
            className="w-4 h-4 mr-1"
          />
          <span className="text-white font-medium">
            {loading ? '...' : balance.rpsToken.toFixed(1)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-gray-800 bg-opacity-80 rounded-lg p-2 flex items-center space-x-4 ${cursorClass} ${transitionClass}`}
      onClick={handleClick}
    >
      <div className="flex items-center">
        <img
          src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
          alt="SOL"
          className="w-5 h-5 mr-2"
        />
        <span className="text-white font-medium">
          {loading ? '...' : balance.sol.toFixed(4)} SOL
        </span>
      </div>
      <div className="flex items-center">
        <img
          src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png"
          alt="RPS"
          className="w-5 h-5 mr-2"
        />
        <span className="text-white font-medium">
          {loading ? '...' : balance.rpsToken.toFixed(1)} RPS
        </span>
      </div>
      {onClick && (
        <div className="ml-1 text-gray-300 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default TokenDisplay;
import React from 'react';
import { TokenBalance } from '../types';

interface TokenDisplayProps {
  balance: TokenBalance;
  loading: boolean;
  onClick?: () => void;
}

const TokenDisplay: React.FC<TokenDisplayProps> = ({ balance, loading, onClick }) => {
  if (loading) {
    return <div className="text-sm">Loading balances...</div>;
  }

  return (
    <div 
      className="flex items-center space-x-4 cursor-pointer hover:bg-gray-800 p-2 rounded"
      onClick={onClick}
    >
      <div className="text-sm">
        <span className="font-semibold">{balance.sol.toFixed(4)}</span> SOL
      </div>
      <div className="text-sm">
        <span className="font-semibold">{balance.rpsToken.toFixed(2)}</span> RPS
      </div>
    </div>
  );
};

export default TokenDisplay;

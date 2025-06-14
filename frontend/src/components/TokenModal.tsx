import React, { useState } from 'react';
import { TokenBalance } from '../types';
import TokenSwap from './TokenSwap';
import { PublicKey } from '@solana/web3.js';

interface TokenModalProps {
  publicKey: PublicKey | null;
  onClose: () => void;
  balance: TokenBalance;
  onGetFree: () => Promise<void>;
}

const TokenModal: React.FC<TokenModalProps> = ({
  publicKey,
  onClose,
  balance,
  onGetFree
}) => {
  const [loading, setLoading] = useState(false);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleGetFreeTokens = async () => {
    setLoading(true);
    try {
      await onGetFree();
    } catch (error) {
      console.error('Error getting free tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  // For simplicity, we'll use a placeholder swap function
  const handleSwap = async (fromToken: string, toToken: string, amount: number) => {
    setLoading(true);
    try {
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`Swapping ${amount} ${fromToken} to ${toToken}`);
      return true;
    } catch (error) {
      console.error('Error swapping tokens:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-gray-900 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-bold">Manage Tokens</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-800"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <div className="mb-6 p-4 bg-gray-800 rounded-lg">
            <h3 className="text-lg font-medium mb-2">Your Balances</h3>
            <div className="flex justify-between items-center">
              <div className="flex space-x-6">
                <div>
                  <div className="text-sm text-gray-400">SOL</div>
                  <div className="text-xl font-bold">{balance.sol.toFixed(4)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">RPS Token</div>
                  <div className="text-xl font-bold">{balance.rpsToken.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-800 rounded-lg mb-4">
            <h3 className="text-lg font-medium mb-3">Get Free Tokens</h3>
            <p className="text-gray-300 mb-3">
              New players can claim free RPS tokens to get started!
            </p>
            <button
              className="btn btn-primary w-full"
              onClick={handleGetFreeTokens}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Claim Free RPS Tokens'}
            </button>
            <p className="text-xs text-gray-400 mt-2">
              For testing purposes only. Limited to one claim per wallet.
            </p>
          </div>

          <TokenSwap
            balance={balance}
            onSwap={handleSwap}
            disabled={loading}
          />

          <div className="mt-6 p-4 bg-indigo-900 bg-opacity-30 rounded-lg">
            <h3 className="text-lg font-medium mb-2">Why Use RPS Tokens?</h3>
            <ul className="space-y-2">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>5% larger prize pools for all games</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>50% lower fees (0.05% instead of 0.1%)</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Exclusive game modes and tournaments</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Future governance and staking rewards</span>
              </li>
            </ul>
          </div>

          {publicKey && (
            <div className="mt-4 pt-3 border-t border-gray-700">
              <div className="text-xs text-gray-400">
                <span className="font-semibold">Connected Wallet:</span>
                <span className="ml-1">
                  {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenModal;

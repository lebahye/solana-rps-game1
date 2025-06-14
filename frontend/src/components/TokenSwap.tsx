import React, { useState } from 'react';
import { TokenBalance } from '../types';

interface TokenSwapProps {
  balance: TokenBalance;
  onSwap: (fromToken: string, toToken: string, amount: number) => Promise<boolean>;
  disabled?: boolean;
}

const TokenSwap: React.FC<TokenSwapProps> = ({
  balance,
  onSwap,
  disabled = false
}) => {
  const [amount, setAmount] = useState<number>(0.1);
  const [swapping, setSwapping] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [swapDirection, setSwapDirection] = useState<'SOL_TO_RPS' | 'RPS_TO_SOL'>('SOL_TO_RPS');

  const handleSwap = async () => {
    if (swapDirection === 'SOL_TO_RPS' && (amount <= 0 || amount > balance.sol)) return;
    if (swapDirection === 'RPS_TO_SOL' && (amount <= 0 || amount > balance.rpsToken)) return;

    setSwapping(true);
    setMessage(null);

    try {
      const fromToken = swapDirection === 'SOL_TO_RPS' ? 'SOL' : 'RPS';
      const toToken = swapDirection === 'SOL_TO_RPS' ? 'RPS' : 'SOL';

      const success = await onSwap(fromToken, toToken, amount);

      if (success) {
        setMessage({
          text: `Successfully swapped ${amount} ${fromToken} for ${toToken}!`,
          type: 'success'
        });
        setAmount(0.1);
      } else {
        setMessage({
          text: 'Failed to swap tokens. Please try again.',
          type: 'error'
        });
      }
    } catch (error) {
      setMessage({
        text: `Error: ${(error as Error).message || 'Unknown error'}`,
        type: 'error'
      });
    } finally {
      setSwapping(false);
    }
  };

  const toggleSwapDirection = () => {
    setSwapDirection(prev => prev === 'SOL_TO_RPS' ? 'RPS_TO_SOL' : 'SOL_TO_RPS');
    setAmount(0.1);
    setMessage(null);
  };

  const isSwapDisabled =
    disabled ||
    swapping ||
    amount <= 0 ||
    (swapDirection === 'SOL_TO_RPS' && amount > balance.sol) ||
    (swapDirection === 'RPS_TO_SOL' && amount > balance.rpsToken);

  const getMaxAmount = () => {
    return swapDirection === 'SOL_TO_RPS'
      ? balance.sol
      : balance.rpsToken;
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
      <h3 className="text-lg font-semibold mb-4">Swap Tokens</h3>

      {message && (
        <div
          className={`p-3 mb-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-800 bg-opacity-40 text-green-400' : 'bg-red-800 bg-opacity-40 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-4">
        <div className="flex justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">
            {swapDirection === 'SOL_TO_RPS' ? 'Swap SOL for RPS' : 'Swap RPS for SOL'}
          </label>
          <button
            onClick={toggleSwapDirection}
            disabled={disabled || swapping}
            className="text-xs text-purple-400 hover:text-purple-300"
          >
            Switch Direction
          </button>
        </div>

        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Math.max(0, parseFloat(e.target.value) || 0))}
              min="0.01"
              step="0.01"
              disabled={disabled || swapping}
              className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 text-white pr-16"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              {swapDirection === 'SOL_TO_RPS' ? 'SOL' : 'RPS'}
            </div>
          </div>
          <button
            onClick={handleSwap}
            disabled={isSwapDisabled}
            className={`px-4 py-2 rounded-lg font-medium ${
              isSwapDisabled
                ? 'bg-gray-600 cursor-not-allowed opacity-50'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {swapping ? 'Swapping...' : 'Swap'}
          </button>
        </div>

        <div className="flex justify-between mt-1">
          <div className="text-xs text-gray-400">
            {swapDirection === 'SOL_TO_RPS'
              ? 'Exchange rate: 1 SOL = 10 RPS'
              : 'Exchange rate: 10 RPS = 1 SOL'}
          </div>
          <button
            onClick={() => setAmount(getMaxAmount())}
            disabled={disabled || swapping}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            Max
          </button>
        </div>

        {(swapDirection === 'SOL_TO_RPS' && amount > balance.sol) && (
          <div className="text-xs text-red-400 mt-1">
            Insufficient SOL balance
          </div>
        )}

        {(swapDirection === 'RPS_TO_SOL' && amount > balance.rpsToken) && (
          <div className="text-xs text-red-400 mt-1">
            Insufficient RPS balance
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenSwap;

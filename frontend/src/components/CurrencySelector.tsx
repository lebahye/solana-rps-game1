import React from 'react';
import { CurrencyMode } from '../types';

interface CurrencySelectorProps {
  selectedCurrency: CurrencyMode;
  onCurrencyChange: (currency: CurrencyMode) => void;
  entryFee: number;
  onEntryFeeChange: (fee: number) => void;
  disabled?: boolean;
}

const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  selectedCurrency,
  onCurrencyChange,
  entryFee,
  onEntryFeeChange,
  disabled = false
}) => {
  return (
    <div className="mt-4">
      <label className="form-label">Currency</label>
      <div className="flex space-x-4">
        <button
          type="button"
          onClick={() => onCurrencyChange(CurrencyMode.SOL)}
          disabled={disabled}
          className={`flex-1 py-2 rounded-lg transition-colors ${
            selectedCurrency === CurrencyMode.SOL
              ? 'bg-purple-600 hover:bg-purple-700'
              : 'bg-gray-700 hover:bg-gray-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex items-center justify-center">
            <img
              src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
              alt="SOL"
              className="w-5 h-5 mr-2"
            />
            SOL
          </div>
        </button>
        <button
          type="button"
          onClick={() => onCurrencyChange(CurrencyMode.RPS_TOKEN)}
          disabled={disabled}
          className={`flex-1 py-2 rounded-lg transition-colors ${
            selectedCurrency === CurrencyMode.RPS_TOKEN
              ? 'bg-purple-600 hover:bg-purple-700'
              : 'bg-gray-700 hover:bg-gray-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex items-center justify-center">
            <img
              src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png"
              alt="RPS"
              className="w-5 h-5 mr-2"
            />
            RPS Token
          </div>
        </button>
      </div>

      {selectedCurrency === CurrencyMode.RPS_TOKEN && (
        <div className="mt-2 p-2 bg-green-800 bg-opacity-30 rounded-lg">
          <p className="text-green-400 text-sm">
            <span className="font-bold">+5% Bonus!</span> Using RPS Tokens gives you a larger pot!
          </p>
        </div>
      )}

      <div className="mt-4">
        <label className="form-label">
          Entry Fee ({selectedCurrency === CurrencyMode.SOL ? 'SOL' : 'RPS Token'})
        </label>
        <div className="relative">
          <input
            type="number"
            value={entryFee}
            onChange={(e) => onEntryFeeChange(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
            min="0.01"
            step="0.01"
            disabled={disabled}
            className={`form-control pr-12 ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {selectedCurrency === CurrencyMode.SOL ? 'SOL' : 'RPS'}
          </div>
        </div>

        {selectedCurrency === CurrencyMode.RPS_TOKEN && (
          <p className="text-xs text-gray-400 mt-1">
            Only 0.05% fee instead of 0.1% when using RPS Tokens!
          </p>
        )}
      </div>
    </div>
  );
};

export default CurrencySelector;

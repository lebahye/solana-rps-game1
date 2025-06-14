import React, { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { safeDeserialize } from '../utils/fixborsh';

interface GameMonitorProps {
  gameId: string;
  endpoint: string;
  programId: string;
}

const GameMonitor: React.FC<GameMonitorProps> = ({ gameId, endpoint, programId }) => {
  const [connectedWallets, setConnectedWallets] = useState<string[]>([]);
  const [gameState, setGameState] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<number | null>(null);

  useEffect(() => {
    if (!gameId) return;

    try {
      // Initialize connection to Solana
      const connection = new Connection(endpoint, 'confirmed');
      const gamePublicKey = new PublicKey(gameId);
      const programPublicKey = new PublicKey(programId);

      // Function to fetch game state
      const fetchGameState = async () => {
        try {
          const accountInfo = await connection.getAccountInfo(gamePublicKey);
          if (!accountInfo) {
            setError('Game account not found');
            return;
          }

          // Update state
          setGameState(accountInfo.data);
          setLastUpdate(new Date().toLocaleTimeString());
          setError(null);
        } catch (err) {
          console.error('Error fetching game state:', err);
          setError(`Error fetching game state: ${err.message}`);
        }
      };

      // Initial fetch
      fetchGameState();

      // Subscribe to game account changes
      const id = connection.onAccountChange(
        gamePublicKey,
        (accountInfo) => {
          setGameState(accountInfo.data);
          setLastUpdate(new Date().toLocaleTimeString());
        },
        'confirmed'
      );
      setSubscriptionId(id);

      // Check for wallet connections
      const checkWallets = () => {
        const wallets = [];

        // Check for Phantom
        if (window.phantom?.solana) {
          wallets.push('Phantom');
        }

        // Check for Solflare
        if (window.solflare) {
          wallets.push('Solflare');
        }

        // Check for any other wallet adapters
        if (window.solana) {
          if (!wallets.includes('Phantom') && !wallets.includes('Solflare')) {
            wallets.push('Other Solana wallet');
          }
        }

        setConnectedWallets(wallets);
      };

      checkWallets();

      // Cleanup subscription
      return () => {
        if (subscriptionId !== null) {
          connection.removeAccountChangeListener(subscriptionId);
        }
      };
    } catch (err) {
      console.error('Error initializing game monitor:', err);
      setError(`Error initializing game monitor: ${err.message}`);
    }
  }, [gameId, endpoint, programId]);

  if (error) {
    return (
      <div className="bg-red-900 bg-opacity-50 p-4 rounded-lg my-4">
        <h3 className="text-lg font-semibold text-white mb-2">Game Monitor Error</h3>
        <p className="text-red-200">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 bg-opacity-50 p-4 rounded-lg my-4">
      <h3 className="text-lg font-semibold text-white mb-2">Game Monitor</h3>

      <div className="mb-3">
        <p className="text-sm text-gray-300">
          <span className="font-semibold">Game ID:</span> {gameId}
        </p>
        <p className="text-sm text-gray-300">
          <span className="font-semibold">Last Updated:</span> {lastUpdate || 'Never'}
        </p>
      </div>

      <div className="mb-3">
        <h4 className="text-md font-semibold text-purple-300 mb-1">Connected Wallets</h4>
        {connectedWallets.length > 0 ? (
          <ul className="text-sm text-gray-300">
            {connectedWallets.map((wallet, index) => (
              <li key={index} className="flex items-center">
                <span className="text-green-400 mr-2">●</span> {wallet}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-yellow-400">No wallets detected on this device</p>
        )}
      </div>

      <div>
        <h4 className="text-md font-semibold text-purple-300 mb-1">Raw Game Data</h4>
        {gameState ? (
          <div className="text-xs text-gray-400 overflow-auto max-h-32 p-2 bg-gray-900 bg-opacity-50 rounded">
            <pre>{JSON.stringify(gameState, null, 2)}</pre>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Loading game data...</p>
        )}
      </div>

      <div className="mt-3 text-right">
        <button
          onClick={() => window.location.reload()}
          className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-2 py-1 rounded"
        >
          Refresh
        </button>
      </div>
    </div>
  );
};

export default GameMonitor;

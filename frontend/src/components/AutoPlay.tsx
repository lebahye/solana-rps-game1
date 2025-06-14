import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export const AutoPlay: React.FC = () => {
  const { connected, publicKey, connecting } = useWallet();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const MAX_RECONNECT_ATTEMPTS = 3;

  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout;

    const handleConnectionChange = async () => {
      if (!connected && isRunning) {
        setError('Connection lost. Attempting to reconnect...');
        
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectTimer = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            // Attempt to reconnect logic here
          }, 5000); // Wait 5 seconds before attempting to reconnect
        } else {
          setError('Connection lost. Max reconnection attempts reached.');
          setIsRunning(false);
          setReconnectAttempts(0);
        }
      }
    };

    handleConnectionChange();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [connected, isRunning, reconnectAttempts]);

  const startAutoPlay = async () => {
    if (!connected) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      setIsRunning(true);
      setError(null);
      setReconnectAttempts(0);
      // Your existing auto-play logic here
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsRunning(false);
    }
  };

  return (
    <div className="auto-play-container">
      {error && (
        <div className="error-message bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}
      
      {connecting && (
        <div className="connecting-message">
          Reconnecting... Attempt {reconnectAttempts + 1}/{MAX_RECONNECT_ATTEMPTS}
        </div>
      )}

      <button
        onClick={startAutoPlay}
        disabled={!connected || isRunning}
        className={`auto-play-button ${!connected || isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isRunning ? 'Auto Play Running...' : 'Start Auto Play'}
      </button>
    </div>
  );
};

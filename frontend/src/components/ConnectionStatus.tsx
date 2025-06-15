import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';

interface Player {
  publicKey: string;
  status: 'available' | 'in-game' | 'auto-play';
  lastSeen: number;
  username?: string;
}

export const ConnectionStatus: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const updatePlayerStatus = async () => {
      if (!connected || !publicKey) return;
      
      try {
        // Update current player's status
        const currentPlayer: Player = {
          publicKey: publicKey.toString(),
          status: 'available',
          lastSeen: Date.now(),
        };
        
        setPlayers(prev => {
          const others = prev.filter(p => p.publicKey !== currentPlayer.publicKey);
          return [...others, currentPlayer];
        });
        
        // Clean up old players (inactive for more than 5 minutes)
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        setPlayers(prev => prev.filter(p => p.lastSeen > fiveMinutesAgo));
      } catch (error) {
        console.error('Error updating player status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const interval = setInterval(updatePlayerStatus, 30000); // Update every 30 seconds
    updatePlayerStatus();

    return () => clearInterval(interval);
  }, [connected, publicKey, connection]);

  if (isLoading) {
    return <div className="animate-pulse">Loading players...</div>;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-xl font-bold mb-4">Players Online ({players.length})</h3>
      <div className="space-y-2">
        {players.map((player) => (
          <div key={player.publicKey} className="flex items-center justify-between">
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${
                player.status === 'available' ? 'bg-green-500' :
                player.status === 'in-game' ? 'bg-yellow-500' :
                'bg-blue-500'
              }`} />
              <span className="text-sm">{player.username || player.publicKey.slice(0, 4) + '...' + player.publicKey.slice(-4)}</span>
            </div>
            <span className="text-xs text-gray-400">
              {new Date(player.lastSeen).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';



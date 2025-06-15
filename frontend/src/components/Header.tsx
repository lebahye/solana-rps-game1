import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet, WalletContextState } from '@solana/wallet-adapter-react';
import { formatSOL } from '../utils/format';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useState, useEffect } from 'react';

export const Header: React.FC = () => {
  const { connected, publicKey, connection } = useWallet();
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    if (connected && publicKey && connection) {
      connection.getBalance(publicKey).then(bal => setBalance(bal));
    }
  }, [connected, publicKey, connection]);
  
  return (
    <header className="game-header">
      <div className="header-left">
        <h1>Solana RPS Game</h1>
      </div>
      
      <div className="header-right">
        {connected && publicKey && (
          <div className="balance-display">
            <span>{formatSOL(balance)} SOL</span>
            <span>{publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}</span>
          </div>
        )}
        <WalletMultiButton />
      </div>
    </header>
  );
};
import React from 'react';

interface HeaderProps {
  children?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ children }) => {
  return (
    <header className="w-full bg-gray-900 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-xl font-bold">Solana RPS Game</h1>
        {children}
      </div>
    </header>
  );
};

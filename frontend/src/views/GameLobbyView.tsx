import React, { useState, useEffect } from 'react';
import { Game, GameState, CurrencyMode } from '../types';
import { formatCurrencyAmount } from '../services/token-service';
import { RPSGameClient } from '../rps-client';
import audioService from '../services/audio-service';
import { ConnectionStatus } from '../components/ConnectionStatus';

interface GameLobbyViewProps {
  gameClient: RPSGameClient;
  gameId: string;
  onGameStarted: (gameData: any) => void;
  onLeaveGame: () => void;
}

const GameLobbyView: React.FC<GameLobbyViewProps> = ({
  gameClient,
  gameId,
  onGameStarted,
  onLeaveGame
}) => {
  const [gameData, setGameData] = useState<Game | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [userPublicKey, setUserPublicKey] = useState<string>('');

  // Load game data and subscribe to updates
  useEffect(() => {
    const loadGameData = async () => {
      try {
        setLoading(true);

        // Get user wallet public key
        if (gameClient) {
          const wallet = (gameClient as any).wallet;
          if (wallet && wallet.publicKey) {
            setUserPublicKey(wallet.publicKey.toString());
          }
        }

        // Subscribe to game updates
        if (!subscribed && gameClient) {
          const id = await gameClient.subscribeToGameUpdates(
            gameId,
            (updatedGame) => {
              console.log('Game updated:', updatedGame);
              // Convert Uint8Array to string for host
              const hostKey = Buffer.from(updatedGame.host).toString('hex');

              // Convert players data
              const players = updatedGame.players.map(player => ({
                ...player,
                pubkey: Buffer.from(player.pubkey).toString('hex')
              }));

              setGameData({
                ...updatedGame,
                host: hostKey,
                players: players
              });

              // Check if the game has started
              if (updatedGame.state === GameState.CommitPhase && !loading) {
                console.log('Game started!');
                onGameStarted(updatedGame);
              }

              setLoading(false);
            }
          );
          setSubscribed(true);
          console.log(`Subscribed to game ${gameId} with ID: ${id}`);
        }
      } catch (error) {
        console.error('Error loading game data:', error);
        setLoading(false);
      }
    };

    loadGameData();

    // Cleanup subscription
    return () => {
      if (subscribed && gameClient) {
        gameClient.unsubscribeFromGameUpdates(gameId);
        console.log(`Unsubscribed from game ${gameId}`);
      }
    };
  }, [gameClient, gameId, subscribed]);

  // Start the game
  const handleStartGame = async () => {
    try {
      setLoading(true);
      await gameClient.startGame(gameId);
      audioService.play('success');
    } catch (error) {
      console.error('Error starting game:', error);
      setLoading(false);
    }
  };

  // Get shortened version of public key for display
  const shortenPubkey = (pubkey: string) => {
    if (!pubkey) return '';
    return `${pubkey.substring(0, 6)}...${pubkey.substring(pubkey.length - 4)}`;
  };

  // Format SOL amounts for display
  const formatSol = (lamports: number) => {
    return (lamports / 1000000000).toFixed(4);
  };

  // Copy game ID to clipboard
  const copyGameId = () => {
    navigator.clipboard.writeText(gameId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    audioService.play('click');
  };

  // Loading state
  if (loading && !gameData) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Loading Game...</h2>
          </div>
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state if no game data
  if (!gameData) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Game Not Found</h2>
          </div>
          <p className="mb-4">Could not load game data. The game might not exist or has ended.</p>
          <button
            onClick={onLeaveGame}
            className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const isHost = gameData.host === userPublicKey;
  const playerCount = gameData.players.length;
  const minPlayers = gameData.minPlayers;
  const readyToStart = playerCount >= minPlayers;
  const currencyMode = gameData.currencyMode || CurrencyMode.SOL;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Game Lobby</h2>

          <div className="flex items-center space-x-2">
            <span className="text-gray-300 text-sm">Game ID:</span>
            <div className="relative">
              <button
                onClick={copyGameId}
                className="bg-gray-700 text-white px-3 py-1 rounded text-sm font-mono"
              >
                {shortenPubkey(gameId)}
              </button>
              {copied && (
                <span className="absolute -bottom-8 left-0 bg-gray-800 text-white text-xs px-2 py-1 rounded">
                  Copied!
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">
            Players <span className="text-purple-400">({playerCount}/{gameData.maxPlayers})</span>
          </h3>

          {/* Your wallet */}
          <div className="bg-purple-900 bg-opacity-30 p-3 rounded-lg mb-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <span className="text-xl mr-3">👤</span>
                <span className="font-mono text-purple-200">
                  {shortenPubkey(userPublicKey)} (You)
                </span>
              </div>
              {gameData.host === userPublicKey && (
                <span className="badge badge-host">Host</span>
              )}
            </div>
          </div>

          {gameData.players
            .filter(player => player.pubkey !== userPublicKey) // Filter out current user
            .map((player, index) => (
              <div
                key={index}
                className="flex justify-between items-center bg-gray-700 p-3 rounded-lg mb-2"
              >
                <div className="flex items-center">
                  <span className="text-xl mr-3">👤</span>
                  <span className="font-mono">
                    {shortenPubkey(player.pubkey)}
                  </span>
                </div>
                {player.pubkey === gameData.host && (
                  <span className="badge badge-host">Host</span>
                )}
              </div>
            ))}

          {/* Empty player slots */}
          {Array(gameData.maxPlayers - playerCount)
            .fill(0)
            .map((_, index) => (
              <div
                key={`empty-${index}`}
                className="flex items-center bg-gray-700 bg-opacity-40 p-3 rounded-lg mb-2 text-gray-400"
              >
                <span className="text-xl mr-3">👤</span>
                <span>Waiting for player...</span>
              </div>
            ))}
        </div>

        <div className="mb-6">
          <ConnectionStatus />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-700 p-4 rounded-lg">
            <h4 className="text-sm text-gray-400 mb-1">Entry Fee</h4>
            <div className="flex items-center">
              <p className="text-xl font-bold">
                {formatSol(gameData.entryFee)} {currencyMode === CurrencyMode.SOL ? 'SOL' : 'RPSTOKEN'}
              </p>
              {currencyMode === CurrencyMode.RPSTOKEN && (
                <span className="ml-2 px-2 py-1 bg-green-800 bg-opacity-40 rounded text-xs text-green-400">
                  -50% Fee
                </span>
              )}
            </div>
          </div>

          <div className="bg-gray-700 p-4 rounded-lg">
            <h4 className="text-sm text-gray-400 mb-1">Currency</h4>
            <p className="text-xl font-bold flex items-center">
              {currencyMode === CurrencyMode.SOL ? (
                <>
                  <span className="w-5 h-5 mr-1 bg-yellow-500 rounded-full flex items-center justify-center text-xs text-black">S</span>
                  SOL
                </>
              ) : (
                <>
                  <span className="w-5 h-5 mr-1 bg-purple-500 rounded-full flex items-center justify-center text-xs text-black">R</span>
                  RPSTOKEN
                </>
              )}
            </p>
          </div>

          <div className="bg-gray-700 p-4 rounded-lg">
            <h4 className="text-sm text-gray-400 mb-1">Total Rounds</h4>
            <p className="text-xl font-bold">{gameData.totalRounds}</p>
          </div>

          <div className="bg-gray-700 p-4 rounded-lg">
            <h4 className="text-sm text-gray-400 mb-1">Prize Pool</h4>
            <div className="flex items-center">
              <p className="text-xl font-bold">
                {formatSol(gameData.gamePot)} {currencyMode === CurrencyMode.SOL ? 'SOL' : 'RPSTOKEN'}
              </p>
              {currencyMode === CurrencyMode.RPSTOKEN && (
                <span className="ml-2 px-2 py-1 bg-green-800 bg-opacity-40 rounded text-xs text-green-400">
                  +5% Bonus
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={onLeaveGame}
            className="flex-1 py-3 rounded-lg text-lg font-bold bg-gray-700 hover:bg-gray-600"
            disabled={loading}
          >
            Leave Game
          </button>

          {isHost ? (
            <button
              onClick={handleStartGame}
              className={`flex-1 py-3 rounded-lg text-lg font-bold ${
                readyToStart && !loading
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                  : 'bg-gray-600 cursor-not-allowed opacity-50'
              }`}
              disabled={!readyToStart || loading}
            >
              {loading
                ? 'Starting Game...'
                : readyToStart
                ? 'Start Game'
                : `Need ${minPlayers - playerCount} More Player${minPlayers - playerCount !== 1 ? 's' : ''}`}
            </button>
          ) : (
            <div className="flex-1 bg-gray-700 p-3 rounded-lg text-center">
              <p className="text-lg">
                {readyToStart
                  ? 'Waiting for host to start...'
                  : `Need ${minPlayers - playerCount} more player${minPlayers - playerCount !== 1 ? 's' : ''}`}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">How to Invite Players</h3>
          <p className="text-gray-300">
            Share your Game ID with friends so they can join your game. They will need to have
            a Solana wallet with sufficient {currencyMode === CurrencyMode.SOL ? 'SOL' : 'RPSTOKEN'} to join.
          </p>
          <div className="mt-4 p-3 bg-gray-800 rounded-lg">
            <p className="text-sm text-white font-semibold mb-2">Copy this invite:</p>
            <div className="bg-gray-900 p-2 rounded font-mono text-xs break-all">
              Join my Rock-Paper-Scissors game on Solana! Game ID: {gameId}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`Join my Rock-Paper-Scissors game on Solana! Game ID: ${gameId}`);
                audioService.play('click');
                alert('Invite copied to clipboard!');
              }}
              className="mt-2 text-sm bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded"
            >
              Copy Invite
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameLobbyView;

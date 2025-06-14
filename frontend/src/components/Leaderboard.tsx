import React, { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { userProfileService, UserProfile } from '../services/user-profile-service';

interface LeaderboardProps {
  currentUserWallet: PublicKey | null;
  limit?: number;
}

const Leaderboard: React.FC<LeaderboardProps> = ({
  currentUserWallet,
  limit = 10
}) => {
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);

  useEffect(() => {
    const loadLeaderboard = async () => {
      setLoading(true);
      try {
        const leaderboardData = await userProfileService.getLeaderboard(limit);
        setLeaderboard(leaderboardData);

        if (currentUserWallet) {
          const rank = await userProfileService.getUserRank(currentUserWallet.toString());
          setCurrentUserRank(rank);
        }
      } catch (error) {
        console.error('Error loading leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [currentUserWallet, limit]);

  const formatWallet = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 shadow-md border border-gray-700 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/2 mb-4"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-700 rounded mb-2"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 shadow-md border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Leaderboard</h3>

      {leaderboard.length === 0 ? (
        <p className="text-gray-400 text-center py-6">No players have joined the leaderboard yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-10 gap-2 text-xs text-gray-400 border-b border-gray-700 pb-2 mb-2">
            <div className="col-span-1">Rank</div>
            <div className="col-span-4">Player</div>
            <div className="col-span-2">Win Rate</div>
            <div className="col-span-1">W</div>
            <div className="col-span-1">L</div>
            <div className="col-span-1">T</div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {leaderboard.map((player, index) => {
              const isCurrentUser = currentUserWallet && player.walletAddress === currentUserWallet.toString();

              return (
                <div
                  key={player.walletAddress}
                  className={`grid grid-cols-10 gap-2 py-2 text-sm ${
                    index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'
                  } ${isCurrentUser ? 'bg-purple-900 bg-opacity-20 border-l-2 border-purple-500' : ''}`}
                >
                  <div className="col-span-1 font-semibold text-center">
                    {player.rank || index + 1}
                  </div>
                  <div className="col-span-4 truncate">
                    {player.displayName || formatWallet(player.walletAddress)}
                    {isCurrentUser && <span className="ml-1 text-purple-400">(You)</span>}
                  </div>
                  <div className="col-span-2">
                    <span
                      className={player.winRate > 60 ? 'text-green-400' : player.winRate < 40 ? 'text-red-400' : 'text-yellow-400'}
                    >
                      {player.winRate}%
                    </span>
                  </div>
                  <div className="col-span-1 text-green-400">{player.wins}</div>
                  <div className="col-span-1 text-red-400">{player.losses}</div>
                  <div className="col-span-1 text-gray-400">{player.ties}</div>
                </div>
              );
            })}
          </div>

          {/* Show current user's rank if not in top 10 */}
          {currentUserWallet && currentUserRank && currentUserRank > limit && (
            <div className="mt-4 pt-2 border-t border-gray-700">
              <p className="text-sm text-gray-400 mb-2">Your ranking:</p>
              <div className="grid grid-cols-10 gap-2 py-2 text-sm bg-purple-900 bg-opacity-20 border-l-2 border-purple-500">
                <div className="col-span-1 font-semibold text-center">{currentUserRank}</div>
                <div className="col-span-4 truncate">
                  {currentUserWallet && formatWallet(currentUserWallet.toString())}
                  <span className="ml-1 text-purple-400">(You)</span>
                </div>
                <div className="col-span-2">
                  <span className="text-yellow-400">
                    {/* We'd need to fetch the actual user profile here */}
                    --
                  </span>
                </div>
                <div className="col-span-1 text-green-400">--</div>
                <div className="col-span-1 text-red-400">--</div>
                <div className="col-span-1 text-gray-400">--</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Leaderboard;

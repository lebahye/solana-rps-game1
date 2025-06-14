import React, { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { userProfileService, UserProfile } from '../services/user-profile-service';

interface UserProfileCardProps {
  walletAddress: PublicKey | null;
  isExpanded?: boolean;
}

const UserProfileCard: React.FC<UserProfileCardProps> = ({ walletAddress, isExpanded = false }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(isExpanded);

  useEffect(() => {
    const loadProfile = async () => {
      if (walletAddress) {
        setLoading(true);
        try {
          const userProfile = await userProfileService.getUserProfile(walletAddress.toString());
          setProfile(userProfile);
          setDisplayName(userProfile?.displayName || '');
        } catch (error) {
          console.error('Error loading profile:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    };

    loadProfile();
  }, [walletAddress]);

  const handleSaveDisplayName = async () => {
    if (profile && walletAddress) {
      try {
        const updatedProfile = await userProfileService.updateDisplayName(
          walletAddress.toString(),
          displayName
        );
        setProfile(updatedProfile);
        setIsEditing(false);
      } catch (error) {
        console.error('Error updating display name:', error);
      }
    }
  };

  const formatWallet = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (!walletAddress) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 shadow-md border border-gray-700">
        <p className="text-gray-400 text-center">Please connect your wallet to view your profile</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 shadow-md border border-gray-700 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-gray-700 rounded w-2/3 mb-2"></div>
        <div className="h-4 bg-gray-700 rounded w-1/3"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 shadow-md border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Player Profile</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-white"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Basic Info - Always Visible */}
      <div className="flex items-center mb-4">
        <div className="w-12 h-12 rounded-full bg-purple-700 flex items-center justify-center text-white font-bold mr-3">
          {profile?.displayName ? profile.displayName[0].toUpperCase() : 'P'}
        </div>
        <div>
          {isEditing ? (
            <div className="flex items-center">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter display name"
                className="bg-gray-700 text-white p-1 rounded mr-2"
                maxLength={20}
              />
              <button
                onClick={handleSaveDisplayName}
                className="bg-purple-600 text-white px-2 py-1 rounded text-sm"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="ml-1 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center">
              <h4 className="font-semibold text-white">
                {profile?.displayName || formatWallet(walletAddress.toString())}
              </h4>
              <button
                onClick={() => setIsEditing(true)}
                className="ml-2 text-gray-400 hover:text-white text-sm"
                title="Edit display name"
              >
                ✎
              </button>
            </div>
          )}
          <p className="text-gray-400 text-sm">Rank #{profile?.rank || '—'}</p>
        </div>
      </div>

      {/* Stats - Visible when expanded */}
      {expanded && profile && (
        <div className="border-t border-gray-700 pt-3">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-gray-700 rounded p-2">
              <p className="text-gray-400 text-xs">Win Rate</p>
              <p className="text-white font-semibold">{profile.winRate}%</p>
            </div>
            <div className="bg-gray-700 rounded p-2">
              <p className="text-gray-400 text-xs">Total Games</p>
              <p className="text-white font-semibold">{profile.totalGames}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-green-900 bg-opacity-40 rounded p-2">
              <p className="text-green-400 text-xs">Wins</p>
              <p className="text-white font-semibold">{profile.wins}</p>
            </div>
            <div className="bg-red-900 bg-opacity-40 rounded p-2">
              <p className="text-red-400 text-xs">Losses</p>
              <p className="text-white font-semibold">{profile.losses}</p>
            </div>
            <div className="bg-gray-700 rounded p-2">
              <p className="text-gray-400 text-xs">Ties</p>
              <p className="text-white font-semibold">{profile.ties}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-700 rounded p-2">
              <p className="text-gray-400 text-xs">Total Wagered</p>
              <p className="text-white font-semibold">{profile.totalWagered.toFixed(2)}</p>
            </div>
            <div className={`${profile.netProfit >= 0 ? 'bg-green-900 bg-opacity-40' : 'bg-red-900 bg-opacity-40'} rounded p-2`}>
              <p className={`${profile.netProfit >= 0 ? 'text-green-400' : 'text-red-400'} text-xs`}>Net Profit</p>
              <p className="text-white font-semibold">{profile.netProfit.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileCard;

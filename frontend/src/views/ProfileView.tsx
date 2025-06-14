import React, { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import UserProfileCard from '../components/UserProfileCard';
import Leaderboard from '../components/Leaderboard';
import { userProfileService } from '../services/user-profile-service';

// Import test data generator for demonstration purposes
import { generateMockProfiles } from '../utils/mock-data';

interface ProfileViewProps {
  publicKey: PublicKey | null;
  connected: boolean;
  onBackToHome: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({
  publicKey,
  connected,
  onBackToHome
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'leaderboard'>('profile');

  // For demonstration/development, generate mock profiles if none exist
  useEffect(() => {
    const initializeProfiles = async () => {
      try {
        const leaderboard = await userProfileService.getLeaderboard();
        if (leaderboard.length === 0) {
          // Only generate mock data if there are no existing profiles
          generateMockProfiles(10);
        }
      } catch (error) {
        console.error('Error initializing profiles:', error);
      }
    };

    initializeProfiles();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Player Profiles</h2>
        <button
          onClick={onBackToHome}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
        >
          Back to Home
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700 mb-6">
        <button
          className={`px-4 py-2 ${
            activeTab === 'profile'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('profile')}
        >
          My Profile
        </button>
        <button
          className={`px-4 py-2 ${
            activeTab === 'leaderboard'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('leaderboard')}
        >
          Leaderboard
        </button>
      </div>

      {/* Content based on active tab */}
      <div className="space-y-6">
        {activeTab === 'profile' ? (
          <>
            <UserProfileCard walletAddress={publicKey} isExpanded={true} />

            {/* Additional profile content can go here */}
            <div className="bg-gray-800 rounded-lg p-4 shadow-md border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">Recent Games</h3>
              <p className="text-gray-400 text-center py-6">
                Your recent game history will appear here as you play.
              </p>
            </div>
          </>
        ) : (
          <Leaderboard currentUserWallet={publicKey} />
        )}
      </div>

      {/* For development/testing: Reset button */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 pt-4 border-t border-gray-700">
          <details className="text-gray-500 text-sm">
            <summary className="cursor-pointer">Developer Tools</summary>
            <div className="mt-2 flex space-x-4">
              <button
                onClick={() => {
                  userProfileService.clearAllProfiles();
                  generateMockProfiles(10);
                  window.location.reload();
                }}
                className="px-3 py-1 bg-gray-700 rounded text-xs"
              >
                Reset & Generate Profiles
              </button>

              <button
                onClick={() => {
                  if (publicKey) {
                    userProfileService.updateProfileAfterGame(
                      publicKey.toString(),
                      Math.random() > 0.5 ? 'win' : 'loss',
                      Math.random() * 0.5 + 0.1
                    );
                    window.location.reload();
                  }
                }}
                className="px-3 py-1 bg-gray-700 rounded text-xs"
                disabled={!connected}
              >
                Simulate Game Result
              </button>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default ProfileView;

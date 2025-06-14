import { Connection, PublicKey } from '@solana/web3.js';
import { GameOutcome } from '../types';

// Interface for user profile data
export interface UserProfile {
  walletAddress: string;
  displayName: string | null;
  totalGames: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  totalWagered: number;
  netProfit: number;
  lastActive: number; // Timestamp
  rank?: number; // Optional rank in leaderboard
}

// For now, we'll use localStorage as a temporary solution
// In a production environment, this should be replaced with:
// 1. On-chain storage for user stats (using a Solana program)
// 2. Off-chain database with server API (for more complex data)
class UserProfileService {
  private readonly STORAGE_KEY = 'solana-rps-user-profiles';
  private readonly LEADERBOARD_KEY = 'solana-rps-leaderboard';

  // Get a user profile by wallet address
  async getUserProfile(walletAddress: string): Promise<UserProfile | null> {
    try {
      const profiles = this.getAllProfiles();
      return profiles[walletAddress] || this.createDefaultProfile(walletAddress);
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  // Create a default profile for new users
  private createDefaultProfile(walletAddress: string): UserProfile {
    const newProfile: UserProfile = {
      walletAddress,
      displayName: null,
      totalGames: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      winRate: 0,
      totalWagered: 0,
      netProfit: 0,
      lastActive: Date.now()
    };

    // Save the new profile
    const profiles = this.getAllProfiles();
    profiles[walletAddress] = newProfile;
    this.saveProfiles(profiles);

    return newProfile;
  }

  // Update profile after a game
  async updateProfileAfterGame(
    walletAddress: string,
    outcome: GameOutcome,
    wagerAmount: number
  ): Promise<UserProfile> {
    const profile = await this.getUserProfile(walletAddress);
    if (!profile) throw new Error('Profile not found');

    // Update game statistics
    profile.totalGames += 1;
    profile.lastActive = Date.now();
    profile.totalWagered += wagerAmount;

    // Update based on outcome
    if (outcome === 'win') {
      profile.wins += 1;
      profile.netProfit += wagerAmount; // Simplified; actual profit would be wager * 2
    } else if (outcome === 'loss') {
      profile.losses += 1;
      profile.netProfit -= wagerAmount;
    } else if (outcome === 'tie') {
      profile.ties += 1;
      // No change to netProfit on tie
    }

    // Calculate win rate
    profile.winRate = profile.totalGames > 0
      ? Number(((profile.wins / profile.totalGames) * 100).toFixed(1))
      : 0;

    // Save updated profile
    const profiles = this.getAllProfiles();
    profiles[walletAddress] = profile;
    this.saveProfiles(profiles);

    // Update leaderboard
    this.updateLeaderboard();

    return profile;
  }

  // Track game completion from the game results
  async trackGameCompletion(
    userPublicKey: PublicKey | null,
    gameResult: {
      score?: number;
      winners: string[];
      gamePot: number;
    }
  ): Promise<void> {
    if (!userPublicKey) return;

    const walletAddress = userPublicKey.toString();
    const userWon = gameResult.winners.includes(walletAddress);
    const wagerAmount = gameResult.gamePot / 2; // Assuming equal wagers

    // Determine outcome
    let outcome: GameOutcome;
    if (gameResult.winners.length > 1) {
      outcome = 'tie';
    } else if (userWon) {
      outcome = 'win';
    } else {
      outcome = 'loss';
    }

    // Update user profile
    await this.updateProfileAfterGame(walletAddress, outcome, wagerAmount);
  }

  // Update display name
  async updateDisplayName(walletAddress: string, displayName: string): Promise<UserProfile> {
    const profile = await this.getUserProfile(walletAddress);
    if (!profile) throw new Error('Profile not found');

    profile.displayName = displayName;

    const profiles = this.getAllProfiles();
    profiles[walletAddress] = profile;
    this.saveProfiles(profiles);

    return profile;
  }

  // Get all profiles
  private getAllProfiles(): Record<string, UserProfile> {
    const profilesJson = localStorage.getItem(this.STORAGE_KEY);
    return profilesJson ? JSON.parse(profilesJson) : {};
  }

  // Save all profiles
  private saveProfiles(profiles: Record<string, UserProfile>): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(profiles));
  }

  // Update the leaderboard
  private updateLeaderboard(): void {
    const profiles = this.getAllProfiles();

    // Convert to array for sorting
    const profileArray = Object.values(profiles);

    // Sort by win rate, then by total games as tiebreaker
    profileArray.sort((a, b) => {
      if (b.winRate !== a.winRate) {
        return b.winRate - a.winRate;
      }
      return b.totalGames - a.totalGames;
    });

    // Assign ranks
    profileArray.forEach((profile, index) => {
      profile.rank = index + 1;
    });

    // Save leaderboard
    localStorage.setItem(this.LEADERBOARD_KEY, JSON.stringify(profileArray));
  }

  // Get the leaderboard
  async getLeaderboard(limit: number = 10): Promise<UserProfile[]> {
    try {
      const leaderboardJson = localStorage.getItem(this.LEADERBOARD_KEY);
      if (!leaderboardJson) {
        this.updateLeaderboard();
        return this.getLeaderboard(limit);
      }

      const leaderboard = JSON.parse(leaderboardJson) as UserProfile[];
      return leaderboard.slice(0, limit);
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  // Get a user's rank
  async getUserRank(walletAddress: string): Promise<number | null> {
    try {
      const leaderboard = await this.getLeaderboard(1000); // Get full leaderboard
      const userIndex = leaderboard.findIndex(p => p.walletAddress === walletAddress);

      return userIndex >= 0 ? userIndex + 1 : null;
    } catch (error) {
      console.error('Error getting user rank:', error);
      return null;
    }
  }

  // Delete a user profile (for testing/development)
  async deleteProfile(walletAddress: string): Promise<void> {
    const profiles = this.getAllProfiles();
    if (profiles[walletAddress]) {
      delete profiles[walletAddress];
      this.saveProfiles(profiles);
      this.updateLeaderboard();
    }
  }

  // Clear all profiles (for testing/development)
  async clearAllProfiles(): Promise<void> {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.LEADERBOARD_KEY);
  }
}

export const userProfileService = new UserProfileService();
export default userProfileService;

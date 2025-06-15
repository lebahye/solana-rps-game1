
interface MockProfile {
  id: string;
  name: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  totalEarnings: number;
  avatar: string;
}

export function generateMockProfiles(count: number = 10): MockProfile[] {
  const names = [
    'CryptoWarrior', 'SolanaShark', 'RPSMaster', 'BlockchainBoss',
    'TokenTiger', 'Web3Wizard', 'DeFiDragon', 'NFTNinja',
    'MetaverseMage', 'CoinCollector', 'ChainChampion', 'DecentralDuke'
  ];
  
  const avatars = [
    '🦸‍♂️', '🥷', '🤖', '👑', '🦅', '🐅', '🦄', '⚡', '🔥', '💎', '🚀', '🌟'
  ];
  
  return Array.from({ length: count }, (_, i) => {
    const gamesPlayed = Math.floor(Math.random() * 500) + 10;
    const wins = Math.floor(Math.random() * gamesPlayed);
    const losses = gamesPlayed - wins;
    const winRate = wins / gamesPlayed;
    
    return {
      id: `player_${i + 1}`,
      name: names[i % names.length],
      gamesPlayed,
      wins,
      losses,
      winRate,
      totalEarnings: Math.floor(Math.random() * 1000) / 100,
      avatar: avatars[i % avatars.length]
    };
  });
}

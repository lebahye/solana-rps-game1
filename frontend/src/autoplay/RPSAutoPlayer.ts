import { RPSGameClient } from '../rps-client';
import { AutoPlayStats, CurrencyMode, GameHistoryItem, GameOutcome, BettingStrategy } from '../types';

export class RPSAutoPlayer {
  private client: RPSGameClient;
  private isRunning: boolean = false;
  private stats: AutoPlayStats = {
    currentStreak: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    totalWagered: 0,
    netProfit: 0,
    gameHistory: [],
  };
  private currentWager: number = 0;

  constructor(client: RPSGameClient) {
    this.client = client;
  }

  // Start automated gameplay
  public async start(
    wagerAmount: number,
    currency: CurrencyMode,
    strategy: BettingStrategy,
    gameSpeed: number = 2000,
    onRoundComplete: (
      stats: AutoPlayStats,
      lastGame: GameHistoryItem,
      currentWager: number
    ) => number, // Returns next wager amount
    onError: (error: Error) => void
  ) {
    if (this.isRunning) return;

    this.isRunning = true;
    this.currentWager = wagerAmount;
    // Avoid resetting stats to allow for continuing sessions

    // Continue playing rounds until stopped
    while (this.isRunning) {
      try {
        // 1. Create a new game
        const { gameId } = await this.client.createGame(
          3, // minPlayers
          3, // maxPlayers - using 3 for faster games
          1, // totalRounds
          this.currentWager,
          30, // timeoutSeconds
          false // losersCanRejoin
        );

        // 2. For demo purposes, we'll assume the game is filled with bot players
        // In a real implementation, this would be handled by the server

        // 3. Generate a random choice (1=Rock, 2=Paper, 3=Scissors)
        const playerChoice = Math.floor(Math.random() * 3) + 1;

        // 4. Commit the choice
        const salt = this.generateRandomSalt();
        await this.client.commitChoice(gameId, playerChoice, salt);

        // 5. Simulate other players committing choices (in real implementation this would be done by other players)
        // In this demo, we'll just pretend this happens instantly

        // 6. Reveal the choice and get results
        await this.client.revealChoice(gameId, playerChoice, salt);

        // 7. In a real implementation, we would wait for game results from the blockchain
        // For demo purposes, we'll simulate a random result
        const outcomes: GameOutcome[] = ['win', 'loss', 'tie'];
        const result = outcomes[Math.floor(Math.random() * outcomes.length)];

        // 8. Simulate opponent choices
        const opponentChoices = [
          Math.floor(Math.random() * 3) + 1,
          Math.floor(Math.random() * 3) + 1
        ];

        // 9. Update stats
        this.stats.totalWagered += this.currentWager;

        const gameOutcome: GameHistoryItem = {
          playerChoice,
          opponentChoices,
          result,
          timestamp: Date.now(),
          wagerAmount: this.currentWager
        };

        if (result === 'win') {
          this.stats.wins++;
          this.stats.currentStreak = Math.max(0, this.stats.currentStreak) + 1;
          this.stats.netProfit += this.currentWager * 1.9; // Simplified payout (90% of pool after fees)
        } else if (result === 'loss') {
          this.stats.losses++;
          this.stats.currentStreak = this.stats.currentStreak > 0 ? -1 : this.stats.currentStreak - 1;
          this.stats.netProfit -= this.currentWager;
        } else {
          this.stats.ties++;
          // No change to streak for ties
        }

        this.stats.gameHistory.push(gameOutcome);

        // 10. Notify callback and get next wager amount
        this.currentWager = onRoundComplete(this.stats, gameOutcome, this.currentWager);

        // 11. Small delay between rounds based on game speed setting
        await new Promise(resolve => setTimeout(resolve, gameSpeed));

      } catch (error) {
        console.error("Auto-play error:", error);
        onError(error as Error);
        // Pause briefly on error
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  // Stop automated gameplay
  public stop() {
    this.isRunning = false;
  }

  // Get current stats
  public getStats(): AutoPlayStats {
    return { ...this.stats };
  }

  // Check if auto-play is running
  public isAutoPlaying(): boolean {
    return this.isRunning;
  }

  // Reset stats
  public resetStats() {
    this.stats = {
      currentStreak: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      totalWagered: 0,
      netProfit: 0,
      gameHistory: [],
    };
  }

  // Helper to generate random salt
  private generateRandomSalt(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

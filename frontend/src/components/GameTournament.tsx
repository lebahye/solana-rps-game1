import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PublicKey }
from '@solana/web3.js';
// Assuming RPSGameClient and other types are correctly imported from your project structure
// You might need to adjust the import paths
import { RPSGameClient } from '../rps-client'; // Adjust if client is elsewhere
import { Choice, CurrencyMode, GameView } from '../types'; // Adjust for your actual types
import './GameTournament.css'; // Dedicated CSS for the tournament component

// --- Helper Types ---
interface PlayerInfo {
  id: string; // publicKey.toBase58()
  name: string;
  avatar?: string; // URL to an avatar image, or use a default
  isCurrentUser?: boolean;
}

interface Match {
  id: string;
  roundIndex: number;
  matchIndex: number;
  player1: PlayerInfo | null;
  player2: PlayerInfo | null;
  winner: PlayerInfo | null;
  status: 'Pending' | 'Scheduled' | 'InProgress' | 'Completed' | 'Bye';
  gameId?: string; // ID of the underlying RPS game for this match
  score?: { player1: number; player2: number }; // For multi-game matches
}

interface TournamentRound {
  roundNumber: number;
  matches: Match[];
}

interface Tournament {
  id: string;
  name: string;
  status: 'Registering' | 'Seeding' | 'InProgress' | 'Paused' | 'Finished' | 'Cancelled';
  players: PlayerInfo[];
  brackets: TournamentRound[];
  currentRound: number;
  prizePool: number;
  entryFee: number;
  currency: CurrencyMode;
  winner: PlayerInfo | null;
  maxPlayers: number;
  host: PlayerInfo | null; // Tournament creator
}

interface GameTournamentProps {
  gameClient: RPSGameClient | null;
  currentUserPublicKey: PublicKey | null;
  onTournamentEnd?: (winner: PlayerInfo | null, prize: number) => void;
  // audioService: any; // Replace 'any' with your actual audio service type
  navigateToGameView?: (view: GameView, params?: any) => void; // For navigating to individual games
}

// --- Mock Audio Service (Replace with your actual service) ---
const mockAudioService = {
  play: (soundName: string) => console.log(`Playing sound: ${soundName}`),
};

const GameTournament: React.FC<GameTournamentProps> = ({
  gameClient,
  currentUserPublicKey,
  onTournamentEnd,
  // audioService = mockAudioService, // Use mock if not provided
  navigateToGameView,
}) => {
  const audioService = mockAudioService; // Using mock for now
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTournamentConfig, setNewTournamentConfig] = useState({
    name: 'My Awesome RPS Tournament',
    maxPlayers: 8, // Must be a power of 2 for simple bracket generation
    entryFee: 0.1, // In SOL or token units
    currency: CurrencyMode.SOL,
  });

  const currentUserId = currentUserPublicKey?.toBase58();

  const generateBrackets = useCallback((players: PlayerInfo[]): TournamentRound[] => {
    if (players.length === 0) return [];

    const numPlayers = players.length;
    // Ensure numPlayers is a power of 2 for simple single-elimination
    // For non-power-of-2, byes are needed. This is a simplified version.
    if (numPlayers < 2 ) { //|| (numPlayers & (numPlayers - 1)) !== 0 -> for power of 2 check
      setError("Number of players must be at least 2 for a tournament.");
      return [];
    }

    let currentRoundPlayers = [...players];
    // Add byes if not a power of 2
    let nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(numPlayers)));
    if (numPlayers !== nextPowerOfTwo && numPlayers > 1) { // only add byes if not already a power of two
        const byesToAdd = nextPowerOfTwo - numPlayers;
        for (let i = 0; i < byesToAdd; i++) {
            currentRoundPlayers.push({ id: `bye-${i}`, name: 'BYE', isCurrentUser: false });
        }
    }
    
    // Shuffle players for seeding (optional, but good for fairness)
    currentRoundPlayers.sort(() => Math.random() - 0.5);


    const rounds: TournamentRound[] = [];
    let roundIndex = 0;

    while (currentRoundPlayers.length > 1 || (currentRoundPlayers.length === 1 && rounds.length === 0 && numPlayers === 1) ) { // Handle single player "tournament"
      if (currentRoundPlayers.length === 1 && numPlayers === 1) { // Special case: 1 player tournament
        rounds.push({
          roundNumber: roundIndex + 1,
          matches: [{
            id: `r${roundIndex}m0`,
            roundIndex,
            matchIndex: 0,
            player1: currentRoundPlayers[0],
            player2: null, // No opponent
            winner: currentRoundPlayers[0], // Automatically wins
            status: 'Completed'
          }]
        });
        break; 
      }
      if (currentRoundPlayers.length < 2) break; // Should not happen with bye logic if numPlayers > 1

      const roundMatches: Match[] = [];
      const nextRoundPlayers: (PlayerInfo | null)[] = []; // Store winners for the next round

      for (let i = 0; i < currentRoundPlayers.length; i += 2) {
        const player1 = currentRoundPlayers[i];
        const player2 = (i + 1 < currentRoundPlayers.length) ? currentRoundPlayers[i + 1] : null;
        const matchIndex = i / 2;
        const matchId = `r${roundIndex}m${matchIndex}`;
        
        let matchStatus: 'Scheduled' | 'Completed' | 'Bye' = 'Scheduled';
        let winner: PlayerInfo | null = null;

        if (player1?.name === 'BYE') {
            winner = player2;
            matchStatus = 'Bye';
        } else if (player2?.name === 'BYE') {
            winner = player1;
            matchStatus = 'Bye';
        }
        
        if (winner) nextRoundPlayers.push(winner);
        else nextRoundPlayers.push(null); // Placeholder for winner

        roundMatches.push({
          id: matchId,
          roundIndex,
          matchIndex,
          player1,
          player2,
          winner,
          status: matchStatus,
        });
      }
      rounds.push({ roundNumber: roundIndex + 1, matches: roundMatches });
      
      // Prepare players for the next round (only actual players, not placeholders for winners yet)
      currentRoundPlayers = nextRoundPlayers.filter(p => p !== null) as PlayerInfo[]; // Winners advance
      if(currentRoundPlayers.length === 0 && nextRoundPlayers.some(p=>p===null) && rounds[rounds.length-1].matches.some(m=>m.status === 'Scheduled')) {
        // This means all matches are scheduled, waiting for winners
      } else if (currentRoundPlayers.length === 1 && rounds[rounds.length-1].matches.length > 0) {
        // Tournament ends, this is the winner
      }


      roundIndex++;
      if (roundIndex > Math.log2(nextPowerOfTwo) + 2) { // Safety break
          log.error("Too many rounds generated, breaking.");
          break;
      }
    }
    return rounds;
  }, [setError]);


  const handleCreateTournament = useCallback(async () => {
    if (!gameClient || !currentUserId) {
      setError('Wallet not connected or game client not initialized.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setShowCreateModal(false);

    try {
      // This is a mock creation. Backend interaction would be needed.
      // For now, we create a local tournament object.
      const hostPlayer: PlayerInfo = { id: currentUserId, name: `Player ${currentUserId.substring(0, 6)}`, isCurrentUser: true };
      const newTournamentData: Tournament = {
        id: `tourney_${Date.now()}`,
        name: newTournamentConfig.name,
        status: 'Registering',
        players: [hostPlayer], // Host is the first player
        brackets: [],
        currentRound: 0,
        prizePool: 0, // Will update as players join
        entryFee: newTournamentConfig.entryFee,
        currency: newTournamentConfig.currency,
        winner: null,
        maxPlayers: newTournamentConfig.maxPlayers,
        host: hostPlayer,
      };
      setTournament(newTournamentData);
      audioService.play('tournament-created');
      log.success(`Tournament "${newTournamentData.name}" created locally.`);
    } catch (e: any) {
      setError(`Failed to create tournament: ${e.message}`);
      log.error("Tournament creation error", e);
    } finally {
      setIsLoading(false);
    }
  }, [gameClient, currentUserId, newTournamentConfig, audioService]);

  const handleJoinTournament = useCallback(async () => {
    if (!tournament || !currentUserId || tournament.status !== 'Registering') {
      setError('Cannot join tournament now or not logged in.');
      return;
    }
    if (tournament.players.find(p => p.id === currentUserId)) {
      setError('You have already joined this tournament.');
      return;
    }
    if (tournament.players.length >= tournament.maxPlayers) {
      setError('Tournament is full.');
      return;
    }

    setIsLoading(true);
    // Simulate backend call for joining and paying entry fee
    try {
      // TODO: Actual transaction for entry fee
      // await gameClient.payTournamentEntryFee(tournament.id, tournament.entryFee, tournament.currency);
      
      const newPlayer: PlayerInfo = { id: currentUserId, name: `Player ${currentUserId.substring(0, 6)}`, isCurrentUser: true };
      setTournament(prev => prev ? ({
        ...prev,
        players: [...prev.players, newPlayer],
        prizePool: prev.prizePool + prev.entryFee,
      }) : null);
      audioService.play('player-join-tournament');
      log.info(`Player ${currentUserId} joined tournament ${tournament.id}`);
    } catch (e: any) {
      setError(`Failed to join tournament: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [tournament, currentUserId, audioService, gameClient]);

  const handleStartTournament = useCallback(() => {
    if (!tournament || tournament.status !== 'Registering') return;
    if (tournament.players.length < 2) {
        setError("Need at least 2 players to start the tournament.");
        return;
    }

    setIsLoading(true);
    const brackets = generateBrackets(tournament.players);
    if (brackets.length > 0) {
        setTournament(prev => prev ? ({
            ...prev,
            brackets,
            status: 'InProgress',
            currentRound: 1,
        }) : null);
        audioService.play('tournament-start');
        log.info(`Tournament ${tournament.id} started with ${tournament.players.length} players.`);
        // Potentially start the first match(es)
        // For now, user will click on a match to play
    } else {
        setError("Failed to generate brackets. Ensure player count is valid.");
    }
    setIsLoading(false);
  }, [tournament, generateBrackets, audioService]);

  const handlePlayMatch = useCallback(async (match: Match) => {
    if (!tournament || !gameClient || !currentUserId || match.status !== 'Scheduled') return;
    if (!match.player1 || !match.player2) {
        setError("Match players not properly set.");
        return;
    }
    if (match.player1.name === 'BYE' || match.player2.name === 'BYE') {
        // This should have been handled by advancing winner already.
        // If somehow clicked, just log and do nothing.
        log.warn("Attempted to play a BYE match.");
        return;
    }

    const isPlayer1CurrentUser = match.player1.id === currentUserId;
    const isPlayer2CurrentUser = match.player2.id === currentUserId;

    if (!isPlayer1CurrentUser && !isPlayer2CurrentUser) {
      setError("You are not a participant in this match.");
      return;
    }

    setActiveMatchId(match.id);
    setIsLoading(true);
    audioService.play('match-start');

    // Option 1: Navigate to a standard GameView for this match
    if (navigateToGameView) {
        log.info(`Navigating to game view for match ${match.id} between ${match.player1.name} and ${match.player2.name}`);
        // We need a way to get the result back from GameView or monitor the gameId
        // This is complex. For a self-contained component, simulation is easier.
        // For now, let's assume we'd pass params to create/join a specific game for this tournament match.
        // const gameParams = {
        //   isTournamentMatch: true,
        //   tournamentId: tournament.id,
        //   matchId: match.id,
        //   player1: match.player1.id,
        //   player2: match.player2.id,
        //   entryFee: 0, // Tournament entry fee already paid
        //   currency: tournament.currency,
        //   // ... other necessary params
        // };
        // navigateToGameView(GameView.CREATE_GAME, gameParams); // Or a specific tournament game view
        // For now, we'll simulate locally.
        setError("Navigation to individual game view is not fully implemented in this component. Simulating match...");
        // Simulate match result after a delay
        setTimeout(() => simulateMatchOutcome(match.id), 2000);
        return;
    }
    
    // Option 2: Simulate match result locally (for this component's demo purpose)
    log.info(`Simulating match ${match.id} between ${match.player1.name} and ${match.player2.name}`);
    setTimeout(() => simulateMatchOutcome(match.id), 3000); // Simulate game play time

  }, [tournament, gameClient, currentUserId, audioService, navigateToGameView]);

  const simulateMatchOutcome = (matchId: string) => {
    setTournament(prevTournament => {
        if (!prevTournament) return null;
        let winner: PlayerInfo | null = null;
        let p1Score = 0;
        let p2Score = 0;

        const updatedBrackets = prevTournament.brackets.map(r => ({
            ...r,
            matches: r.matches.map(m => {
                if (m.id === matchId) {
                    if (!m.player1 || !m.player2) return m; // Should not happen
                    // Randomly pick a winner for simulation
                    if (Math.random() > 0.5) {
                        winner = m.player1;
                        p1Score = 1;
                    } else {
                        winner = m.player2;
                        p2Score = 1;
                    }
                    audioService.play(winner?.id === currentUserId ? 'match-win' : 'match-lose');
                    return { ...m, status: 'Completed' as 'Completed', winner, score: { player1: p1Score, player2: p2Score } };
                }
                return m;
            })
        }));
        
        // Check if round is complete and advance winners
        return advanceTournamentState( { ...prevTournament, brackets: updatedBrackets }, matchId);
    });
    setActiveMatchId(null);
    setIsLoading(false);
  };

  const advanceTournamentState = (currentT: Tournament, lastPlayedMatchId: string): Tournament => {
    let newTournamentState = { ...currentT };
    const matchRoundIndex = newTournamentState.brackets.findIndex(r => r.matches.some(m => m.id === lastPlayedMatchId));

    if (matchRoundIndex === -1) return newTournamentState; // Should not happen

    const currentRound = newTournamentState.brackets[matchRoundIndex];
    const allMatchesInRoundCompleted = currentRound.matches.every(m => m.status === 'Completed' || m.status === 'Bye');

    if (allMatchesInRoundCompleted) {
        // If this was the final round
        if (matchRoundIndex === newTournamentState.brackets.length - 1) {
            const finalMatch = currentRound.matches[0];
            if (finalMatch && finalMatch.winner) {
                newTournamentState.winner = finalMatch.winner;
                newTournamentState.status = 'Finished';
                audioService.play('tournament-win');
                log.success(`Tournament ${newTournamentState.id} finished! Winner: ${finalMatch.winner.name}`);
                if (onTournamentEnd) {
                    onTournamentEnd(finalMatch.winner, newTournamentState.prizePool);
                }
            }
        } else {
            // Advance winners to the next round
            const nextRoundIndex = matchRoundIndex + 1;
            if (newTournamentState.brackets[nextRoundIndex]) {
                const winnersFromCurrentRound = currentRound.matches.map(m => m.winner).filter(w => w !== null) as PlayerInfo[];
                let playerIdx = 0;
                newTournamentState.brackets[nextRoundIndex].matches = newTournamentState.brackets[nextRoundIndex].matches.map(nextMatch => {
                    if (nextMatch.status === 'Pending' || nextMatch.status === 'Scheduled') { // Only fill if not already filled (e.g. by a bye)
                        if (!nextMatch.player1 && playerIdx < winnersFromCurrentRound.length) {
                            nextMatch.player1 = winnersFromCurrentRound[playerIdx++];
                        }
                        if (!nextMatch.player2 && playerIdx < winnersFromCurrentRound.length) {
                            nextMatch.player2 = winnersFromCurrentRound[playerIdx++];
                        }
                        // If both players are now set, change status to Scheduled
                        if (nextMatch.player1 && nextMatch.player2) {
                           nextMatch.status = 'Scheduled';
                        } else if ((nextMatch.player1 && !nextMatch.player2 && nextMatch.player1.name !== 'BYE') || (!nextMatch.player1 && nextMatch.player2 && nextMatch.player2.name !== 'BYE')) {
                           // One player, other slot is empty, means this player gets a bye for THIS match in next round
                           nextMatch.winner = nextMatch.player1 || nextMatch.player2;
                           nextMatch.status = 'Bye';
                        }
                    }
                    return nextMatch;
                });
                 newTournamentState.currentRound = nextRoundIndex + 1;
                 log.info(`Advanced to round ${newTournamentState.currentRound}`);
            }
        }
    }
    return newTournamentState;
  };


  const renderBracketNode = (match: Match, isConnectTop: boolean, isConnectBottom: boolean) => {
    const canPlay = match.status === 'Scheduled' && 
                    (match.player1?.id === currentUserId || match.player2?.id === currentUserId) &&
                    match.player1?.name !== 'BYE' && match.player2?.name !== 'BYE';

    return (
      <div className={`bracket-match-node ${match.status.toLowerCase()}`} key={match.id}>
        <div className="bracket-lines">
          {isConnectTop && <div className="line-top"></div>}
          <div className="line-middle"></div>
          {isConnectBottom && <div className="line-bottom"></div>}
        </div>
        <div className="bracket-match-box">
          <div className={`player-slot ${match.winner === match.player1 ? 'winner' : ''} ${match.player1?.isCurrentUser ? 'current-user' : ''}`}>
            {match.player1 ? match.player1.name : 'TBD'}
            {match.score && <span className="player-score">{match.score.player1}</span>}
          </div>
          <div className="vs-divider">vs</div>
          <div className={`player-slot ${match.winner === match.player2 ? 'winner' : ''} ${match.player2?.isCurrentUser ? 'current-user' : ''}`}>
            {match.player2 ? match.player2.name : 'TBD'}
            {match.score && <span className="player-score">{match.score.player2}</span>}
          </div>
          {match.status === 'Scheduled' && (match.player1?.name === 'BYE' || match.player2?.name === 'BYE') && <div className="match-status-text">BYE</div>}
          {match.status === 'Scheduled' && match.player1 && match.player2 && match.player1.name !== 'BYE' && match.player2.name !== 'BYE' && (
            canPlay ? (
              <button onClick={() => handlePlayMatch(match)} disabled={isLoading || activeMatchId === match.id} className="play-match-button">
                {activeMatchId === match.id ? 'Playing...' : 'Play Match'}
              </button>
            ) : (
              <span className="match-status-text">Waiting</span>
            )
          )}
          {match.status === 'InProgress' && <div className="match-status-text">In Progress...</div>}
          {match.status === 'Completed' && match.winner && <div className="match-status-text winner-text">Winner: {match.winner.name}</div>}
        </div>
      </div>
    );
  };
  
  const renderBrackets = () => {
    if (!tournament || !tournament.brackets || tournament.brackets.length === 0) {
      return <p>No bracket generated yet. Register players and start the tournament.</p>;
    }

    return (
      <div className="tournament-brackets-container">
        {tournament.brackets.map((round, roundIdx) => (
          <div className="bracket-round" key={`round-${roundIdx}`}>
            <h3 className="round-title">Round {round.roundNumber}</h3>
            <div className="round-matches">
              {round.matches.map((match, matchIdx) => {
                // Determine connector lines based on match position in the round
                // This is a simplified logic for connectors; a real library would do this better.
                const isEvenMatch = matchIdx % 2 === 0;
                // Connect to next round if not the final round
                const connectToNext = roundIdx < tournament.brackets.length - 1;
                return (
                    <div className="match-wrapper" key={match.id}>
                        {renderBracketNode(match, connectToNext && isEvenMatch, connectToNext && !isEvenMatch)}
                        {/* Connector to next round's match (simplified) */}
                        {connectToNext && tournament.brackets[roundIdx+1]?.matches[Math.floor(matchIdx/2)] && (
                             <div className="connector-line-horizontal"></div>
                        )}
                    </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading && !tournament) { // Initial loading for tournament data if fetched from backend
    return <div className="loading-indicator tournament-loading">Loading Tournament...</div>;
  }

  if (!tournament) {
    return (
      <div className="game-tournament no-tournament">
        <h2>No Active Tournament</h2>
        <button onClick={() => setShowCreateModal(true)} className="create-tournament-button primary">
          Create New Tournament
        </button>
        {/* TODO: Add list of joinable tournaments if applicable */}

        {showCreateModal && (
          <div className="modal-overlay">
            <div className="modal-content create-tournament-modal">
              <h3>Create Tournament</h3>
              <div className="form-group">
                <label htmlFor="tournamentName">Tournament Name:</label>
                <input type="text" id="tournamentName" value={newTournamentConfig.name} onChange={e => setNewTournamentConfig(p => ({...p, name: e.target.value}))} />
              </div>
              <div className="form-group">
                <label htmlFor="maxPlayers">Max Players (power of 2, e.g., 4, 8, 16):</label>
                <select id="maxPlayers" value={newTournamentConfig.maxPlayers} onChange={e => setNewTournamentConfig(p => ({...p, maxPlayers: parseInt(e.target.value)}))}>
                    <option value="2">2</option>
                    <option value="4">4</option>
                    <option value="8">8</option>
                    <option value="16">16</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="entryFee">Entry Fee:</label>
                <input type="number" id="entryFee" value={newTournamentConfig.entryFee} min="0" step="0.01" onChange={e => setNewTournamentConfig(p => ({...p, entryFee: parseFloat(e.target.value)}))} />
              </div>
              <div className="form-group">
                <label htmlFor="currency">Currency:</label>
                <select id="currency" value={newTournamentConfig.currency} onChange={e => setNewTournamentConfig(p => ({...p, currency: e.target.value as CurrencyMode}))}>
                    <option value={CurrencyMode.SOL}>SOL</option>
                    <option value={CurrencyMode.RPSTOKEN}>RPS Token</option>
                </select>
              </div>
              <div className="modal-actions">
                <button onClick={handleCreateTournament} className="primary" disabled={isLoading}>Create</button>
                <button onClick={() => setShowCreateModal(false)} className="secondary" disabled={isLoading}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const canJoin = tournament.status === 'Registering' &&
                  !tournament.players.find(p => p.id === currentUserId) &&
                  tournament.players.length < tournament.maxPlayers;
  const canStart = tournament.status === 'Registering' &&
                   tournament.host?.id === currentUserId &&
                   tournament.players.length >= 2;


  return (
    <div className="game-tournament">
      <header className="tournament-header">
        <h2>{tournament.name}</h2>
        <div className="tournament-info">
          <span>Status: <strong className={`status-${tournament.status.toLowerCase()}`}>{tournament.status}</strong></span>
          <span>Players: {tournament.players.length} / {tournament.maxPlayers}</span>
          <span>Prize Pool: {tournament.prizePool.toFixed(2)} {tournament.currency}</span>
          <span>Host: {tournament.host?.name}</span>
        </div>
        {error && <p className="error-message tournament-error">{error}</p>}
      </header>

      {tournament.status === 'Registering' && (
        <div className="tournament-actions registration-actions">
          {canJoin && <button onClick={handleJoinTournament} disabled={isLoading} className="join-button primary">Join Tournament ({tournament.entryFee} {tournament.currency})</button>}
          {canStart && <button onClick={handleStartTournament} disabled={isLoading} className="start-button secondary">Start Tournament</button>}
          <p>Waiting for players... Share Tournament ID: <strong>{tournament.id}</strong></p>
        </div>
      )}
      
      {tournament.players.length > 0 && (
         <div className="tournament-player-list">
            <h4>Registered Players:</h4>
            <ul>
                {tournament.players.map(p => <li key={p.id} className={p.isCurrentUser ? 'current-user-player' : ''}>{p.name}</li>)}
            </ul>
         </div>
      )}

      {(tournament.status === 'InProgress' || tournament.status === 'Finished') && renderBrackets()}

      {tournament.status === 'Finished' && tournament.winner && (
        <div className="tournament-winner-announcement">
          <h3>Tournament Over!</h3>
          <p className="winner-name">🎉 Winner: {tournament.winner.name} 🎉</p>
          <p>Prize Won: {tournament.prizePool.toFixed(2)} {tournament.currency}</p>
          {/* Option to start a new tournament or go back */}
        </div>
      )}
      {isLoading && <div className="loading-indicator tournament-active-loading">Processing...</div>}
    </div>
  );
};

// Helper for logging (can be removed or replaced with a proper logger)
const log = {
    info: console.log,
    warn: console.warn,
    error: console.error,
    success: console.log,
};

export default GameTournament;

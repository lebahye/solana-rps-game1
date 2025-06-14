use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction,
    program::{invoke, invoke_signed},
    sysvar::{rent::Rent, Sysvar},
    clock::Clock,
    hash::{hashv, Hash},
    instruction::{AccountMeta, Instruction},
    program_pack::Pack,
};
use std::collections::HashMap;
use std::convert::TryInto;
use thiserror::Error;

// Import SPL Token program for RPS token support
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use sha2::{Digest, Sha512};
use hmac::{Hmac, Mac}; // NEW: proper HMAC support

// Define custom errors for better error handling
#[derive(Error, Debug, Copy, Clone)]
pub enum RPSError {
    #[error("Invalid player state")]
    InvalidPlayerState,
    
    #[error("Invalid game state")]
    InvalidGameState,
    
    #[error("Player not found")]
    PlayerNotFound,
    
    #[error("Game is full")]
    GameFull,
    
    #[error("Player already joined")]
    PlayerAlreadyJoined,
    
    #[error("Invalid choice")]
    InvalidChoice,
    
    #[error("Invalid hash")]
    InvalidHash,
    
    #[error("Timeout not reached")]
    TimeoutNotReached,
    
    #[error("Not a winner")]
    NotWinner,
    
    #[error("Invalid parameter")]
    InvalidParameter,
    
    #[error("Insufficient funds")]
    InsufficientFunds,
    
    #[error("Not authorized")]
    NotAuthorized,
    
    #[error("Fee calculation error")]
    FeeCalculationError,
    
    #[error("Token transfer error")]
    TokenTransferError,
}

// Map custom errors to ProgramError
impl From<RPSError> for ProgramError {
    fn from(e: RPSError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

// Helper to assert ownership of an account
#[inline(always)]
fn assert_owned_by(acc: &AccountInfo, owner: &Pubkey) -> ProgramResult {
    if acc.owner != owner {
        msg!("Account ownership mismatch");
        return Err(ProgramError::IllegalOwner);
    }
    Ok(())
}

// Helper to build PDA seed slice (without bump)
#[inline(always)]
fn rps_pda_seeds(game_key: &Pubkey) -> [&[u8]; 2] {
    [b"rps_game", game_key.as_ref()]
}

// Define the game state
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub enum Choice {
    None,
    Rock,
    Paper,
    Scissors,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub enum GameMode {
    Manual,
    Automated,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub enum CurrencyMode {
    SOL,
    RPSToken,
}

// Constants for fee calculation
const FEE_PERCENTAGE: u64 = 10; // 1% (10/1000)
const FEE_DENOMINATOR: u64 = 1000;
// Public key of the fee collector account (should be updated to actual account)
const FEE_COLLECTOR: &str = "FeeCoLLeCToRyouNEEDtoUPDATEthiswithREALaccount111";

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Player {
    pub pubkey: Pubkey,
    pub choice: Choice,
    pub committed_choice: [u8; 64], // Upgraded to SHA512 hash size
    pub salt: [u8; 32],             // Store salt separately for verification
    pub revealed: bool,
    pub score: u8,
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum GameState {
    WaitingForPlayers,
    CommitPhase,
    RevealPhase,
    Finished,
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Game {
    pub host: Pubkey,
    pub players: Vec<Player>,
    pub min_players: u8,
    pub max_players: u8,
    pub state: GameState,
    pub current_round: u8,
    pub total_rounds: u8,
    pub entry_fee: u64,
    pub game_pot: u64,
    pub required_timeout: u64,
    pub last_action_timestamp: u64,
    pub player_count: u8,        // Actual number of players (randomized between 3-4)
    pub losers_can_rejoin: bool, // Indicates if losers can rejoin for another game
    pub game_mode: GameMode,     // Manual or Automated
    pub auto_round_delay: u64,   // Time between automated rounds in seconds
    pub max_auto_rounds: u64,    // Maximum number of automated rounds
    pub current_auto_round: u64, // Current auto round counter
    pub currency_mode: CurrencyMode, // SOL or RPSToken
    pub fee_collected: u64,      // Track fees collected
    pub token_mint: Option<Pubkey>, // Token mint address (if using RPSToken)
}

// Define instruction types
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum RPSInstruction {
    // Initialize a new game
    InitializeGame {
        min_players: u8,
        max_players: u8,
        total_rounds: u8,
        entry_fee: u64,
        timeout_seconds: u64,
        losers_can_rejoin: bool,
        game_mode: u8,          // 0 = Manual, 1 = Automated
        currency_mode: u8,      // 0 = SOL, 1 = RPSToken
        auto_round_delay: u64,  // Only used if game_mode = Automated
        max_auto_rounds: u64,   // Only used if game_mode = Automated
        token_mint: Option<Pubkey>, // Token mint address (if using RPSToken)
    },

    // Join an existing game
    JoinGame,

    // Submit a hashed choice (commit phase)
    CommitChoice {
        committed_choice: [u8; 64], // Upgraded to SHA512 hash size
        salt: [u8; 32],             // Store salt for later verification
    },

    // Reveal your choice
    RevealChoice {
        choice: Choice,
    },

    // Force resolve the game if timeout occurred
    ResolveTimeout,

    // Claim winnings after game finishes
    ClaimWinnings,

    // Rejoin game as a loser (if enabled)
    RejoinGame,

    // Start a new game round with same players
    StartNewGameRound,

    // For auto-play, trigger the next round
    AutoPlayNextRound,

    // For auto-play, add bot players
    AddBotPlayers {
        count: u8,
    },
    
    // Collect fees from the game account
    CollectFees,

    /* ─────────────────────────────  NEW  ─────────────────────────────
     * TOURNAMENT INSTRUCTIONS (step-1 foundation)
     *  - CreateTournament : host creates a lobby, deposits prize-seed
     *  - JoinTournament   : player pays entry fee & registers
     *  Further instructions (Start / Advance / Finish) will be
     *  introduced in follow-up patches.
     * ──────────────────────────────────────────────────────────────── */

    /// Create a new tournament lobby.
    ///   accounts:
    ///   0. [signer]   host
    ///   1. [writable] tournament PDA (created & funded by host)
    ///   2. []         system program
    ///   3. [optional] fee-collector       (SOL mode)
    ///   4. [...]      token accounts…     (token mode, to come)
    CreateTournament {
        max_players: u8,
        entry_fee: u64,
        currency_mode: u8, // CurrencyMode discriminator
        token_mint: Option<Pubkey>,
    },

    /// Join an existing tournament.
    ///   accounts:
    ///   0. [signer]   player
    ///   1. [writable] tournament PDA
    ///   2. []         system program
    ///   3. [optional] fee-collector
    JoinTournament,
}

// Program entrypoint
entrypoint!(process_instruction);

// Process instruction logic
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = RPSInstruction::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    match instruction {
        RPSInstruction::InitializeGame {
            min_players,
            max_players,
            total_rounds,
            entry_fee,
            timeout_seconds,
            losers_can_rejoin,
            game_mode,
            currency_mode,
            auto_round_delay,
            max_auto_rounds,
            token_mint,
        } => {
            process_initialize_game(
                program_id,
                accounts,
                min_players,
                max_players,
                total_rounds,
                entry_fee,
                timeout_seconds,
                losers_can_rejoin,
                game_mode,
                currency_mode,
                auto_round_delay,
                max_auto_rounds,
                token_mint,
            )
        },
        RPSInstruction::JoinGame => {
            process_join_game(program_id, accounts)
        },
        RPSInstruction::CommitChoice { committed_choice, salt } => {
            process_commit_choice(program_id, accounts, committed_choice, salt)
        },
        RPSInstruction::RevealChoice { choice } => {
            process_reveal_choice(program_id, accounts, choice)
        },
        RPSInstruction::ResolveTimeout => {
            process_resolve_timeout(program_id, accounts)
        },
        RPSInstruction::ClaimWinnings => {
            process_claim_winnings(program_id, accounts)
        },
        RPSInstruction::RejoinGame => {
            process_rejoin_game(program_id, accounts)
        },
        RPSInstruction::StartNewGameRound => {
            process_start_new_game_round(program_id, accounts)
        },
        RPSInstruction::AutoPlayNextRound => {
            process_auto_play_next_round(program_id, accounts)
        },
        RPSInstruction::AddBotPlayers { count } => {
            process_add_bot_players(program_id, accounts, count)
        },
        RPSInstruction::CollectFees => {
            process_collect_fees(program_id, accounts)

        /* ─── Tournament foundation ──────────────────────────────── */
        }, RPSInstruction::CreateTournament {
            max_players,
            entry_fee,
            currency_mode,
            token_mint,
        } => {
            process_create_tournament(
                program_id,
                accounts,
                max_players,
                entry_fee,
                currency_mode,
                token_mint,
            )
        }, RPSInstruction::JoinTournament => {
            process_join_tournament(program_id, accounts)
        },
    }
}

/* ╔══════════════════════════════════════════════════════════════════╗
   ║                  TOURNAMENT STATE  (step-1)                      ║
   ╚══════════════════════════════════════════════════════════════════╝ */

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct TournamentState {
    pub host: Pubkey,
    pub max_players: u8,
    pub entry_fee: u64,
    pub currency_mode: CurrencyMode,
    pub players: Vec<Pubkey>,
    pub prize_pool: u64,
    pub is_started: bool,
    pub token_mint: Option<Pubkey>,
    // future fields: bracket tree, round tracker, etc.
}

impl TournamentState {
    pub fn get_max_size(max_players: u8) -> usize {
        32  // host
        + 1 // max_players
        + 8 // entry_fee
        + 1 // currency_mode
        + 4 + (max_players as usize * 32) // vec<Pubkey>
        + 8 // prize_pool
        + 1 // is_started
        + 1 + 32 // option<mint>
    }
}

/* ─────────────────────  PDA seed helper  ───────────────────────── */
#[inline(always)]
fn tourney_pda_seeds(tournament_key: &Pubkey) -> [&[u8]; 2] {
    [b\"rps_tournament\", tournament_key.as_ref()]
}

/* ─────────────────────  Create Tournament  ─────────────────────── */
fn process_create_tournament(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    max_players: u8,
    entry_fee: u64,
    currency_mode: u8,
    token_mint: Option<Pubkey>,
) -> ProgramResult {
    let ai = &mut accounts.iter();
    let host = next_account_info(ai)?;
    let tourney_account = next_account_info(ai)?;
    let system_program = next_account_info(ai)?;

    if !host.is_signer {
        return Err(RPSError::NotAuthorized.into());
    }
    if max_players < 2 || max_players > 32 {
        return Err(RPSError::InvalidParameter.into());
    }

    /* account creation */
    let rent = Rent::get()?;
    let space = TournamentState::get_max_size(max_players);
    let lamports = rent.minimum_balance(space);
    invoke(
        &system_instruction::create_account(
            host.key,
            tourney_account.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[host.clone(), tourney_account.clone(), system_program.clone()],
    )?;

    /* init state */
    let state = TournamentState {
        host: *host.key,
        max_players,
        entry_fee,
        currency_mode: match currency_mode {
            0 => CurrencyMode::SOL,
            1 => CurrencyMode::RPSToken,
            _ => return Err(RPSError::InvalidParameter.into()),
        },
        players: vec![],
        prize_pool: 0,
        is_started: false,
        token_mint,
    };
    state.serialize(&mut *tourney_account.data.borrow_mut())?;
    msg!(\"Tournament created: {}\", tourney_account.key);
    Ok(())
}

/* ─────────────────────  Join Tournament  ───────────────────────── */
fn process_join_tournament(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let ai = &mut accounts.iter();
    let player = next_account_info(ai)?;
    let tourney_account = next_account_info(ai)?;
    let system_program = next_account_info(ai)?;

    if !player.is_signer {
        return Err(RPSError::NotAuthorized.into());
    }

    let mut tourney = TournamentState::try_from_slice(&tourney_account.data.borrow())?;
    if tourney.is_started {
        msg!(\"Tournament already started\");
        return Err(RPSError::InvalidGameState.into());
    }
    if tourney.players.len() as u8 >= tourney.max_players {
        return Err(RPSError::GameFull.into());
    }
    if tourney.players.contains(player.key) {
        return Err(RPSError::PlayerAlreadyJoined.into());
    }

    /* fee payment (SOL only for step-1) */
    if tourney.entry_fee > 0 && matches!(tourney.currency_mode, CurrencyMode::SOL) {
        invoke(
            &system_instruction::transfer(
                player.key,
                tourney_account.key,
                tourney.entry_fee,
            ),
            &[player.clone(), tourney_account.clone(), system_program.clone()],
        )?;
        tourney.prize_pool = tourney.prize_pool.saturating_add(tourney.entry_fee);
    }

    tourney.players.push(*player.key);
    tourney.serialize(&mut *tourney_account.data.borrow_mut())?;
    msg!(\"{} joined tournament\", player.key);
    Ok(())
}


// Implementation for initializing a new game
fn process_initialize_game(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    min_players: u8,
    max_players: u8,
    total_rounds: u8,
    entry_fee: u64,
    timeout_seconds: u64,
    losers_can_rejoin: bool,
    game_mode: u8,
    currency_mode: u8,
    auto_round_delay: u64,
    max_auto_rounds: u64,
    token_mint: Option<Pubkey>,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let initializer = next_account_info(accounts_iter)?;
    let game_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    
    // Get fee collector account if provided
    let fee_collector_account = if accounts_iter.len() > 0 {
        Some(next_account_info(accounts_iter)?)
    } else {
        None
    };
    
    // Get token program and mint accounts if using RPSToken
    let (token_program, token_mint_account) = if currency_mode == 1 {
        if accounts_iter.len() < 2 {
            return Err(RPSError::InvalidParameter.into());
        }
        let token_program = next_account_info(accounts_iter)?;
        let token_mint_account = next_account_info(accounts_iter)?;
        (Some(token_program), Some(token_mint_account))
    } else {
        (None, None)
    };

    // Ensure the initializer signed the transaction
    if !initializer.is_signer {
        msg!("Initializer must sign the transaction");
        return Err(RPSError::NotAuthorized.into());
    }

    // Validate parameters - ensure only 3 or 4 players
    if min_players < 3 || max_players > 4 || min_players > max_players {
        msg!("Invalid player count. Must be between 3 and 4 players");
        return Err(RPSError::InvalidParameter.into());
    }

    if total_rounds == 0 {
        msg!("Total rounds must be greater than 0");
        return Err(RPSError::InvalidParameter.into());
    }

    // Parse game mode
    let game_mode = match game_mode {
        0 => GameMode::Manual,
        1 => GameMode::Automated,
        _ => {
            msg!("Invalid game mode. Must be 0 (Manual) or 1 (Automated)");
            return Err(RPSError::InvalidParameter.into());
        }
    };

    // Parse currency mode
    let currency_mode = match currency_mode {
        0 => CurrencyMode::SOL,
        1 => CurrencyMode::RPSToken,
        _ => {
            msg!("Invalid currency mode. Must be 0 (SOL) or 1 (RPSToken)");
            return Err(RPSError::InvalidParameter.into());
        }
    };
    
    // If using RPSToken, validate token mint
    let token_mint_pubkey = if matches!(currency_mode, CurrencyMode::RPSToken) {
        if token_mint.is_none() && token_mint_account.is_none() {
            msg!("Token mint must be provided for RPSToken games");
            return Err(RPSError::InvalidParameter.into());
        }
        
        // Use provided token mint or extract from account
        token_mint.or_else(|| Some(*token_mint_account.unwrap().key))
    } else {
        None
    };

    // Create game account
    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(Game::get_max_size(max_players));

    invoke(
        &system_instruction::create_account(
            initializer.key,
            game_account.key,
            rent_lamports,
            Game::get_max_size(max_players) as u64,
            program_id,
        ),
        &[initializer.clone(), game_account.clone(), system_program.clone()],
    )?;

    // Initialize host as first player
    let mut players = Vec::new();
    players.push(Player {
        pubkey: *initializer.key,
        choice: Choice::None,
        committed_choice: [0; 64], // Upgraded to SHA512 hash size
        salt: [0; 32],
        revealed: false,
        score: 0,
    });

    // Initialize game state
    let clock = Clock::get()?;

    // Randomly choose the actual player count (either 3 or 4)
    let player_count = if min_players == max_players {
        min_players
    } else {
        // Use the last bit of the timestamp as randomness
        // This is not cryptographically secure but sufficient for this purpose
        if (clock.unix_timestamp & 1) == 0 { 3 } else { 4 }
    };

    // Calculate fee for the entry
    let fee_amount = if entry_fee > 0 {
        calculate_fee(entry_fee)
    } else {
        0
    };
    
    // Adjust game pot to account for fee
    let initial_pot = if entry_fee > 0 {
        entry_fee - fee_amount
    } else {
        0
    };

    let game = Game {
        host: *initializer.key,
        players,
        min_players,
        max_players,
        state: GameState::WaitingForPlayers,
        current_round: 1,
        total_rounds,
        entry_fee,
        game_pot: initial_pot, // Host pays entry fee minus fee
        required_timeout: timeout_seconds,
        last_action_timestamp: clock.unix_timestamp as u64,
        player_count,
        losers_can_rejoin,
        game_mode,
        auto_round_delay,
        max_auto_rounds,
        current_auto_round: 0,
        currency_mode,
        fee_collected: fee_amount, // Track fee collected
        token_mint: token_mint_pubkey,
    };

    // Save game state to account
    game.serialize(&mut *game_account.data.borrow_mut())?;

    // Handle payment based on currency mode
    if entry_fee > 0 {
        match currency_mode {
            CurrencyMode::SOL => {
                // Transfer entry fee from initializer to game account
                invoke(
                    &system_instruction::transfer(
                        initializer.key,
                        game_account.key,
                        entry_fee,
                    ),
                    &[initializer.clone(), game_account.clone(), system_program.clone()],
                )?;
                
                // If fee collector is provided, transfer fee
                if let Some(fee_account) = fee_collector_account {
                    if fee_amount > 0 {
                        // Transfer fee from game account to fee collector
                        let game_key = game_account.key;
                        let seeds = rps_pda_seeds(game_key);
                        let (_pda, bump) = Pubkey::find_program_address(&seeds, program_id);
                        let signer_seeds: &[&[u8]] = &[seeds[0], seeds[1], &[bump]];
                        
                        invoke_signed(
                            &system_instruction::transfer(
                                game_account.key,
                                fee_account.key,
                                fee_amount,
                            ),
                            &[game_account.clone(), fee_account.clone(), system_program.clone()],
                            &[signer_seeds],
                        )?;
                    }
                }
            },
            CurrencyMode::RPSToken => {
                // For token transfers, we would need additional accounts and logic
                // This is a simplified version - in a real implementation, you would:
                // 1. Get the initializer's token account
                // 2. Get the game's token account (or create one)
                // 3. Transfer tokens from initializer to game account
                
                if token_program.is_none() || token_mint_account.is_none() {
                    msg!("Token program and mint accounts required for RPSToken games");
                    return Err(RPSError::InvalidParameter.into());
                }
                
                // Token transfer would be implemented here
                // This is a placeholder for the actual token transfer logic
                msg!("Token transfer for game creation would happen here");
                
                // Note: In a complete implementation, you would create a token account for the game
                // and transfer tokens from the initializer to this account
            }
        }
    }

    msg!("Game initialized with ID: {}", game_account.key);
    Ok(())
}

// Implementation for joining a game
fn process_join_game(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let player = next_account_info(accounts_iter)?;
    let game_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    
    // Get fee collector account if provided
    let fee_collector_account = if accounts_iter.len() > 0 {
        Some(next_account_info(accounts_iter)?)
    } else {
        None
    };
    
    // Get token accounts if needed
    let (token_program, player_token_account, game_token_account) = if accounts_iter.len() >= 3 {
        let token_program = next_account_info(accounts_iter)?;
        let player_token_account = next_account_info(accounts_iter)?;
        let game_token_account = next_account_info(accounts_iter)?;
        (Some(token_program), Some(player_token_account), Some(game_token_account))
    } else {
        (None, None, None)
    };

    // Ensure the player signed the transaction
    if !player.is_signer {
        msg!("Player must sign the transaction");
        return Err(RPSError::NotAuthorized.into());
    }

    // Load game state
    let mut game = Game::try_from_slice(&game_account.data.borrow())
        .map_err(|_| ProgramError::InvalidAccountData)?;

    // Check if game is in correct state
    if !matches!(game.state, GameState::WaitingForPlayers) {
        msg!("Game is not in waiting for players state");
        return Err(RPSError::InvalidGameState.into());
    }

    // Check if player already joined
    for existing_player in &game.players {
        if existing_player.pubkey == *player.key {
            msg!("Player has already joined the game");
            return Err(RPSError::PlayerAlreadyJoined.into());
        }
    }

    // Check if game is full based on the randomized player_count
    if game.players.len() >= game.player_count as usize {
        msg!("Game is full");
        return Err(RPSError::GameFull.into());
    }

    // Calculate fee for the entry
    let fee_amount = if game.entry_fee > 0 {
        calculate_fee(game.entry_fee)
    } else {
        0
    };
    
    // Adjust amount to add to game pot
    let pot_amount = if game.entry_fee > 0 {
        game.entry_fee - fee_amount
    } else {
        0
    };

    // Add player to the game
    game.players.push(Player {
        pubkey: *player.key,
        choice: Choice::None,
        committed_choice: [0; 64], // Upgraded to SHA512 hash size
        salt: [0; 32],
        revealed: false,
        score: 0,
    });

    // Update game pot and fee collected
    game.game_pot += pot_amount;
    game.fee_collected += fee_amount;

    // Update game state if required player count is reached
    if game.players.len() >= game.player_count as usize {
        game.state = GameState::CommitPhase;
        msg!("Required player count reached: {}", game.player_count);
    }

    // Update last action timestamp
    let clock = Clock::get()?;
    game.last_action_timestamp = clock.unix_timestamp as u64;

    // Save game state
    game.serialize(&mut *game_account.data.borrow_mut())?;

    // Handle payment based on currency mode
    if game.entry_fee > 0 {
        match game.currency_mode {
            CurrencyMode::SOL => {
                // Transfer entry fee from player to game account
                invoke(
                    &system_instruction::transfer(
                        player.key,
                        game_account.key,
                        game.entry_fee,
                    ),
                    &[player.clone(), game_account.clone(), system_program.clone()],
                )?;
                
                // If fee collector is provided, transfer fee
                if let Some(fee_account) = fee_collector_account {
                    if fee_amount > 0 {
                        // Transfer fee from game account to fee collector
                        let game_key = game_account.key;
                        let seeds = rps_pda_seeds(game_key);
                        let (_pda, bump) = Pubkey::find_program_address(&seeds, program_id);
                        let signer_seeds: &[&[u8]] = &[seeds[0], seeds[1], &[bump]];
                        
                        invoke_signed(
                            &system_instruction::transfer(
                                game_account.key,
                                fee_account.key,
                                fee_amount,
                            ),
                            &[game_account.clone(), fee_account.clone(), system_program.clone()],
                            &[signer_seeds],
                        )?;
                    }
                }
            },
            CurrencyMode::RPSToken => {
                // For token transfers, we would need additional accounts and logic
                // This is a simplified version - in a real implementation, you would:
                // 1. Verify the player's token account
                // 2. Verify the game's token account
                // 3. Transfer tokens from player to game account
                
                if token_program.is_none() || player_token_account.is_none() || game_token_account.is_none() {
                    msg!("Token program and token accounts required for RPSToken games");
                    return Err(RPSError::InvalidParameter.into());
                }
                
                // Token transfer would be implemented here
                // This is a placeholder for the actual token transfer logic
                msg!("Token transfer for joining game would happen here");
                
                // Note: In a complete implementation, you would transfer tokens from the player's token account
                // to the game's token account
            }
        }
    }

    msg!("Player joined game: {}", player.key);

    Ok(())
}

// Implementation for committing a choice (hash of choice + salt)
fn process_commit_choice(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    committed_choice: [u8; 64], // Upgraded to SHA512 hash size
    salt: [u8; 32],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let player = next_account_info(accounts_iter)?;
    let game_account = next_account_info(accounts_iter)?;

    // Ensure the player signed the transaction
    if !player.is_signer {
        msg!("Player must sign the transaction");
        return Err(RPSError::NotAuthorized.into());
    }

    // Load game state
    let mut game = Game::try_from_slice(&game_account.data.borrow())
        .map_err(|_| ProgramError::InvalidAccountData)?;

    // Check if game is in correct state
    if !matches!(game.state, GameState::CommitPhase) {
        msg!("Game is not in commit phase");
        return Err(RPSError::InvalidGameState.into());
    }

    // Find player and update their committed choice
    let mut player_found = false;
    for game_player in &mut game.players {
        if game_player.pubkey == *player.key {
            game_player.committed_choice = committed_choice;
            game_player.salt = salt; // Store salt for verification
            player_found = true;
            break;
        }
    }

    if !player_found {
        msg!("Player not found in game");
        return Err(RPSError::PlayerNotFound.into());
    }

    // Check if all players have committed and transition to reveal phase if so
    let all_committed = game.players.iter().all(|p| p.committed_choice != [0; 64]);

    if all_committed {
        game.state = GameState::RevealPhase;
        msg!("All players have committed their choices. Moving to reveal phase.");
    }

    // Update last action timestamp
    let clock = Clock::get()?;
    game.last_action_timestamp = clock.unix_timestamp as u64;

    // Save game state
    game.serialize(&mut *game_account.data.borrow_mut())?;

    msg!("Player committed choice: {}", player.key);

    Ok(())
}

// Implementation for revealing a choice
fn process_reveal_choice(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    choice: Choice,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let player = next_account_info(accounts_iter)?;
    let game_account = next_account_info(accounts_iter)?;

    // Ensure the player signed the transaction
    if !player.is_signer {
        msg!("Player must sign the transaction");
        return Err(RPSError::NotAuthorized.into());
    }

    // Load game state
    let mut game = Game::try_from_slice(&game_account.data.borrow())
        .map_err(|_| ProgramError::InvalidAccountData)?;

    // Check if game is in correct state
    if !matches!(game.state, GameState::RevealPhase) {
        msg!("Game is not in reveal phase");
        return Err(RPSError::InvalidGameState.into());
    }

    // Find player's index and verify the commit matches reveal
    let mut player_index = None;
    for (i, game_player) in game.players.iter().enumerate() {
        if game_player.pubkey == *player.key {
            player_index = Some(i);

            // Verify that the revealed choice matches the committed choice
            // Convert choice to a byte for hashing
            let choice_byte = match choice {
                Choice::Rock => 1u8,
                Choice::Paper => 2u8,
                Choice::Scissors => 3u8,
                Choice::None => {
                    msg!("Invalid choice: None");
                    return Err(RPSError::InvalidChoice.into());
                }
            };
            
            // Create input for HMAC-SHA512
            type HmacSha512 = Hmac<Sha512>;
            let mut mac = HmacSha512::new_from_slice(&game_player.salt)
                .map_err(|_| ProgramError::InvalidArgument)?;
            mac.update(&[choice_byte]);
            let result = mac.finalize().into_bytes(); // 64-byte array

            // Compare with committed hash
            if result[..] != game_player.committed_choice {
                msg!("Revealed choice does not match committed choice");
                return Err(RPSError::InvalidHash.into());
            }

            break;
        }
    }

    let player_index = player_index.ok_or_else(|| {
        msg!("Player not found in game");
        RPSError::PlayerNotFound
    })?;

    // Update player's choice and revealed status
    game.players[player_index].choice = choice;
    game.players[player_index].revealed = true;

    // Check if all players have revealed and process round if so
    let all_revealed = game.players.iter().all(|p| p.revealed);

    if all_revealed {
        // Calculate round winners
        process_round_results(&mut game);

        // Check if game should end
        if game.current_round >= game.total_rounds {
            game.state = GameState::Finished;
            msg!("Game finished after {} rounds", game.total_rounds);
        } else {
            // Reset for next round
            game.current_round += 1;
            game.state = GameState::CommitPhase;
            msg!("Starting round {} of {}", game.current_round, game.total_rounds);

            // Reset player choices for next round
            for player in &mut game.players {
                player.choice = Choice::None;
                player.committed_choice = [0; 64];
                player.salt = [0; 32];
                player.revealed = false;
            }
        }
    }

    // Update last action timestamp
    let clock = Clock::get()?;
    game.last_action_timestamp = clock.unix_timestamp as u64;

    // Save game state
    game.serialize(&mut *game_account.data.borrow_mut())?;

    msg!("Player revealed choice: {}", player.key);

    Ok(())
}

// Implementation for resolving timeouts
fn process_resolve_timeout(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let caller = next_account_info(accounts_iter)?;
    let game_account = next_account_info(accounts_iter)?;

    // Ensure the caller signed the transaction
    if !caller.is_signer {
        msg!("Caller must sign the transaction");
        return Err(RPSError::NotAuthorized.into());
    }

    // Load game state
    let mut game = Game::try_from_slice(&game_account.data.borrow())
        .map_err(|_| ProgramError::InvalidAccountData)?;

    // Check if timeout has occurred
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp as u64;
    let time_elapsed = current_time.saturating_sub(game.last_action_timestamp);

    if time_elapsed < game.required_timeout {
        msg!("Timeout period has not elapsed yet");
        return Err(RPSError::TimeoutNotReached.into());
    }

    // Process timeout based on current game state
    match game.state {
        GameState::WaitingForPlayers => {
            // If no players joined, just end the game
            if game.players.len() <= 1 {
                game.state = GameState::Finished;
                msg!("Game cancelled due to timeout while waiting for players");
            } else if game.players.len() >= game.min_players as usize {
                // If we have at least the minimum number of players, start the game
                game.state = GameState::CommitPhase;
                msg!("Starting game with {} players due to timeout", game.players.len());
            } else {
                // Not enough players, end the game
                game.state = GameState::Finished;
                msg!("Game cancelled due to timeout - not enough players joined");
            }
        },
        GameState::CommitPhase => {
            // Remove players who didn't commit and continue if enough remain
            let committed_players: Vec<Player> = game.players
                .iter()
                .filter(|p| p.committed_choice != [0; 64])
                .cloned()
                .collect();

            if committed_players.len() >= game.min_players as usize {
                game.players = committed_players;
                game.state = GameState::RevealPhase;
                msg!("Moving to reveal phase with {} committed players", game.players.len());
            } else {
                // Not enough players committed, end game
                game.state = GameState::Finished;
                msg!("Game ended due to timeout - not enough players committed");
            }
        },
        GameState::RevealPhase => {
            // Process round with revealed choices only
            // Players who didn't reveal get a default loss
            let mut all_revealed = true;
            
            for player in &mut game.players {
                if !player.revealed {
                    player.choice = Choice::None; // Default to None for non-revealed
                    player.revealed = true;
                    all_revealed = false;
                }
            }
            
            if !all_revealed {
                msg!("Some players did not reveal their choices - using default (None)");
            }

            // Calculate round winners
            process_round_results(&mut game);

            // Check if game should end
            if game.current_round >= game.total_rounds {
                game.state = GameState::Finished;
                msg!("Game finished after {} rounds", game.total_rounds);
            } else {
                // Reset for next round
                game.current_round += 1;
                game.state = GameState::CommitPhase;
                msg!("Starting round {} of {}", game.current_round, game.total_rounds);

                // Reset player choices for next round
                for player in &mut game.players {
                    player.choice = Choice::None;
                    player.committed_choice = [0; 64];
                    player.salt = [0; 32];
                    player.revealed = false;
                }
            }
        },
        GameState::Finished => {
            msg!("Game is already finished");
            return Err(RPSError::InvalidGameState.into());
        },
    }

    // Update last action timestamp
    game.last_action_timestamp = current_time;

    // Save game state
    game.serialize(&mut *game_account.data.borrow_mut())?;

    msg!("Timeout resolved");

    Ok(())
}

// Implementation for claiming winnings
fn process_claim_winnings(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let winner = next_account_info(accounts_iter)?;
    let game_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    
    // Get token accounts if needed
    let (token_program, winner_token_account, game_token_account) = if accounts_iter.len() >= 3 {
        let token_program = next_account_info(accounts_iter)?;
        let winner_token_account = next_account_info(accounts_iter)?;
        let game_token_account = next_account_info(accounts_iter)?;
        (Some(token_program), Some(winner_token_account), Some(game_token_account))
    } else {
        (None, None, None)
    };

    // Ensure the winner signed the transaction
    if !winner.is_signer {
        msg!("Winner must sign the transaction");
        return Err(RPSError::NotAuthorized.into());
    }

    // Load game state
    let mut game = Game::try_from_slice(&game_account.data.borrow())
        .map_err(|_| ProgramError::InvalidAccountData)?;

    // Check if game is finished
    if !matches!(game.state, GameState::Finished) {
        msg!("Game is not finished");
        return Err(RPSError::InvalidGameState.into());
    }

    // Find the winner(s) - those with highest score
    let mut max_score = 0;
    for player in &game.players {
        if player.score > max_score {
            max_score = player.score;
        }
    }

    let winners: Vec<&Player> = game.players
        .iter()
        .filter(|p| p.score == max_score)
        .collect();

    // Check if caller is among winners
    let caller_is_winner = winners.iter().any(|p| p.pubkey == *winner.key);

    if !caller_is_winner {
        msg!("Caller is not a winner");
        return Err(RPSError::NotWinner.into());
    }

    // Calculate winner's share - all winners take equal share of the pot
    let winner_share = game.game_pot / winners.len() as u64;
    
    if winner_share == 0 {
        msg!("No winnings to claim");
        return Err(RPSError::InsufficientFunds.into());
    }

    // Transfer winner's share based on currency mode
    match game.currency_mode {
        CurrencyMode::SOL => {
            // Transfer SOL from game account to winner
            let game_key = game_account.key;
            let seeds = rps_pda_seeds(game_key);
            let (_pda, bump) = Pubkey::find_program_address(&seeds, program_id);
            let signer_seeds: &[&[u8]] = &[seeds[0], seeds[1], &[bump]];
            
            invoke_signed(
                &system_instruction::transfer(
                    game_account.key,
                    winner.key,
                    winner_share,
                ),
                &[game_account.clone(), winner.clone(), system_program.clone()],
                &[signer_seeds],
            )?;
        },
        CurrencyMode::RPSToken => {
            // For token transfers, we need token program and accounts
            if token_program.is_none() || winner_token_account.is_none() || game_token_account.is_none() {
                msg!("Token program and accounts required for RPSToken winnings");
                return Err(RPSError::InvalidParameter.into());
            }
            
            // Token transfer would be implemented here
            // This is a placeholder for the actual token transfer logic
            msg!("Token transfer for winnings would happen here");
            
            // Note: In a complete implementation, you would transfer tokens from the game's token account
            // to the winner's token account
        }
    }

    // Update game pot
    game.game_pot -= winner_share;

    // Mark player as paid
    for player in &mut game.players {
        if player.pubkey == *winner.key {
            player.score = 0; // Set to 0 to prevent double claiming
            break;
        }
    }

    // Save game state
    game.serialize(&mut *game_account.data.borrow_mut())?;

    msg!("Winnings claimed by: {}", winner.key);

    Ok(())
}

// Implementation for rejoining a game as a loser
fn process_rejoin_game(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let player = next_account_info(accounts_iter)?;
    let game_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    
    // Get fee collector account if provided
    let fee_collector_account = if accounts_iter.len() > 0 {
        Some(next_account_info(accounts_iter)?)
    } else {
        None
    };
    
    // Get token accounts if needed
    let (token_program, player_token_account, game_token_account) = if accounts_iter.len() >= 3 {
        let token_program = next_account_info(accounts_iter)?;
        let player_token_account = next_account_info(accounts_iter)?;
        let game_token_account = next_account_info(accounts_iter)?;
        (Some(token_program), Some(player_token_account), Some(game_token_account))
    } else {
        (None, None, None)
    };

    // Ensure the player signed the transaction
    if !player.is_signer {
        msg!("Player must sign the transaction");
        return Err(RPSError::NotAuthorized.into());
    }

    // Load game state
    let mut game = Game::try_from_slice(&game_account.data.borrow())
        .map_err(|_| ProgramError::InvalidAccountData)?;

    // Check if game is in correct state and losers can rejoin
    if !matches!(game.state, GameState::Finished) || !game.losers_can_rejoin {
        msg!("Game is not finished or losers cannot rejoin");
        return Err(RPSError::InvalidGameState.into());
    }

    // Check if player was a loser in the previous game
    let mut was_player = false;
    let mut was_loser = false;
    let max_score = game.players.iter().map(|p| p.score).max().unwrap_or(0);

    for player_data in &game.players {
        if player_data.pubkey == *player.key {
            was_player = true;
            if player_data.score < max_score {
                was_loser = true;
            }
            break;
        }
    }

    if !was_player || !was_loser {
        msg!("Player was not in the game or was not a loser");
        return Err(RPSError::InvalidPlayerState.into());
    }

    // Calculate fee for the entry
    let fee_amount = if game.entry_fee > 0 {
        calculate_fee(game.entry_fee)
    } else {
        0
    };
    
    // Adjust amount to add to game pot
    let pot_amount = if game.entry_fee > 0 {
        game.entry_fee - fee_amount
    } else {
        0
    };

    // Handle payment based on currency mode
    if game.entry_fee > 0 {
        match game.currency_mode {
            CurrencyMode::SOL => {
                // Transfer entry fee from player to game account
                invoke(
                    &system_instruction::transfer(
                        player.key,
                        game_account.key,
                        game.entry_fee,
                    ),
                    &[player.clone(), game_account.clone(), system_program.clone()],
                )?;
                
                // If fee collector is provided, transfer fee
                if let Some(fee_account) = fee_collector_account {
                    if fee_amount > 0 {
                        // Transfer fee from game account to fee collector
                        let game_key = game_account.key;
                        let seeds = &[b"rps_game", game_key.as_ref(), &[1]];
                        let (pda, bump) = Pubkey::find_program_address(seeds, program_id);
                        let signer_seeds = &[b"rps_game", game_key.as_ref(), &[bump][..]];
                        
                        invoke_signed(
                            &system_instruction::transfer(
                                game_account.key,
                                fee_account.key,
                                fee_amount,
                            ),
                            &[game_account.clone(), fee_account.clone(), system_program.clone()],
                            &[signer_seeds],
                        )?;
                    }
                }
                
                // Update game pot and fee collected
                game.game_pot += pot_amount;
                game.fee_collected += fee_amount;
            },
            CurrencyMode::RPSToken => {
                // For token transfers, we need token program and accounts
                if token_program.is_none() || player_token_account.is_none() || game_token_account.is_none() {
                    msg!("Token program and accounts required for RPSToken games");
                    return Err(RPSError::InvalidParameter.into());
                }
                
                // Token transfer would be implemented here
                // This is a placeholder for the actual token transfer logic
                msg!("Token transfer for rejoining game would happen here");
                
                // Update game pot and fee collected
                game.game_pot += pot_amount;
                game.fee_collected += fee_amount;
            }
        }
    }

    // Reset this player's stats for the next game
    for player_data in &mut game.players {
        if player_data.pubkey == *player.key {
            player_data.choice = Choice::None;
            player_data.committed_choice = [0; 64];
            player_data.salt = [0; 32];
            player_data.revealed = false;
            break;
        }
    }

    // Update last action timestamp
    let clock = Clock::get()?;
    game.last_action_timestamp = clock.unix_timestamp as u64;

    // Save game state
    game.serialize(&mut *game_account.data.borrow_mut())?;

    msg!("Player rejoined game: {}", player.key);

    Ok(())
}

// Implementation for starting a new game round with the same players
fn process_start_new_game_round(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let initiator = next_account_info(accounts_iter)?;
    let game_account = next_account_info(accounts_iter)?;

    // Ensure the initiator signed the transaction
    if !initiator.is_signer {
        msg!("Initiator must sign the transaction");
        return Err(RPSError::NotAuthorized.into());
    }

    // Load game state
    let mut game = Game::try_from_slice(&game_account.data.borrow())
        .map_err(|_| ProgramError::InvalidAccountData)?;

    // Check if game is in finished state
    if !matches!(game.state, GameState::Finished) {
        msg!("Game is not finished");
        return Err(RPSError::InvalidGameState.into());
    }

    // Check if initiator is host or a player
    let is_participant = game.host == *initiator.key ||
        game.players.iter().any(|p| p.pubkey == *initiator.key);

    if !is_participant {
        msg!("Initiator is not a participant in the game");
        return Err(RPSError::NotAuthorized.into());
    }

    // Reset game state for a new round
    game.current_round = 1;
    game.state = GameState::CommitPhase;

    // Potentially randomize player count again for the new game
    let clock = Clock::get()?;
    if game.min_players != game.max_players {
        game.player_count = if (clock.unix_timestamp & 1) == 0 { 3 } else { 4 };
    }

    // Reset all players
    for player in &mut game.players {
        player.choice = Choice::None;
        player.committed_choice = [0; 64];
        player.salt = [0; 32];
        player.revealed = false;
        player.score = 0;
    }

    // Update last action timestamp
    game.last_action_timestamp = clock.unix_timestamp as u64;

    // Save game state
    game.serialize(&mut *game_account.data.borrow_mut())?;

    msg!("New game round started");

    Ok(())
}

// Implementation for auto-playing the next round
fn process_auto_play_next_round(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let initiator = next_account_info(accounts_iter)?;
    let game_account = next_account_info(accounts_iter)?;

    // Ensure the initiator signed the transaction
    if !initiator.is_signer {
        msg!("Initiator must sign the transaction");
        return Err(RPSError::NotAuthorized.into());
    }

    // Load game state
    let mut game = Game::try_from_slice(&game_account.data.borrow())
        .map_err(|_| ProgramError::InvalidAccountData)?;

    // Check if game is in automated mode
    if !matches!(game.game_mode, GameMode::Automated) {
        msg!("Game is not in automated mode");
        return Err(RPSError::InvalidGameState.into());
    }

    // Check if game is in finished state
    if !matches!(game.state, GameState::Finished) {
        msg!("Game is not finished");
        return Err(RPSError::InvalidGameState.into());
    }

    // Check if we've reached the maximum number of auto rounds
    if game.current_auto_round >= game.max_auto_rounds {
        msg!("Maximum number of auto rounds reached");
        return Err(RPSError::InvalidGameState.into());
    }

    // Check if initiator is host or a player
    let is_participant = game.host == *initiator.key ||
        game.players.iter().any(|p| p.pubkey == *initiator.key);

    if !is_participant {
        msg!("Initiator is not a participant in the game");
        return Err(RPSError::NotAuthorized.into());
    }

    // Reset game state for a new round
    game.current_round = 1;
    game.state = GameState::CommitPhase;
    game.current_auto_round += 1;

    // Potentially randomize player count again for the new game
    let clock = Clock::get()?;
    if game.min_players != game.max_players {
        game.player_count = if (clock.unix_timestamp & 1) == 0 { 3 } else { 4 };
    }

    // Reset all players
    for player in &mut game.players {
        player.choice = Choice::None;
        player.committed_choice = [0; 64];
        player.salt = [0; 32];
        player.revealed = false;
        player.score = 0;
    }

    // Update last action timestamp
    game.last_action_timestamp = clock.unix_timestamp as u64;

    // Save game state
    game.serialize(&mut *game_account.data.borrow_mut())?;

    msg!("New automated game round started");

    Ok(())
}

// Implementation for adding bot players
fn process_add_bot_players(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    count: u8,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let initiator = next_account_info(accounts_iter)?;
    let game_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    // Ensure the initiator signed the transaction
    if !initiator.is_signer {
        msg!("Initiator must sign the transaction");
        return Err(RPSError::NotAuthorized.into());
    }

    // Load game state
    let mut game = Game::try_from_slice(&game_account.data.borrow())
        .map_err(|_| ProgramError::InvalidAccountData)?;

    // Check if game is in correct state
    if !matches!(game.state, GameState::WaitingForPlayers) {
        msg!("Game is not in waiting for players state");
        return Err(RPSError::InvalidGameState.into());
    }

    // Check if there's room for bot players
    let available_slots = game.player_count as usize - game.players.len();
    let bot_count = std::cmp::min(count as usize, available_slots);

    if bot_count == 0 {
        msg!("No room for bot players");
        return Err(RPSError::GameFull.into());
    }

    // Add bot players
    for i in 0..bot_count {
        // Create a deterministic bot pubkey based on game account and index
        let seed = format!("bot_{}_{}_{}", game_account.key, game.players.len(), i);
        let hash = hashv(&[seed.as_bytes()]).to_bytes();
        let mut bot_pubkey_bytes = [0u8; 32];
        bot_pubkey_bytes.copy_from_slice(&hash[0..32]);
        let bot_pubkey = Pubkey::new_from_array(bot_pubkey_bytes);

        game.players.push(Player {
            pubkey: bot_pubkey,
            choice: Choice::None,
            committed_choice: [0; 64],
            salt: [0; 32],
            revealed: false,
            score: 0,
        });

        // Update game pot for bot players - simulate them paying entry fee
        // Calculate fee for the entry
        let fee_amount = if game.entry_fee > 0 {
            calculate_fee(game.entry_fee)
        } else {
            0
        };
        
        // Adjust amount to add to game pot
        let pot_amount = if game.entry_fee > 0 {
            game.entry_fee - fee_amount
        } else {
            0
        };
        
        game.game_pot += pot_amount;
        game.fee_collected += fee_amount;

        msg!("Added bot player: {}", bot_pubkey);
    }

    // Update game state if required player count is reached
    if game.players.len() >= game.player_count as usize {
        game.state = GameState::CommitPhase;
        msg!("Required player count reached: {}", game.player_count);
    }

    // Update last action timestamp
    let clock = Clock::get()?;
    game.last_action_timestamp = clock.unix_timestamp as u64;

    // Save game state
    game.serialize(&mut *game_account.data.borrow_mut())?;

    msg!("Added {} bot players", bot_count);

    Ok(())
}

// Implementation for collecting fees
fn process_collect_fees(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let fee_collector = next_account_info(accounts_iter)?;
    let game_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    
    // Get token accounts if needed
    let (token_program, fee_token_account, game_token_account) = if accounts_iter.len() >= 3 {
        let token_program = next_account_info(accounts_iter)?;
        let fee_token_account = next_account_info(accounts_iter)?;
        let game_token_account = next_account_info(accounts_iter)?;
        (Some(token_program), Some(fee_token_account), Some(game_token_account))
    } else {
        (None, None, None)
    };

    // Ensure the fee collector signed the transaction
    if !fee_collector.is_signer {
        msg!("Fee collector must sign the transaction");
        return Err(RPSError::NotAuthorized.into());
    }

    // Load game state
    let mut game = Game::try_from_slice(&game_account.data.borrow())
        .map_err(|_| ProgramError::InvalidAccountData)?;

    // Check if there are fees to collect
    if game.fee_collected == 0 {
        msg!("No fees to collect");
        return Err(RPSError::InsufficientFunds.into());
    }

    // Only allow fee collection from finished games or by authorized collectors
    if !matches!(game.state, GameState::Finished) && *fee_collector.key != Pubkey::new_from_array(FEE_COLLECTOR.as_bytes()) {
        msg!("Game is not finished and caller is not authorized fee collector");
        return Err(RPSError::NotAuthorized.into());
    }

    // Transfer fees based on currency mode
    let fee_amount = game.fee_collected;
    match game.currency_mode {
        CurrencyMode::SOL => {
            // Transfer SOL from game account to fee collector
            let game_key = game_account.key;
            let seeds = rps_pda_seeds(game_key);
            let (_pda, bump) = Pubkey::find_program_address(&seeds, program_id);
            let signer_seeds: &[&[u8]] = &[seeds[0], seeds[1], &[bump]];
            
            invoke_signed(
                &system_instruction::transfer(
                    game_account.key,
                    fee_collector.key,
                    fee_amount,
                ),
                &[game_account.clone(), fee_collector.clone(), system_program.clone()],
                &[signer_seeds],
            )?;
        },
        CurrencyMode::RPSToken => {
            // For token transfers, we need token program and accounts
            if token_program.is_none() || fee_token_account.is_none() || game_token_account.is_none() {
                msg!("Token program and accounts required for RPSToken fee collection");
                return Err(RPSError::InvalidParameter.into());
            }
            
            // Token transfer would be implemented here
            // This is a placeholder for the actual token transfer logic
            msg!("Token transfer for fee collection would happen here");
        }
    }

    // Reset fee collected
    game.fee_collected = 0;

    // Save game state
    game.serialize(&mut *game_account.data.borrow_mut())?;

    msg!("Collected {} fees", fee_amount);

    Ok(())
}

// Helper function to process round results
fn process_round_results(game: &mut Game) {
    let player_count = game.players.len();

    // For each player, compare against every other player
    for i in 0..player_count {
        for j in (i+1)..player_count {
            let choice_i = &game.players[i].choice;
            let choice_j = &game.players[j].choice;

            match (choice_i, choice_j) {
                (Choice::Rock, Choice::Scissors) |
                (Choice::Paper, Choice::Rock) |
                (Choice::Scissors, Choice::Paper) => {
                    // Player i wins against player j
                    game.players[i].score += 1;
                },
                (Choice::Scissors, Choice::Rock) |
                (Choice::Rock, Choice::Paper) |
                (Choice::Paper, Choice::Scissors) => {
                    // Player j wins against player i
                    game.players[j].score += 1;
                },
                _ => {
                    // Tie or invalid choices - no points awarded
                }
            }
        }
    }
    
    // Log scores for debugging
    for (i, player) in game.players.iter().enumerate() {
        msg!("Player {} score: {}", i, player.score);
    }
}

// Helper function to calculate fee
fn calculate_fee(amount: u64) -> u64 {
    // Calculate fee as FEE_PERCENTAGE / FEE_DENOMINATOR of the amount
    // For example, 10/1000 = 1%
    amount.saturating_mul(FEE_PERCENTAGE).saturating_div(FEE_DENOMINATOR)
}

// Helper methods for Game struct
impl Game {
    pub fn get_max_size(max_players: u8) -> usize {
        // Calculate max size needed for serialized Game struct with max_players
        // This is a rough estimate - actual implementation would need precise calculation
        8 + // host pubkey
        4 + (max_players as usize * (32 + 1 + 64 + 32 + 1 + 1)) + // Vector of Player structs with SHA512 hashes
        1 + // min_players
        1 + // max_players
        1 + // game state
        1 + // current_round
        1 + // total_rounds
        8 + // entry_fee
        8 + // game_pot
        8 + // required_timeout
        8 + // last_action_timestamp
        1 + // player_count
        1 + // losers_can_rejoin
        1 + // game_mode
        8 + // auto_round_delay
        8 + // max_auto_rounds
        8 + // current_auto_round
        1 + // currency_mode
        8 + // fee_collected
        1 + 32 // Optional token mint (1 for option tag, 32 for pubkey)
    }
}

interface AudioSettings {
  effectsVolume: number;
  musicVolume: number;
  isGlobalMuted: boolean;
  // Specific mutes can be derived or stored if needed,
  // but global mute is often primary. Let's add them for full control.
  isEffectsMuted: boolean;
  isMusicMuted: boolean;
  currentBackgroundMusic: string | null;
}

export enum SoundEffect {
  // UI Sounds
  ButtonClick = 'button_click',
  Navigation = 'navigation',
  ModalOpen = 'modal_open',
  ModalClose = 'modal_close',
  Error = 'error',
  Success = 'success',
  Notification = 'notification',

  // Game Flow Sounds
  GameCreate = 'game_create',
  GameJoin = 'game_join',
  GameStart = 'game_start',
  GameEnd = 'game_end',
  GameCancel = 'game_cancel',
  WaitingForPlayer = 'waiting_player',

  // RPS Specific Actions
  ChoiceCommit = 'choice_commit',
  ChoiceReveal = 'choice_reveal',
  PlayerRock = 'player_rock',
  PlayerPaper = 'player_paper',
  PlayerScissors = 'player_scissors',

  // Round/Game Outcomes
  RoundWin = 'round_win',
  RoundLose = 'round_lose',
  RoundTie = 'round_tie',
  GameWin = 'game_win', // Overall game win
  GameLose = 'game_lose', // Overall game lose
  Jackpot = 'jackpot', // For big wins

  // Timer/Turn Sounds
  TimerTick = 'timer_tick',
  YourTurn = 'your_turn',

  // Tournament Sounds
  TournamentStart = 'tournament_start',
  TournamentEnd = 'tournament_end',
  TournamentBracketUpdate = 'tournament_bracket_update',
  MatchWin = 'match_win', // Tournament match win
  MatchLose = 'match_lose', // Tournament match lose

  // Token/Currency Sounds
  BetPlaced = 'bet_placed',
  WinningsClaimed = 'winnings_claimed',
  TokenReceived = 'token_received',
}

export enum BackgroundMusic {
  MainMenu = 'main_menu_bgm',
  InGame = 'in_game_bgm',
  TournamentLobby = 'tournament_lobby_bgm',
  IntenseMoment = 'intense_moment_bgm',
}

const SOUND_EFFECT_FILES: Record<SoundEffect, string> = {
  // UI
  [SoundEffect.ButtonClick]: '/sounds/effects/ui_click_01.wav',
  [SoundEffect.Navigation]: '/sounds/effects/ui_navigate_01.wav',
  [SoundEffect.ModalOpen]: '/sounds/effects/ui_modal_open_01.wav',
  [SoundEffect.ModalClose]: '/sounds/effects/ui_modal_close_01.wav',
  [SoundEffect.Error]: '/sounds/effects/ui_error_01.wav',
  [SoundEffect.Success]: '/sounds/effects/ui_success_01.wav',
  [SoundEffect.Notification]: '/sounds/effects/ui_notification_01.wav',
  // Game Flow
  [SoundEffect.GameCreate]: '/sounds/effects/game_create_01.wav',
  [SoundEffect.GameJoin]: '/sounds/effects/game_join_01.wav',
  [SoundEffect.GameStart]: '/sounds/effects/game_start_01.wav',
  [SoundEffect.GameEnd]: '/sounds/effects/game_end_01.wav',
  [SoundEffect.GameCancel]: '/sounds/effects/game_cancel_01.wav',
  [SoundEffect.WaitingForPlayer]: '/sounds/effects/waiting_player_01.wav',
  // RPS Actions
  [SoundEffect.ChoiceCommit]: '/sounds/effects/rps_commit_01.wav',
  [SoundEffect.ChoiceReveal]: '/sounds/effects/rps_reveal_01.wav',
  [SoundEffect.PlayerRock]: '/sounds/effects/rps_rock_01.wav',
  [SoundEffect.PlayerPaper]: '/sounds/effects/rps_paper_01.wav',
  [SoundEffect.PlayerScissors]: '/sounds/effects/rps_scissors_01.wav',
  // Outcomes
  [SoundEffect.RoundWin]: '/sounds/effects/outcome_round_win_01.wav',
  [SoundEffect.RoundLose]: '/sounds/effects/outcome_round_lose_01.wav',
  [SoundEffect.RoundTie]: '/sounds/effects/outcome_tie_01.wav',
  [SoundEffect.GameWin]: '/sounds/effects/outcome_game_win_01.wav',
  [SoundEffect.GameLose]: '/sounds/effects/outcome_game_lose_01.wav',
  [SoundEffect.Jackpot]: '/sounds/effects/outcome_jackpot_01.wav',
  // Timer/Turn
  [SoundEffect.TimerTick]: '/sounds/effects/timer_tick_01.wav',
  [SoundEffect.YourTurn]: '/sounds/effects/your_turn_01.wav',
  // Tournament
  [SoundEffect.TournamentStart]: '/sounds/effects/tournament_start_01.wav',
  [SoundEffect.TournamentEnd]: '/sounds/effects/tournament_end_01.wav',
  [SoundEffect.TournamentBracketUpdate]: '/sounds/effects/tournament_bracket_update_01.wav',
  [SoundEffect.MatchWin]: '/sounds/effects/tournament_match_win_01.wav',
  [SoundEffect.MatchLose]: '/sounds/effects/tournament_match_lose_01.wav',
  // Currency
  [SoundEffect.BetPlaced]: '/sounds/effects/currency_bet_placed_01.wav',
  [SoundEffect.WinningsClaimed]: '/sounds/effects/currency_winnings_claimed_01.wav',
  [SoundEffect.TokenReceived]: '/sounds/effects/currency_token_received_01.wav',
};

const BACKGROUND_MUSIC_FILES: Record<BackgroundMusic, string> = {
  [BackgroundMusic.MainMenu]: '/sounds/music/bgm_main_menu_loop.mp3',
  [BackgroundMusic.InGame]: '/sounds/music/bgm_ingame_loop.mp3',
  [BackgroundMusic.TournamentLobby]: '/sounds/music/bgm_tournament_lobby_loop.mp3',
  [BackgroundMusic.IntenseMoment]: '/sounds/music/bgm_intense_moment.mp3',
};

const LOCAL_STORAGE_KEY = 'rpsGameAudioSettings';

class AudioService {
  private isSupported: boolean = false;
  private settings: AudioSettings;

  private soundEffectCache: Map<SoundEffect, HTMLAudioElement[]> = new Map();
  private preloadedSoundSources: Map<SoundEffect, string> = new Map();
  private bgMusicElement: HTMLAudioElement | null = null;
  private maxConcurrentEffects = 5; // Max identical sounds at once

  constructor() {
    this.settings = this.loadPreferences();
    this.checkAudioSupport();

    if (this.isSupported) {
      this.applyAllSettings();
      this.preloadCommonSounds(); // Preload some essential sounds
      if (this.settings.currentBackgroundMusic) {
        // Attempt to resume last played BGM, might be blocked by autoplay policies
        // this.playBackgroundMusic(this.settings.currentBackgroundMusic as BackgroundMusic, true, true);
      }
    } else {
      console.warn('AudioService: HTMLAudioElement is not supported or disabled by browser.');
    }
  }

  private checkAudioSupport(): void {
    try {
      const testAudio = new Audio();
      this.isSupported = typeof testAudio.play === 'function';
    } catch (e) {
      this.isSupported = false;
    }
  }

  private loadPreferences(): AudioSettings {
    const defaults: AudioSettings = {
      effectsVolume: 0.7,
      musicVolume: 0.4,
      isGlobalMuted: false,
      isEffectsMuted: false,
      isMusicMuted: false,
      currentBackgroundMusic: null,
    };
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedSettings = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedSettings) {
        try {
          return { ...defaults, ...JSON.parse(storedSettings) };
        } catch (e) {
          console.error('AudioService: Failed to parse stored audio settings.', e);
          return defaults;
        }
      }
    }
    return defaults;
  }

  private savePreferences(): void {
    if (!this.isSupported || typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.error('AudioService: Failed to save audio settings.', e);
    }
  }

  private applyAllSettings(): void {
    if (!this.isSupported) return;
    this.setEffectsVolume(this.settings.effectsVolume, false);
    this.setMusicVolume(this.settings.musicVolume, false);
    // Mute states will be checked during play calls
  }

  public async preloadSound(sound: SoundEffect): Promise<void> {
    if (!this.isSupported || this.preloadedSoundSources.has(sound)) return;

    const path = SOUND_EFFECT_FILES[sound];
    if (!path) {
      console.warn(`AudioService: Sound path not found for ${sound}`);
      return;
    }

    try {
      // For HTMLAudioElement, "preloading" means creating an instance and letting the browser fetch it.
      // We don't store the element itself for effects, just ensure it's fetched.
      // A common way is to have a dummy audio element load it.
      const audio = new Audio(path);
      audio.preload = 'auto'; // Hint to browser
      await audio.load(); // Start loading
      this.preloadedSoundSources.set(sound, path);
      // console.log(`AudioService: Preloaded ${sound} from ${path}`);
    } catch (error) {
      console.error(`AudioService: Error preloading sound ${sound}:`, error);
    }
  }

  public async preloadAllSoundEffects(): Promise<void[]> {
    if (!this.isSupported) return Promise.resolve([]);
    const preloadPromises: Promise<void>[] = [];
    for (const soundKey in SoundEffect) {
      // eslint-disable-next-line no-prototype-builtins
      if (SOUND_EFFECT_FILES.hasOwnProperty(soundKey as SoundEffect)) {
        preloadPromises.push(this.preloadSound(soundKey as SoundEffect));
      }
    }
    return Promise.all(preloadPromises);
  }

  private async preloadCommonSounds(): Promise<void> {
    await this.preloadSound(SoundEffect.ButtonClick);
    await this.preloadSound(SoundEffect.RoundWin);
    await this.preloadSound(SoundEffect.RoundLose);
  }

  public playSoundEffect(sound: SoundEffect, volumeMultiplier: number = 1): void {
    if (!this.isSupported || this.settings.isGlobalMuted || this.settings.isEffectsMuted) {
      return;
    }

    const path = this.preloadedSoundSources.get(sound) || SOUND_EFFECT_FILES[sound];
    if (!path) {
      console.warn(`AudioService: Sound effect '${sound}' not found or not preloaded.`);
      this.preloadSound(sound); // Attempt to preload if not found
      return;
    }

    try {
      // Manage a small pool for each sound to limit concurrent plays of the *same* sound
      let pool = this.soundEffectCache.get(sound);
      if (!pool) {
        pool = [];
        this.soundEffectCache.set(sound, pool);
      }

      // Remove ended sounds from pool
      pool = pool.filter(audio => !audio.ended && !audio.paused); // Keep playing ones or ones that never started
      this.soundEffectCache.set(sound, pool);

      if (pool.length >= this.maxConcurrentEffects) {
        // console.warn(`AudioService: Max concurrent plays for ${sound} reached.`);
        // Optionally, stop the oldest sound and play new one
        const oldestSound = pool.shift();
        if (oldestSound) {
            oldestSound.pause();
            oldestSound.currentTime = 0;
        }
      }
      
      const audio = new Audio(path);
      audio.volume = Math.max(0, Math.min(1, this.settings.effectsVolume * volumeMultiplier));
      
      audio.play().catch(e => console.error(`AudioService: Error playing sound effect '${sound}':`, e));
      pool.push(audio);

    } catch (error) {
      console.error(`AudioService: Failed to play sound effect '${sound}':`, error);
    }
  }

  public playBackgroundMusic(
    music: BackgroundMusic,
    loop: boolean = true,
    resume: boolean = false // if true, try to resume from last position
  ): void {
    if (!this.isSupported) return;

    const path = BACKGROUND_MUSIC_FILES[music];
    if (!path) {
      console.warn(`AudioService: Background music '${music}' not found.`);
      return;
    }

    if (this.bgMusicElement && this.settings.currentBackgroundMusic === path && this.bgMusicElement.paused && resume) {
      // Trying to resume the same track
    } else if (this.bgMusicElement && this.settings.currentBackgroundMusic === path && !this.bgMusicElement.paused) {
      // Already playing this music
      return;
    } else {
      // New music or different music
      if (this.bgMusicElement) {
        this.bgMusicElement.pause();
        this.bgMusicElement.src = ''; // Release old source
        this.bgMusicElement.load(); // Important to release resources
        this.bgMusicElement = null;
      }
      this.bgMusicElement = new Audio(path);
    }
    
    this.bgMusicElement.loop = loop;
    this.bgMusicElement.volume = this.settings.musicVolume;
    this.settings.currentBackgroundMusic = path; // Store path not enum key
    this.savePreferences();

    if (this.settings.isGlobalMuted || this.settings.isMusicMuted) {
      this.bgMusicElement.pause(); // Ensure it's paused if muted
    } else {
      this.bgMusicElement.play().catch(e => {
        console.error(`AudioService: Error playing background music '${music}':`, e);
        // Autoplay might be blocked by browser, user interaction might be needed
      });
    }
  }

  public pauseBackgroundMusic(): void {
    if (!this.isSupported || !this.bgMusicElement) return;
    this.bgMusicElement.pause();
  }

  public resumeBackgroundMusic(): void {
    if (!this.isSupported || !this.bgMusicElement || this.settings.isGlobalMuted || this.settings.isMusicMuted) return;
    if (this.bgMusicElement.paused) {
        this.bgMusicElement.play().catch(e => console.error('AudioService: Error resuming BGM:', e));
    }
  }

  public stopBackgroundMusic(): void {
    if (!this.isSupported || !this.bgMusicElement) return;
    this.bgMusicElement.pause();
    this.bgMusicElement.currentTime = 0;
    this.settings.currentBackgroundMusic = null;
    this.savePreferences();
  }

  public setEffectsVolume(volume: number, save: boolean = true): void {
    if (!this.isSupported) return;
    this.settings.effectsVolume = Math.max(0, Math.min(1, volume));
    // Note: Currently playing effects won't have their volume changed dynamically by this.
    // New effects will use this volume. For dynamic change, iterate through active effect elements.
    if (save) this.savePreferences();
  }

  public getEffectsVolume(): number {
    return this.settings.effectsVolume;
  }

  public setMusicVolume(volume: number, save: boolean = true): void {
    if (!this.isSupported) return;
    this.settings.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.bgMusicElement) {
      this.bgMusicElement.volume = this.settings.musicVolume;
    }
    if (save) this.savePreferences();
  }

  public getMusicVolume(): number {
    return this.settings.musicVolume;
  }

  private _updateMusicMuteState(): void {
    if (this.bgMusicElement) {
        if (this.settings.isGlobalMuted || this.settings.isMusicMuted) {
            if (!this.bgMusicElement.paused) this.bgMusicElement.pause();
        } else {
            if (this.bgMusicElement.paused && this.settings.currentBackgroundMusic) { // Only resume if there was a track playing
                 // Check if it was paused due to mute or explicitly by user
                 // This logic can be complex. For now, simple resume if it was playing.
                 this.bgMusicElement.play().catch(e => console.error('AudioService: Error resuming BGM on unmute:', e));
            }
        }
    }
  }

  public toggleGlobalMute(): boolean {
    if (!this.isSupported) return this.settings.isGlobalMuted;
    this.settings.isGlobalMuted = !this.settings.isGlobalMuted;
    this._updateMusicMuteState();
    // Effects are checked at play time.
    this.savePreferences();
    return this.settings.isGlobalMuted;
  }
  
  public setGlobalMute(mute: boolean): void {
    if (!this.isSupported || this.settings.isGlobalMuted === mute) return;
    this.settings.isGlobalMuted = mute;
    this._updateMusicMuteState();
    this.savePreferences();
  }

  public toggleEffectsMute(): boolean {
    if (!this.isSupported) return this.settings.isEffectsMuted;
    this.settings.isEffectsMuted = !this.settings.isEffectsMuted;
    // Effects are checked at play time.
    this.savePreferences();
    return this.settings.isEffectsMuted;
  }

  public setEffectsMute(mute: boolean): void {
    if (!this.isSupported || this.settings.isEffectsMuted === mute) return;
    this.settings.isEffectsMuted = mute;
    this.savePreferences();
  }

  public toggleMusicMute(): boolean {
    if (!this.isSupported) return this.settings.isMusicMuted;
    this.settings.isMusicMuted = !this.settings.isMusicMuted;
    this._updateMusicMuteState();
    this.savePreferences();
    return this.settings.isMusicMuted;
  }

  public setMusicMute(mute: boolean): void {
    if (!this.isSupported || this.settings.isMusicMuted === mute) return;
    this.settings.isMusicMuted = mute;
    this._updateMusicMuteState();
    this.savePreferences();
  }

  public isGloballyMuted(): boolean {
    return this.settings.isGlobalMuted;
  }

  public areEffectsMuted(): boolean {
    // Effects are muted if either global or specific effects mute is on.
    return this.settings.isGlobalMuted || this.settings.isEffectsMuted;
  }

  public isMusicMuted(): boolean {
    // Music is muted if either global or specific music mute is on.
    return this.settings.isGlobalMuted || this.settings.isMusicMuted;
  }

  public getAudioSupportStatus(): boolean {
    return this.isSupported;
  }

  // Method to call when user interacts with the page, to enable audio context if suspended
  public userInteracted(): void {
    if (!this.isSupported) return;
    // For HTMLAudioElement, this is less of an issue than Web Audio API's AudioContext.
    // However, if BGM was blocked by autoplay, this is a good place to try playing it again.
    if (this.bgMusicElement && this.bgMusicElement.paused && this.settings.currentBackgroundMusic &&
        !this.settings.isGlobalMuted && !this.settings.isMusicMuted) {
      this.bgMusicElement.play().catch(e => {
        // Still might fail if not a direct result of user action on THIS element
        // console.warn('AudioService: BGM play attempt after user interaction:', e.message);
      });
    }
  }
}

// Export a singleton instance
const audioService = new AudioService();
export default audioService;
export enum BackgroundMusic {
  MainMenu = 'main-menu',
  Gameplay = 'gameplay',
  Victory = 'victory'
}

class AudioService {
  private currentMusic: string | null = null;
  private volume = 0.5;

  playBackgroundMusic(music: BackgroundMusic, loop = true, force = false) {
    if (this.currentMusic === music && !force) return;
    
    console.log(`Playing background music: ${music}`);
    this.currentMusic = music;
  }

  playSound(soundName: string) {
    console.log(`Playing sound: ${soundName}`);
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  getVolume(): number {
    return this.volume;
  }
}

const audioService = new AudioService();
export default audioService;

# Sound Assets Guide

This directory stores **all** audio used by the Solana RPS Game.  
Keeping the structure and naming conventions consistent ensures that the
`audio-service.ts` loader can find every sound and that bundle sizes stay
predictable.

---

## 1. Directory Structure

```
frontend/src/sounds/
├── effects/          # One-shot SFX (UI clicks, wins, commits…)
│   ├── ui_click_01.wav
│   ├── game_start_01.wav
│   └── ...           
├── music/            # Loopable background tracks
│   ├── bgm_main_menu_loop.mp3
│   ├── bgm_ingame_loop.mp3
│   └── ...
└── README.md         # ← you are here
```

### Sub-folders

| Folder   | Purpose                                 | Referenced by enum                     |
|----------|-----------------------------------------|----------------------------------------|
| `effects`| Short, non-looping sound effects        | `SoundEffect` in `audio-service.ts`    |
| `music`  | Loopable background music (BGM) tracks  | `BackgroundMusic` in `audio-service.ts`|

> Never place audio files in the project root; the build script only copies
> the two folders above.

---

## 2. File Naming Convention

```
<category>_<action>_<index>.<ext>
```

* **category** – ui / game / rps / tournament / outcome / timer / currency  
* **action**   – short verb or noun (`click`, `join`, `win` …)  
* **index**    – 2-digit incremental number starting at `01`  
* **ext**      – `.wav` preferred for SFX, `.mp3` for music loops  

Example: `ui_click_01.wav`, `outcome_game_win_01.wav`

These names are referenced **verbatim** in `SOUND_EFFECT_FILES` /
`BACKGROUND_MUSIC_FILES`.  If you change a filename, update the mapping!

---

## 3. Accepted Formats & Recommended Specs

| Use-case | Format | Sample Rate | Channels | Notes                                |
|----------|--------|-------------|----------|--------------------------------------|
| SFX      | `.wav` | 44.1 kHz    | Mono     | PCM 16-bit for best browser support  |
| BGM Loop | `.mp3` | 44.1 kHz    | Stereo   | Ensure seamless loop (edit at zero-crossing) |

Other formats (e.g. `.ogg`) are technically supported by modern browsers but
may fail on Safari/iOS. Stick to the table above to avoid compatibility
issues.

---

## 4. Adding Custom Sounds

1. **Prepare the file**  
   Export or convert your audio to the recommended format and naming scheme.

2. **Place it in the correct folder**  
   * `effects/` for one-shot SFX  
   * `music/`   for looping BGM

3. **Register the file**  
   Edit `frontend/src/services/audio-service.ts`:
   * Add an entry to `SOUND_EFFECT_FILES` **or** `BACKGROUND_MUSIC_FILES`
     that maps your enum key to the filename.

4. **Update enums if necessary**  
   If it’s a brand-new sound type, add a constant to either `SoundEffect` or
   `BackgroundMusic` enum above the mapping section.

5. **Test**  
   Run the app (`npm run dev`) and trigger the sound in the relevant game
   action.  Check the browser console for any 404 or decoding errors.

---

## 5. Tips

* Keep file sizes small—most SFX should be < 50 KB.  
* Normalise all tracks to ‑3 dBFS to maintain consistent loudness.  
* Fade-in/out music loops to prevent audible clicks.  
* Use mono for SFX unless stereo width is critical.

---

Happy sound designing! 🎧

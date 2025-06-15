import React, { useState, useEffect } from 'react';
import audioService from '../services/audio-service';

interface SoundControlProps {
  showVolume?: boolean;
  className?: string;
}

const SoundControl: React.FC<SoundControlProps> = ({ showVolume = false, className = '' }) => {
  const [muted, setMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.8);
  const [showVolumeSlider, setShowVolumeSlider] = useState<boolean>(false);

  useEffect(() => {
    // Initialize audio service with saved state
    const savedMuted = localStorage.getItem('rps-audio-muted');
    const savedVolume = localStorage.getItem('rps-audio-volume');

    if (savedMuted !== null) {
      const isMuted = savedMuted === 'true';
      setMuted(isMuted);
      audioService.setMuted(isMuted);
    }

    if (savedVolume !== null) {
      const vol = parseFloat(savedVolume);
      setVolume(vol);
      audioService.setVolume(vol);
    }
  }, []);

  const toggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    audioService.setMuted(newMuted);
    localStorage.setItem('rps-audio-muted', newMuted.toString());
    audioService.play('click');
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    audioService.setVolume(vol);
    localStorage.setItem('rps-audio-volume', vol.toString());
  };

  const toggleVolumeSlider = () => {
    setShowVolumeSlider(!showVolumeSlider);
    audioService.play('click');
  };

  return (
    <div className={`sound-control relative ${className}`}>
      <div className="flex items-center space-x-2">
        <button
          onClick={toggleMute}
          className="p-2 rounded-full hover:bg-gray-700 transition-colors focus:outline-none"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {!showVolume && (
          <button
            onClick={toggleVolumeSlider}
            className="p-2 rounded-full hover:bg-gray-700 transition-colors focus:outline-none"
            aria-label="Volume settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {(showVolume || showVolumeSlider) && (
        <div className={`volume-slider mt-2 ${showVolume ? '' : 'absolute right-0 top-full mt-2 p-3 bg-gray-800 rounded-lg shadow-lg z-10'}`}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="w-24 accent-purple-500"
            disabled={muted}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SoundControl;


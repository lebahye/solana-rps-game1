import React, { useEffect, useState, useRef } from 'react';
import { GameOutcome } from '../types';
import audioService from '../services/audio-service';

interface GameAnimationProps {
  isPlaying: boolean;
  playerChoice?: number;
  opponentChoice?: number;
  result?: GameOutcome;
}

// Mapping for choice icons
const choiceIcons: Record<number, string> = {
  0: '❓',
  1: '🪨',
  2: '📄',
  3: '✂️'
};

// Mapping for larger result icons
const resultIcons: Record<string, string> = {
  win: '🏆',
  loss: '😢',
  tie: '🤝'
};

const GameAnimation: React.FC<GameAnimationProps> = ({
  isPlaying,
  playerChoice = 0,
  opponentChoice = 0,
  result
}) => {
  const [animationState, setAnimationState] = useState<'idle' | 'counting' | 'result'>('idle');
  const [countdown, setCountdown] = useState<string>('');
  const [showResult, setShowResult] = useState<boolean>(false);
  const [shakePlayer, setShakePlayer] = useState<boolean>(false);
  const [shakeOpponent, setShakeOpponent] = useState<boolean>(false);
  const [showParticles, setShowParticles] = useState<boolean>(false);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);

  // Refs for particle effects
  const particlesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPlaying) {
      // Start counting animation
      setAnimationState('counting');
      setShowResult(false);
      setShowParticles(false);
      setShowConfetti(false);

      // Play countdown sound
      audioService.play('countdown');

      // Countdown animation: "Rock, Paper, Scissors, Shoot!"
      const countdownItems = ["Rock", "Paper", "Scissors", "Shoot!"];
      let index = 0;

      const intervalId = setInterval(() => {
        if (index < countdownItems.length) {
          setCountdown(countdownItems[index]);

          // Add shake animation on each count
          setShakePlayer(true);
          setShakeOpponent(true);

          // Reset shake after animation completes
          setTimeout(() => {
            setShakePlayer(false);
            setShakeOpponent(false);
          }, 200);

          index++;
        } else {
          clearInterval(intervalId);
          setAnimationState('result');

          // Delay showing the result for dramatic effect
          setTimeout(() => {
            setShowResult(true);

            // Play appropriate sound for the outcome
            if (result === 'win') {
              audioService.play('win');
              setShowConfetti(true);

              // Hide confetti after animation completes
              setTimeout(() => setShowConfetti(false), 7000);
            } else if (result === 'loss') {
              audioService.play('lose');
            } else {
              audioService.play('tie');
            }

            // Add some particle effects based on the result
            setShowParticles(true);

            // Hide particles after animation completes
            setTimeout(() => setShowParticles(false), 2000);
          }, 500);
        }
      }, 800); // Slightly slower for more dramatic effect

      return () => {
        clearInterval(intervalId);
      };
    } else {
      setAnimationState('idle');
      setShowResult(false);
      setShowParticles(false);
      setShowConfetti(false);
    }
  }, [isPlaying, result]);

  // Generate particle elements
  const generateParticles = () => {
    const particles = [];
    const count = 20;

    for (let i = 0; i < count; i++) {
      const delay = Math.random() * 0.5;
      const size = Math.random() * 12 + 5;
      const duration = Math.random() * 1 + 1;
      const x = Math.random() * 100;
      const y = Math.random() * 100;

      // Calculate translation values for CSS variables
      const tx = `${Math.random() > 0.5 ? '-' : ''}${Math.random() * 100 + 50}px`;
      const ty = `${Math.random() > 0.5 ? '-' : ''}${Math.random() * 100 + 50}px`;
      const rotate = `${Math.random() * 360}deg`;
      const scale = String(Math.random() * 0.5 + 0.5);

      const color = result === 'win'
        ? `hsl(${Math.random() * 60 + 30}, 100%, 50%)` // Gold/yellow for win
        : result === 'loss'
          ? `hsl(${Math.random() * 20 + 350}, 100%, 50%)` // Red for loss
          : `hsl(${Math.random() * 60 + 200}, 100%, 50%)`; // Blue for tie

      // Define particle style with proper typing
      const particleStyle: React.CSSProperties = {
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        left: `${x}%`,
        top: `${y}%`,
        '--tx': tx,
        '--ty': ty,
        '--rotate': rotate,
        '--scale': scale,
        animation: `particle-animation ${duration}s ease-out ${delay}s forwards`
      } as React.CSSProperties;

      particles.push(
        <div
          key={i}
          className="particle"
          style={particleStyle}
        />
      );
    }

    return particles;
  };

  return (
    <div className="relative w-full max-w-md mx-auto h-64 bg-gray-800 bg-opacity-40 rounded-xl p-4 overflow-hidden">
      {/* Confetti overlay for wins */}
      {showConfetti && <div className="confetti-overlay" />}

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-purple-900 opacity-20 animate-float" />
        <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-blue-900 opacity-20 animate-float-reverse" />
      </div>

      {/* Container for the animation */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center">
        {animationState === 'idle' && (
          <div className="text-center text-gray-400">
            <div className="text-4xl mb-2">🎮</div>
            <p>Waiting for game to start...</p>
          </div>
        )}

        {animationState === 'counting' && (
          <div className="text-center">
            <div className="text-4xl font-bold mb-4">{countdown}</div>
            <div className="flex justify-center items-center gap-12">
              <div className={`text-5xl ${shakePlayer ? 'animate-shake' : ''}`}>
                👊
              </div>
              <div className="text-xl">VS</div>
              <div className={`text-5xl ${shakeOpponent ? 'animate-shake' : ''}`}>
                👊
              </div>
            </div>
          </div>
        )}

        {animationState === 'result' && (
          <div className="text-center">
            {!showResult ? (
              <div className="text-4xl animate-loading">⏳</div>
            ) : (
              <>
                <div className="flex justify-center items-center gap-12 mb-6">
                  <div className={`text-5xl transition-all duration-500 transform ${result === 'win' ? 'scale-125 drop-shadow-glow-green' : ''}`}>
                    {choiceIcons[playerChoice]}
                  </div>
                  <div className="text-xl">VS</div>
                  <div className={`text-5xl transition-all duration-500 transform ${result === 'loss' ? 'scale-125 drop-shadow-glow-red' : ''}`}>
                    {choiceIcons[opponentChoice]}
                  </div>
                </div>

                <div className={`text-center p-3 rounded-lg transition-all duration-500 ${
                  result === 'win' ? 'bg-green-900 bg-opacity-40' :
                  result === 'loss' ? 'bg-red-900 bg-opacity-40' :
                  'bg-blue-900 bg-opacity-40'
                }`}>
                  <div className="text-4xl mb-2">
                    {resultIcons[result || 'tie']}
                  </div>
                  <div className="font-bold text-xl">
                    {result === 'win' ? 'You Win!' :
                     result === 'loss' ? 'You Lose!' :
                     'It\'s a Tie!'}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Particle container */}
      {showParticles && (
        <div ref={particlesRef} className="absolute inset-0 overflow-hidden pointer-events-none">
          {generateParticles()}
        </div>
      )}
    </div>
  );
};

export default GameAnimation;

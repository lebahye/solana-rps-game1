import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import GameMonitor from '../components/GameMonitor';

const TestingView: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const [gameId, setGameId] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');
  const [showMonitor, setShowMonitor] = useState<boolean>(false);
  const [deviceName, setDeviceName] = useState<string>('');
  const [browserInfo, setBrowserInfo] = useState<string>('');
  const [programId, setProgramId] = useState<string>('7Y9dRMY6V9cmVkXNFrHeUZmYf2tAV5wSVFcYyD5bLQpZ');
  const [endpoint, setEndpoint] = useState<string>(clusterApiUrl('devnet'));

  // Generate a unique device ID on component mount
  useEffect(() => {
    // Generate a simple device identifier based on browser and device information
    const generateDeviceId = () => {
      const nav = navigator;
      const screen = window.screen;
      const idStr =
        nav.userAgent +
        screen.width +
        screen.height +
        screen.colorDepth +
        nav.language +
        new Date().getTimezoneOffset();

      return Array.from(
        new Uint8Array(
          new TextEncoder().encode(idStr)
        )
      ).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    };

    const id = generateDeviceId();
    setDeviceId(id);

    // Get browser and device information
    const ua = navigator.userAgent;
    let browserName = "Unknown";
    let osName = "Unknown";

    // Browser detection
    if (ua.indexOf("Firefox") > -1) {
      browserName = "Firefox";
    } else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) {
      browserName = "Opera";
    } else if (ua.indexOf("Edge") > -1) {
      browserName = "Edge";
    } else if (ua.indexOf("Chrome") > -1) {
      browserName = "Chrome";
    } else if (ua.indexOf("Safari") > -1) {
      browserName = "Safari";
    }

    // OS detection
    if (ua.indexOf("Windows") > -1) {
      osName = "Windows";
    } else if (ua.indexOf("Mac") > -1) {
      osName = "MacOS";
    } else if (ua.indexOf("Linux") > -1) {
      osName = "Linux";
    } else if (ua.indexOf("Android") > -1) {
      osName = "Android";
    } else if (ua.indexOf("iPhone") > -1 || ua.indexOf("iPad") > -1) {
      osName = "iOS";
    }

    setBrowserInfo(`${browserName} on ${osName}`);

    // Set default device name based on browser and OS
    setDeviceName(`${osName}-${browserName}-${id.substring(0, 4)}`);
  }, []);

  const handleGameIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGameId(e.target.value);
  };

  const handleDeviceNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDeviceName(e.target.value);
  };

  const handleMonitorToggle = () => {
    setShowMonitor(!showMonitor);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card">
        <h2 className="text-2xl font-bold mb-6">Multi-Wallet Testing</h2>

        <div className="mb-6 p-4 bg-purple-900 bg-opacity-20 rounded-lg border border-purple-700">
          <div className="flex items-start">
            <div className="text-purple-400 text-xl mr-3">🧪</div>
            <div>
              <h3 className="text-lg font-semibold text-purple-300 mb-1">Testing Mode</h3>
              <p className="text-gray-300 mb-2">
                This is a special view for testing the game with multiple wallets across different devices.
              </p>
              <p className="text-sm text-gray-400 mb-1">
                <span className="font-semibold">Device ID:</span> {deviceId}
              </p>
              <p className="text-sm text-gray-400">
                <span className="font-semibold">Browser:</span> {browserInfo}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="form-group">
            <label className="form-label">Device Name (for testing)</label>
            <input
              type="text"
              className="form-control"
              value={deviceName}
              onChange={handleDeviceNameChange}
              placeholder="Give this device a name for testing"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Game ID to Monitor</label>
            <input
              type="text"
              className="form-control"
              value={gameId}
              onChange={handleGameIdChange}
              placeholder="Enter a game ID to monitor"
            />
          </div>

          <div className="mt-3">
            <button
              className={`w-full py-3 rounded-lg ${
                gameId ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-600 cursor-not-allowed opacity-60'
              }`}
              onClick={handleMonitorToggle}
              disabled={!gameId}
            >
              {showMonitor ? 'Hide Game Monitor' : 'Show Game Monitor'}
            </button>
          </div>
        </div>

        {showMonitor && gameId && (
          <GameMonitor
            gameId={gameId}
            endpoint={endpoint}
            programId={programId}
          />
        )}

        <div className="bg-gray-800 p-4 rounded-lg mb-4">
          <h3 className="text-lg font-semibold mb-2">Wallet Status</h3>

          <div className="flex items-center mb-2">
            <div className={`w-3 h-3 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{connected ? 'Connected' : 'Not Connected'}</span>
          </div>

          {connected && publicKey && (
            <div className="mt-2 p-2 bg-gray-700 rounded overflow-x-auto">
              <code className="text-xs text-gray-300">{publicKey.toString()}</code>
            </div>
          )}

          <div className="mt-4">
            <WalletMultiButton className="!bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" />
          </div>
        </div>

        <div className="mt-6 border-t border-gray-700 pt-4">
          <h3 className="text-lg font-semibold mb-3">Testing Instructions</h3>
          <ol className="text-gray-300 list-decimal list-inside space-y-2">
            <li>Connect your wallet on this device</li>
            <li>Create a game or get a Game ID from another test device</li>
            <li>Enter the Game ID above and click "Show Game Monitor"</li>
            <li>You can observe the game state as it changes</li>
            <li>Use multiple browsers/devices for comprehensive testing</li>
          </ol>

          <div className="mt-4 text-sm text-gray-400">
            <p>For detailed testing instructions, see the MULTI_WALLET_TESTING.md file in the project repository.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestingView;

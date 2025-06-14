import React, { useEffect, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import audioService from '../services/audio-service';

interface WalletHelperProps {
  className?: string;
}

const WalletHelper: React.FC<WalletHelperProps> = ({ className = '' }) => {
  const [browser, setBrowser] = useState<string>('');
  const [os, setOS] = useState<string>('');
  const [isPhantomInstalled, setIsPhantomInstalled] = useState<boolean>(false);
  const [isSolflareInstalled, setIsSolflareInstalled] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'phantom' | 'solflare'>('phantom');
  const [showMonadInfo, setShowMonadInfo] = useState<boolean>(false);

  // Detect browser and OS
  useEffect(() => {
    detectBrowserAndOS();
    checkWalletInstallation();
  }, []);

  const detectBrowserAndOS = () => {
    // Detect browser
    const userAgent = navigator.userAgent;
    let detectedBrowser = '';

    if (userAgent.indexOf('Chrome') > -1) {
      detectedBrowser = 'Chrome';
    } else if (userAgent.indexOf('Firefox') > -1) {
      detectedBrowser = 'Firefox';
    } else if (userAgent.indexOf('Safari') > -1) {
      detectedBrowser = 'Safari';
    } else if (userAgent.indexOf('Edge') > -1 || userAgent.indexOf('Edg') > -1) {
      detectedBrowser = 'Edge';
    } else if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) {
      detectedBrowser = 'Opera';
    } else {
      detectedBrowser = 'Unknown';
    }

    // Detect OS
    let detectedOS = '';
    if (userAgent.indexOf('Win') > -1) {
      detectedOS = 'Windows';
    } else if (userAgent.indexOf('Mac') > -1) {
      detectedOS = 'macOS';
    } else if (userAgent.indexOf('Linux') > -1) {
      detectedOS = 'Linux';
    } else if (userAgent.indexOf('Android') > -1) {
      detectedOS = 'Android';
    } else if (userAgent.indexOf('iPhone') > -1 || userAgent.indexOf('iPad') > -1) {
      detectedOS = 'iOS';
    } else {
      detectedOS = 'Unknown';
    }

    setBrowser(detectedBrowser);
    setOS(detectedOS);
  };

  const checkWalletInstallation = () => {
    // Check if Phantom is installed
    const isPhantom = window.phantom?.solana?.isPhantom;
    setIsPhantomInstalled(!!isPhantom);

    // Check if Solflare is installed
    const isSolflare = window.solflare?.isSolflare;
    setIsSolflareInstalled(!!isSolflare);
  };

  const getWalletDownloadLink = (walletName: 'phantom' | 'solflare') => {
    if (walletName === 'phantom') {
      if (os === 'iOS' || os === 'Android') {
        return 'https://phantom.app/download';
      }

      if (browser === 'Chrome') {
        return 'https://chrome.google.com/webstore/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa';
      } else if (browser === 'Firefox') {
        return 'https://addons.mozilla.org/en-US/firefox/addon/phantom-app/';
      } else if (browser === 'Edge') {
        return 'https://microsoftedge.microsoft.com/addons/detail/phantom/dfpilgmgeoehhkocfmppkegbjpkgfgha';
      } else {
        return 'https://phantom.app/download';
      }
    } else {
      if (os === 'iOS' || os === 'Android') {
        return 'https://solflare.com/download';
      }

      if (browser === 'Chrome') {
        return 'https://chrome.google.com/webstore/detail/solflare-wallet/bhhhlbepdkbapadjdnnojkbgioiodbic';
      } else if (browser === 'Firefox') {
        return 'https://addons.mozilla.org/en-US/firefox/addon/solflare-wallet/';
      } else if (browser === 'Edge') {
        return 'https://microsoftedge.microsoft.com/addons/detail/solflare-wallet/hgkjjcnchdejehjfomkjeoeebkmgeknd';
      } else {
        return 'https://solflare.com/download';
      }
    }
  };

  const getWalletInstallInstructions = (walletName: 'phantom' | 'solflare') => {
    const walletDisplayName = walletName === 'phantom' ? 'Phantom' : 'Solflare';

    if (os === 'iOS' || os === 'Android') {
      return (
        <ol className="list-decimal list-inside text-left text-gray-300 space-y-2 mb-4">
          <li>Download the {walletDisplayName} app from the app store</li>
          <li>Create a new wallet or import an existing one</li>
          <li>Open the app and use the built-in browser to return to this site</li>
        </ol>
      );
    }

    return (
      <ol className="list-decimal list-inside text-left text-gray-300 space-y-2 mb-4">
        <li>Click the download button to install the {walletDisplayName} extension</li>
        <li>Follow the installation instructions in your browser</li>
        <li>Create a new wallet or import an existing one</li>
        <li>Return to this page and refresh to connect</li>
      </ol>
    );
  };

  const handleTabChange = (tab: 'phantom' | 'solflare') => {
    setActiveTab(tab);
    audioService.play('click');
  };

  const renderWalletStatus = (walletName: 'phantom' | 'solflare') => {
    const isInstalled = walletName === 'phantom' ? isPhantomInstalled : isSolflareInstalled;
    const walletDisplayName = walletName === 'phantom' ? 'Phantom' : 'Solflare';

    if (isInstalled) {
      return (
        <div className="flex items-center text-green-500 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{walletDisplayName} is installed</span>
        </div>
      );
    }

    return (
      <div className="flex items-center text-yellow-500 mb-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <span>{walletDisplayName} is not installed</span>
      </div>
    );
  };

  return (
    <div className={`wallet-helper ${className}`}>
      <div className="wallet-status text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Connect a Wallet</h2>
        <p className="text-gray-300 mb-4">
          You need a Solana wallet to play Rock Paper Scissors on the blockchain.
        </p>

        {(isPhantomInstalled || isSolflareInstalled) && (
          <div className="mt-4 max-w-md mx-auto">
            <p className="text-green-400 mb-2">Wallet detected! Click below to connect:</p>
            <div className="transform hover:scale-105 transition-transform duration-300">
              <WalletMultiButton className="!bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 !rounded-xl !py-4 !px-8 !text-xl" />
            </div>
          </div>
        )}
      </div>

      {(!isPhantomInstalled && !isSolflareInstalled) && (
        <div className="wallet-installation bg-gray-800 bg-opacity-50 rounded-xl p-6 max-w-2xl mx-auto">
          <div className="wallet-tabs flex mb-4">
            <button
              className={`flex-1 py-2 ${activeTab === 'phantom' ? 'border-b-2 border-purple-500 text-purple-400' : 'text-gray-400'}`}
              onClick={() => handleTabChange('phantom')}
            >
              <span className="flex items-center justify-center">
                <img
                  src="https://phantom.app/apple-touch-icon.png"
                  alt="Phantom"
                  className="w-5 h-5 mr-2"
                />
                Phantom
              </span>
            </button>
            <button
              className={`flex-1 py-2 ${activeTab === 'solflare' ? 'border-b-2 border-orange-500 text-orange-400' : 'text-gray-400'}`}
              onClick={() => handleTabChange('solflare')}
            >
              <span className="flex items-center justify-center">
                <img
                  src="https://solflare.com/assets/icon-solflare-orange.svg"
                  alt="Solflare"
                  className="w-5 h-5 mr-2"
                />
                Solflare
              </span>
            </button>
          </div>

          <div className="wallet-content">
            {activeTab === 'phantom' ? (
              <div className="phantom-content">
                {renderWalletStatus('phantom')}
                <p className="text-gray-300 mb-4">
                  Phantom is a friendly Solana wallet built for DeFi & NFTs.
                </p>
                {getWalletInstallInstructions('phantom')}
                <a
                  href={getWalletDownloadLink('phantom')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                  onClick={() => audioService.play('click')}
                >
                  Download Phantom for {browser}
                </a>
              </div>
            ) : (
              <div className="solflare-content">
                {renderWalletStatus('solflare')}
                <p className="text-gray-300 mb-4">
                  Solflare is a powerful wallet for Solana with full DeFi support.
                </p>
                {getWalletInstallInstructions('solflare')}
                <a
                  href={getWalletDownloadLink('solflare')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                  onClick={() => audioService.play('click')}
                >
                  Download Solflare for {browser}
                </a>
              </div>
            )}
          </div>

          <div className="wallet-footer mt-6 pt-4 border-t border-gray-700">
            <p className="text-sm text-gray-400">
              By connecting a wallet, you agree to the game's <a href="#" className="text-purple-400 hover:underline">Terms of Service</a> and acknowledge the <a href="#" className="text-purple-400 hover:underline">Privacy Policy</a>.
            </p>
          </div>
        </div>
      )}

      {/* Add Monad Testnet information */}
      <div className="mt-6 p-4 bg-purple-900 bg-opacity-20 rounded-lg border border-purple-700">
        <div className="flex items-start">
          <div className="text-purple-400 text-xl mr-3">ℹ️</div>
          <div>
            <h3 className="text-lg font-semibold text-purple-300 mb-1">About Wallet Popups</h3>
            <p className="text-gray-300 mb-2">
              When connecting your Phantom wallet, you may see a popup about "Monad Testnet". This is unrelated to our app.
            </p>
            <button
              onClick={() => setShowMonadInfo(!showMonadInfo)}
              className="text-purple-400 hover:text-purple-300 text-sm flex items-center"
            >
              {showMonadInfo ? 'Hide details' : 'Show details'}
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-1 transition-transform ${showMonadInfo ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            {showMonadInfo && (
              <div className="mt-2 p-3 bg-gray-800 rounded-lg text-sm">
                <p className="mb-2">
                  <strong>What is Monad Testnet?</strong> Monad is an Ethereum-compatible blockchain that Phantom is testing. It's completely separate from Solana and our game.
                </p>
                <p className="mb-2">
                  <strong>Should you enable it?</strong> You don't need to enable Monad for our Rock Paper Scissors game. Our game runs exclusively on Solana.
                </p>
                <p>
                  <strong>What to do:</strong> You can simply click "Not Now" on the Monad popup and continue using our game normally on Solana.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletHelper;

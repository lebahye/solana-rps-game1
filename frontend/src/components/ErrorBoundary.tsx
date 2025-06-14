
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 max-w-2xl w-full border border-white/20">
            <h1 className="text-3xl font-bold text-white mb-4">
              🎮 Game Crashed!
            </h1>
            <p className="text-white/80 mb-6">
              Something went wrong with the Solana RPS Game. This usually happens due to wallet connection issues or browser compatibility problems.
            </p>
            
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
              <h3 className="text-red-200 font-semibold mb-2">Error Details:</h3>
              <pre className="text-red-100 text-sm overflow-auto max-h-32">
                {this.state.error?.toString()}
              </pre>
            </div>

            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mb-6">
              <h3 className="text-blue-200 font-semibold mb-2">Quick Fixes:</h3>
              <ul className="text-blue-100 text-sm space-y-1">
                <li>• Make sure you have a Solana wallet (Phantom/Solflare) installed</li>
                <li>• Try refreshing the page</li>
                <li>• Switch to a supported browser (Chrome, Firefox, Edge)</li>
                <li>• Check if your wallet is connected to Devnet</li>
                <li>• Clear browser cache and cookies for this site</li>
              </ul>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200"
              >
                🔄 Reload Game
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200"
              >
                🎯 Try Again
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mt-6">
                <summary className="text-white/60 cursor-pointer hover:text-white">
                  🔧 Developer Info (click to expand)
                </summary>
                <pre className="mt-2 text-xs text-white/40 bg-black/20 p-3 rounded overflow-auto max-h-40">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

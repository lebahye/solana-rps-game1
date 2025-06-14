import React, { useState, useEffect } from 'react';
import { RpsSecurityService, SecurityMetrics } from '../services/security-service';
import { Connection } from '@solana/web3.js';

interface SecurityDashboardProps {
  compact?: boolean;
  showMetrics?: boolean;
}

// Mock data for demonstration purposes
const demoMetrics: SecurityMetrics = {
  requestsPerMinute: 3240,
  failedAttempts: 47,
  concurrentGames: 826,
  activeUsers: 3214,
  averageLatency: 78, // ms
  lastAttackTimestamp: Date.now() - 1000 * 60 * 60 * 3, // 3 hours ago
};

const SecurityDashboard: React.FC<SecurityDashboardProps> = ({
  compact = false,
  showMetrics = true
}) => {
  const [metrics, setMetrics] = useState<SecurityMetrics>(demoMetrics);
  const [expanded, setExpanded] = useState(false);

  // Simulate updating metrics periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        requestsPerMinute: Math.floor(prev.requestsPerMinute + Math.random() * 100 - 50),
        concurrentGames: Math.floor(prev.concurrentGames + Math.random() * 10 - 5),
        activeUsers: Math.floor(prev.activeUsers + Math.random() * 20 - 10),
        averageLatency: Math.floor(prev.averageLatency + Math.random() * 10 - 5),
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';

    const secondsAgo = Math.floor((Date.now() - timestamp) / 1000);

    if (secondsAgo < 60) return `${secondsAgo} sec ago`;
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)} min ago`;
    if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)} hrs ago`;
    return `${Math.floor(secondsAgo / 86400)} days ago`;
  };

  // Security features with descriptions
  const securityFeatures = [
    {
      name: 'Anti-DDoS Protection',
      description: 'Distributed relay network prevents direct attacks on game servers',
      icon: '🛡️'
    },
    {
      name: 'On-Chain Verification',
      description: 'All game moves are cryptographically secured on the Solana blockchain',
      icon: '🔒'
    },
    {
      name: 'Multi-Region Scaling',
      description: 'Load balancing across global regions ensures low latency and high availability',
      icon: '🌐'
    },
    {
      name: 'Anti-Bot Protection',
      description: 'Advanced behavior analysis detects and prevents automated gameplay',
      icon: '🤖'
    },
    {
      name: 'Encrypted Game Moves',
      description: 'Commit-reveal pattern prevents players from seeing others\' moves in advance',
      icon: '🔐'
    },
    {
      name: 'Fraud Detection',
      description: 'Continuous monitoring for suspicious activity and cheating attempts',
      icon: '🕵️'
    },
  ];

  // Scaling capabilities with descriptions
  const scalingCapabilities = [
    {
      name: 'Horizontal Scaling',
      description: 'Automatically scales to handle thousands of concurrent games',
      value: '50,000+ concurrent players'
    },
    {
      name: 'Database Sharding',
      description: 'Game data is distributed across multiple database shards for high performance',
      value: '200+ transactions per second'
    },
    {
      name: 'High Availability',
      description: '99.9% uptime with multi-region redundancy',
      value: '< 200ms global latency'
    }
  ];

  if (compact) {
    return (
      <div className="bg-purple-900 bg-opacity-30 rounded-lg p-4 border border-purple-800">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white mb-0">Enhanced Security & Scaling</h3>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-purple-300 hover:text-purple-100"
          >
            {expanded ? '▲ Hide' : '▼ Details'}
          </button>
        </div>

        {expanded && (
          <div className="mt-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              {securityFeatures.slice(0, 3).map((feature, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <div className="text-xl">{feature.icon}</div>
                  <div className="text-sm">{feature.name}</div>
                </div>
              ))}
            </div>
            <div className="text-sm text-purple-300">
              Supports 50,000+ concurrent players with 99.9% uptime
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-purple-800 overflow-hidden">
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 px-6 py-4">
        <h2 className="text-2xl font-bold text-white">Security & Scaling Dashboard</h2>
        <p className="text-purple-200">Enterprise-grade protection and performance for Rock Paper Scissors</p>
      </div>

      {showMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 bg-gray-900">
          <div className="bg-gray-800 p-3 rounded-lg">
            <div className="text-sm text-gray-400">Active Users</div>
            <div className="text-xl font-bold text-white">{metrics.activeUsers.toLocaleString()}</div>
          </div>

          <div className="bg-gray-800 p-3 rounded-lg">
            <div className="text-sm text-gray-400">Concurrent Games</div>
            <div className="text-xl font-bold text-white">{metrics.concurrentGames.toLocaleString()}</div>
          </div>

          <div className="bg-gray-800 p-3 rounded-lg">
            <div className="text-sm text-gray-400">Requests/min</div>
            <div className="text-xl font-bold text-white">{metrics.requestsPerMinute.toLocaleString()}</div>
          </div>

          <div className="bg-gray-800 p-3 rounded-lg">
            <div className="text-sm text-gray-400">Avg Latency</div>
            <div className="text-xl font-bold text-green-400">{metrics.averageLatency} ms</div>
          </div>

          <div className="bg-gray-800 p-3 rounded-lg">
            <div className="text-sm text-gray-400">Failed Attempts</div>
            <div className="text-xl font-bold text-red-400">{metrics.failedAttempts}</div>
          </div>

          <div className="bg-gray-800 p-3 rounded-lg">
            <div className="text-sm text-gray-400">Last Attack</div>
            <div className="text-xl font-bold text-yellow-400">{formatTimeAgo(metrics.lastAttackTimestamp)}</div>
          </div>
        </div>
      )}

      <div className="p-6">
        <h3 className="text-xl font-semibold mb-4 text-purple-300">Security Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {securityFeatures.map((feature, index) => (
            <div key={index} className="bg-gray-900 p-4 rounded-lg flex items-start space-x-3">
              <div className="text-3xl">{feature.icon}</div>
              <div>
                <h4 className="font-semibold text-white">{feature.name}</h4>
                <p className="text-sm text-gray-400">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        <h3 className="text-xl font-semibold mb-4 text-purple-300">Scaling Capabilities</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scalingCapabilities.map((capability, index) => (
            <div key={index} className="bg-gray-900 p-4 rounded-lg">
              <h4 className="font-semibold text-white">{capability.name}</h4>
              <p className="text-sm text-gray-400 mb-2">{capability.description}</p>
              <div className="text-lg font-bold text-green-400">{capability.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboard;

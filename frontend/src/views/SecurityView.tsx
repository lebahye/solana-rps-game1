import React from 'react';
import SecurityDashboard from '../components/SecurityDashboard';

interface SecurityViewProps {
  onBack: () => void;
}

const SecurityView: React.FC<SecurityViewProps> = ({ onBack }) => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <SecurityDashboard showMetrics={true} />
      </div>

      <div className="card mb-8">
        <h2 className="text-2xl font-bold mb-6">Security Architecture</h2>

        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-3 text-purple-300">Blockchain Security</h3>
          <p className="text-gray-300 mb-4">
            Our game leverages Solana's blockchain for secure and tamper-proof gameplay. All critical game actions are recorded on-chain, ensuring complete transparency and preventing cheating.
          </p>

          <div className="bg-gray-900 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Key Security Features:</h4>
            <ul className="space-y-2">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <div>
                  <span className="font-medium">Commit-Reveal Pattern</span>
                  <p className="text-sm text-gray-400">Players first commit to a hashed version of their choice, then reveal it later, preventing players from changing their mind after seeing others' choices.</p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <div>
                  <span className="font-medium">Cryptographic Verification</span>
                  <p className="text-sm text-gray-400">All game moves are cryptographically signed and verified on the blockchain, ensuring only legitimate moves are counted.</p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <div>
                  <span className="font-medium">HMAC-SHA512 Commitments</span>
                  <p className="text-sm text-gray-400">
                    Commitment hashes were upgraded from SHA-256 to HMAC-SHA-512 with 32-byte salts stored separately, eliminating brute-force and timing-attack vectors.
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <div>
                  <span className="font-medium">Authorised Fee Collection</span>
                  <p className="text-sm text-gray-400">
                    Fees are locked in a PDA and can only be swept by the designated fee-collector address, preventing unauthorised withdrawals.
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <div>
                  <span className="font-medium">Transaction Simulation &amp; Rate-Limit</span>
                  <p className="text-sm text-gray-400">
                    Every client transaction is simulated before broadcast and subject to per-wallet rate-limits to catch errors and mitigate spam.
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <div>
                  <span className="font-medium">Real-time Metrics &amp; Alerts</span>
                  <p className="text-sm text-gray-400">
                    A Prometheus exporter tracks game health, fee flows, and abnormal patterns; alerts are pushed to Slack for rapid incident response.
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <div>
                  <span className="font-medium">Time-Based Security</span>
                  <p className="text-sm text-gray-400">Game rounds have secure timeouts to prevent players from stalling indefinitely.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-3 text-purple-300">Anti-Hacking Measures</h3>
          <p className="text-gray-300 mb-4">
            Our multi-layered security approach prevents various attack vectors and ensures fair gameplay for all players.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900 p-4 rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center">
                <span className="text-xl mr-2">🛡️</span>
                <span>DDoS Protection</span>
              </h4>
              <p className="text-sm text-gray-400">
                Multiple layers of traffic filtering and rate limiting prevent distributed denial of service attacks, keeping games running smoothly even under attack.
              </p>
            </div>

            <div className="bg-gray-900 p-4 rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center">
                <span className="text-xl mr-2">🤖</span>
                <span>Bot Detection</span>
              </h4>
              <p className="text-sm text-gray-400">
                Advanced behavior analysis algorithms detect and prevent automated gameplay, ensuring a fair environment for human players.
              </p>
            </div>

            <div className="bg-gray-900 p-4 rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center">
                <span className="text-xl mr-2">🔐</span>
                <span>Secure Transactions</span>
              </h4>
              <p className="text-sm text-gray-400">
                All financial transactions are secured by Solana's cryptographic protocols, ensuring your funds are always safe.
              </p>
            </div>

            <div className="bg-gray-900 p-4 rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center">
                <span className="text-xl mr-2">🕵️</span>
                <span>Fraud Prevention</span>
              </h4>
              <p className="text-sm text-gray-400">
                Real-time monitoring systems detect suspicious activity and prevent fraudulent gameplay before it affects other players.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-8">
        <h2 className="text-2xl font-bold mb-6">Scaling Infrastructure</h2>

        <div className="mb-6">
          <p className="text-gray-300 mb-4">
            Our infrastructure is designed to handle thousands of concurrent players with low latency and high availability.
          </p>

          <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-4 rounded-lg mb-6">
            <div className="text-center font-bold text-2xl mb-2">50,000+</div>
            <div className="text-center text-purple-200">Concurrent Players Supported</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Horizontal Scaling</h4>
              <p className="text-sm text-gray-400">
                Our infrastructure automatically scales out horizontally to handle traffic spikes and increased player load.
              </p>
            </div>

            <div className="bg-gray-900 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Global Distribution</h4>
              <p className="text-sm text-gray-400">
                Game servers are distributed across 12 global regions to provide low-latency gameplay worldwide.
              </p>
            </div>

            <div className="bg-gray-900 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Database Sharding</h4>
              <p className="text-sm text-gray-400">
                Game data is automatically sharded across multiple database instances for high throughput and performance.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-3 text-purple-300">Performance Metrics</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-400">99.9%</div>
              <div className="text-sm text-gray-400">Uptime</div>
            </div>

            <div className="bg-gray-900 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-400">&lt; 200ms</div>
              <div className="text-sm text-gray-400">Global Latency</div>
            </div>

            <div className="bg-gray-900 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-400">200+</div>
              <div className="text-sm text-gray-400">TPS</div>
            </div>

            <div className="bg-gray-900 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-400">12</div>
              <div className="text-sm text-gray-400">Global Regions</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center mb-8">
        <button
          onClick={onBack}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg hover:from-purple-700 hover:to-indigo-700 font-medium"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default SecurityView;

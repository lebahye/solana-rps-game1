import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Paths
const resultsDir = path.join(__dirname, '../results');
const dashboardDir = path.join(__dirname, '../dashboard');
const dashboardFile = path.join(dashboardDir, 'index.html');

// Result files to include
const resultFiles = [
  {
    name: 'Basic Tests',
    file: 'basic-test-results.json',
    color: '#4285F4'
  },
  {
    name: 'Security Tests',
    file: 'mock-security-test-results.json',
    color: '#EA4335'
  },
  {
    name: 'Performance Tests',
    file: 'performance-benchmark-results.json',
    color: '#FBBC05'
  },
  {
    name: 'E2E Integration Tests',
    file: 'e2e-integration-results.json',
    color: '#34A853'
  },
  {
    name: 'UX Tests',
    file: 'mock-ux-test-results.json',
    color: '#8E44AD'
  },
  {
    name: 'Fee Tests',
    file: 'mock-fee-results.json',
    color: '#F39C12'
  },
  {
    name: 'Fairness Tests',
    file: 'mock-fairness-results.json',
    color: '#16A085'
  }
];

// Chart data structure
interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor: string[];
    borderColor: string[];
    borderWidth: number;
  }>;
}

/**
 * Read a test result file
 */
async function readResultFile(filename: string): Promise<any> {
  try {
    const filePath = path.join(resultsDir, filename);
    if (await fs.pathExists(filePath)) {
      return await fs.readJson(filePath);
    }
    return null;
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return null;
  }
}

/**
 * Generate the dashboard HTML
 */
async function generateDashboard() {
  console.log(chalk.blue('Generating test dashboard...'));

  // Create dashboard directory if it doesn't exist
  await fs.ensureDir(dashboardDir);

  // Read all result files
  const results = [];
  for (const resultFile of resultFiles) {
    const data = await readResultFile(resultFile.file);
    if (data) {
      results.push({
        ...resultFile,
        data
      });
    }
  }

  // Extract test metrics for visualization
  const testSummary = results.map(result => {
    const data = result.data;
    return {
      name: result.name,
      color: result.color,
      testsRun: data.testsRun || 0,
      passedTests: data.passedTests || 0,
      failedTests: (data.testsRun || 0) - (data.passedTests || 0),
      passRate: data.testsRun ? (data.passedTests / data.testsRun * 100).toFixed(1) : 'N/A',
      vulnerabilitiesFound: data.vulnerabilitiesFound || 0,
      lastRunDate: data.testDate || 'Unknown'
    };
  });

  // Prepare chart data
  const passRateChartData: ChartData = {
    labels: testSummary.map(summary => summary.name),
    datasets: [{
      label: 'Pass Rate (%)',
      data: testSummary.map(summary => typeof summary.passRate === 'string' ? 0 : parseFloat(summary.passRate)),
      backgroundColor: testSummary.map(summary => `${summary.color}80`), // Add transparency
      borderColor: testSummary.map(summary => summary.color),
      borderWidth: 1
    }]
  };

  const testsChartData: ChartData = {
    labels: testSummary.map(summary => summary.name),
    datasets: [{
      label: 'Passed Tests',
      data: testSummary.map(summary => summary.passedTests),
      backgroundColor: testSummary.map(() => '#34A85380'),
      borderColor: testSummary.map(() => '#34A853'),
      borderWidth: 1
    }, {
      label: 'Failed Tests',
      data: testSummary.map(summary => summary.failedTests),
      backgroundColor: testSummary.map(() => '#EA433580'),
      borderColor: testSummary.map(() => '#EA4335'),
      borderWidth: 1
    }]
  };

  // Security-specific data
  let securityData = null;
  const securityResult = results.find(result => result.name === 'Security Tests');
  if (securityResult && securityResult.data && securityResult.data.tests) {
    securityData = securityResult.data.tests.map(test => ({
      name: test.name,
      success: test.success,
      description: test.description
    }));
  }

  // Performance data
  let performanceData = null;
  const performanceResult = results.find(result => result.name === 'Performance Tests');
  if (performanceResult && performanceResult.data && performanceResult.data.benchmarks) {
    performanceData = performanceResult.data.benchmarks.map(benchmark => ({
      name: benchmark.name,
      operationsPerSecond: benchmark.operationsPerSecond
    }));
  }

  // Generate HTML content
  const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Solana RPS Game Testing Dashboard</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
      .dashboard-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }
      .card {
        margin-bottom: 20px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      }
      .metric-card {
        text-align: center;
        padding: 15px;
      }
      .metric-value {
        font-size: 2rem;
        font-weight: bold;
      }
      .metric-label {
        color: #666;
      }
      .test-table {
        font-size: 0.9rem;
      }
      .chart-container {
        height: 300px;
        margin-bottom: 30px;
      }
      .timestamp {
        font-size: 0.8rem;
        color: #666;
        text-align: right;
        margin-top: 15px;
      }
    </style>
  </head>
  <body>
    <div class="dashboard-container">
      <h1 class="mb-4">Solana RPS Game Testing Dashboard</h1>

      <div class="row">
        <div class="col-md-3">
          <div class="card metric-card">
            <div class="metric-value">${testSummary.reduce((sum, summary) => sum + summary.testsRun, 0)}</div>
            <div class="metric-label">Total Tests Run</div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card metric-card">
            <div class="metric-value">${testSummary.reduce((sum, summary) => sum + summary.passedTests, 0)}</div>
            <div class="metric-label">Tests Passed</div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card metric-card">
            <div class="metric-value">${testSummary.reduce((sum, summary) => sum + summary.failedTests, 0)}</div>
            <div class="metric-label">Tests Failed</div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card metric-card">
            <div class="metric-value">${securityResult?.data?.vulnerabilitiesFound || 0}</div>
            <div class="metric-label">Security Vulnerabilities</div>
          </div>
        </div>
      </div>

      <div class="row mt-4">
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">Pass Rate by Test Type</div>
            <div class="card-body">
              <div class="chart-container">
                <canvas id="passRateChart"></canvas>
              </div>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">Tests Passed vs Failed</div>
            <div class="card-body">
              <div class="chart-container">
                <canvas id="testsChart"></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>

      ${securityData ? `
      <div class="row mt-4">
        <div class="col-12">
          <div class="card">
            <div class="card-header">Security Test Results</div>
            <div class="card-body">
              <table class="table table-striped test-table">
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th>Description</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${securityData.map(test => `
                    <tr>
                      <td>${test.name}</td>
                      <td>${test.description}</td>
                      <td><span class="badge bg-${test.success ? 'success' : 'danger'}">${test.success ? 'PASSED' : 'FAILED'}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      ` : ''}

      ${performanceData ? `
      <div class="row mt-4">
        <div class="col-12">
          <div class="card">
            <div class="card-header">Performance Benchmark Results</div>
            <div class="card-body">
              <div class="chart-container">
                <canvas id="performanceChart"></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>
      ` : ''}

      <div class="row mt-4">
        <div class="col-12">
          <div class="card">
            <div class="card-header">Test Summary</div>
            <div class="card-body">
              <table class="table table-striped test-table">
                <thead>
                  <tr>
                    <th>Test Type</th>
                    <th>Tests Run</th>
                    <th>Tests Passed</th>
                    <th>Pass Rate</th>
                    <th>Last Run</th>
                  </tr>
                </thead>
                <tbody>
                  ${testSummary.map(summary => `
                    <tr>
                      <td>${summary.name}</td>
                      <td>${summary.testsRun}</td>
                      <td>${summary.passedTests}</td>
                      <td>${summary.passRate}%</td>
                      <td>${new Date(summary.lastRunDate).toLocaleString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div class="timestamp">
        Dashboard generated on: ${new Date().toLocaleString()}
      </div>
    </div>

    <script>
      // Pass Rate Chart
      const passRateCtx = document.getElementById('passRateChart').getContext('2d');
      new Chart(passRateCtx, {
        type: 'bar',
        data: ${JSON.stringify(passRateChartData)},
        options: {
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              title: {
                display: true,
                text: 'Pass Rate (%)'
              }
            }
          },
          maintainAspectRatio: false
        }
      });

      // Tests Chart
      const testsCtx = document.getElementById('testsChart').getContext('2d');
      new Chart(testsCtx, {
        type: 'bar',
        data: ${JSON.stringify(testsChartData)},
        options: {
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Number of Tests'
              }
            }
          },
          maintainAspectRatio: false
        }
      });

      ${performanceData ? `
      // Performance Chart
      const performanceCtx = document.getElementById('performanceChart').getContext('2d');
      new Chart(performanceCtx, {
        type: 'bar',
        data: {
          labels: ${JSON.stringify(performanceData.map(perf => perf.name))},
          datasets: [{
            label: 'Operations Per Second',
            data: ${JSON.stringify(performanceData.map(perf => perf.operationsPerSecond))},
            backgroundColor: '#34A85380',
            borderColor: '#34A853',
            borderWidth: 1
          }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Operations Per Second'
              }
            }
          },
          maintainAspectRatio: false
        }
      });
      ` : ''}
    </script>
  </body>
  </html>
  `;

  // Write the HTML file
  await fs.writeFile(dashboardFile, htmlContent);

  console.log(chalk.green(`Dashboard generated successfully at: ${dashboardFile}`));
}

// Run the dashboard generator
generateDashboard().catch(err => {
  console.error(chalk.red('Error generating dashboard:'), err);
  process.exit(1);
});


// Simple fallback server for root level
const http = require('http');
const path = require('path');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html>
      <head><title>Solana RPS Game</title></head>
      <body>
        <h1>Solana RPS Game</h1>
        <p>The frontend is located in the <code>/frontend</code> directory.</p>
        <p>Please use the "Run Frontend Dev" or "Run Frontend Prod" workflows instead.</p>
      </body>
    </html>
  `);
});

const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});

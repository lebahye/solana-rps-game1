// polyfill-setup.js
// This file sets up polyfills for Node.js built-ins that are used by Solana libraries
// but are not available in the browser.

import { Buffer } from 'buffer';

// Make Buffer globally available
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
  window.global = window;

  // Add process polyfill
  if (!window.process) {
    window.process = require('process/browser');
  }
}

// Also make it available for Node.js environments
if (typeof global !== 'undefined') {
  global.Buffer = Buffer;
}
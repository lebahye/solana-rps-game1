// This script sets up all the necessary polyfills for Node.js builtins
/**
 * Polyfill bundle for Solana applications
 * Sets up Buffer and process globals required by Solana web3.js
 * This file must be loaded BEFORE any other modules that use these globals
 */

// Import Buffer from 'buffer'
import * as bufferPolyfill from 'buffer';

// Set globals needed by Solana web3.js
window.global = window;
window.Buffer = bufferPolyfill.Buffer;

// Polyfill process
window.process = window.process || {
  env: {},
  browser: true,
  nextTick: (fn) => setTimeout(fn, 0),
};

// Test the Buffer polyfill
try {
  // Create an ed25519 public key to test Buffer
  const testKey = '7Y9dRMY6V9cmVkXNFrHeUZmYf2tAV5wSVFcYyD5bLQpZ';
  const testBuffer = Buffer.from(testKey);

  console.log('✅ Polyfills initialized successfully!', {
    hasBuffer: typeof Buffer !== 'undefined',
    hasBufferFrom: typeof Buffer.from === 'function',
    bufferTest: testBuffer.toString('hex').substring(0, 10) + '...',
    hasProcess: typeof process !== 'undefined'
  });
} catch (err) {
  console.error('❌ Failed to initialize polyfills:', err);
}

console.log('Polyfills loaded successfully:', {
  buffer: typeof window.Buffer !== 'undefined',
  bufferFrom: typeof window.Buffer.from === 'function',
  bufferAlloc: typeof window.Buffer.alloc === 'function',
  process: typeof window.process !== 'undefined'
});

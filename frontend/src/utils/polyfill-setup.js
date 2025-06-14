// Polyfill setup for browser compatibility with Node.js modules
import { Buffer } from 'buffer';

// Make Buffer available globally
window.Buffer = Buffer;

// Add process polyfill
window.process = {
  env: {},
  version: '',
  platform: 'browser',
  nextTick: (fn) => Promise.resolve().then(fn)
};

console.log('Polyfills loaded - Buffer and process are now available');
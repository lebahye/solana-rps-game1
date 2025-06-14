
// Enhanced polyfill setup for browser compatibility with Node.js modules
import { Buffer } from 'buffer';

// Make Buffer available globally
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
  window.global = window.global || window;
  
  // Add process polyfill
  window.process = window.process || {
    env: {},
    version: '',
    platform: 'browser',
    nextTick: (fn) => Promise.resolve().then(fn),
    cwd: () => '/',
    argv: []
  };

  console.log('✓ Polyfills loaded - Buffer and process are now available');
} else {
  console.warn('⚠ Window object not available - running in non-browser environment');
}

// Additional crypto polyfill for older browsers
if (typeof window !== 'undefined' && !window.crypto) {
  window.crypto = {
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }
  };
}

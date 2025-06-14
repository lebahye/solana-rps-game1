import './utils/polyfill-setup.js'; // Import polyfills first - this ensures Buffer and process are available

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/animations.css'; // Import animations CSS

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

// Log that main.tsx is loaded to verify the order
console.log('Main.tsx loaded - React application starting');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

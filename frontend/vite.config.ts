import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'buffer': 'buffer',
      'process': 'process/browser',
      'util': 'util',
      '@solana/web3.js': path.resolve(__dirname, 'node_modules/@solana/web3.js'),
      'rpc-websockets/dist/lib/client': path.resolve(__dirname, 'node_modules/rpc-websockets/dist/index.umd.js'),
      'rpc-websockets/dist/lib/client/websocket.browser': path.resolve(__dirname, 'node_modules/rpc-websockets/dist/index.umd.js'),
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
    include: [
      '@solana/web3.js',
      '@solana/wallet-adapter-base',
      '@solana/wallet-adapter-react',
      '@solana/wallet-adapter-phantom',
      '@solana/spl-token',
      'rpc-websockets',
      'buffer',
      'process/browser',
      'util'
    ],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'solana': ['@solana/web3.js'],
        },
      },
    },
  },
});

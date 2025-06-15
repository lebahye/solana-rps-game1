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
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
    include: [
      'buffer',
      'process/browser',
      '@solana/web3.js',
      'rpc-websockets',
    ],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      external: [
        'rpc-websockets/dist/lib/client',
        'rpc-websockets/dist/lib/client/websocket.browser'
      ],
      output: {
        globals: {
          'rpc-websockets/dist/lib/client': 'RpcWebSockets',
          'rpc-websockets/dist/lib/client/websocket.browser': 'RpcWebSockets'
        },
        manualChunks: {
          'solana': ['@solana/web3.js'],
        },
      },
    },
  },
});
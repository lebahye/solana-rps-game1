import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.solana
global.window.solana = {
  isPhantom: true,
  connect: vi.fn(),
  disconnect: vi.fn(),
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
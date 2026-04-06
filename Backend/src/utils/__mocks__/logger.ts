import { vi } from 'vitest';

const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    http: vi.fn(),
};

export const startTimer = vi.fn(() => () => 0);
export default logger;

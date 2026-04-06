import { defineConfig } from 'vitest/config';

process.env.NODE_ENV = 'test';

export default defineConfig({
    test: {
        name: 'core',
        include: ['src/__tests__/**/*.test.ts'],
        coverage: {
            enabled: true,
            provider: 'v8',
            reporter: ['text', 'lcov', 'html'],
            include: ['src/**/*.ts'],
            exclude: [
                'src/index.ts',
                'src/env.ts',
                'src/server.ts',
                'src/config/index.ts',
                'src/config/swagger.ts',
                'src/core/bot.ts',
                'src/core/database.ts',
                'src/core/crypto/**',
                'src/core/reencryption/reencryptionScheduler.ts',
                'src/utils/logger.ts',
                'src/utils/__mocks__/**',
                'src/api/middlewares/rateLimiter.ts',
                'src/api/middlewares/requestLogger.ts',
                'src/api/routes/index.ts',
                'src/api/routes/reencryption.routes.ts',
                'src/types/**/*.ts',
                'src/__tests__/**',
                'src/__mocks__/**',
            ],
            thresholds: {
                statements: 40,
                branches: 75,
                functions: 60,
                lines: 40,
            },
        },
    },
});

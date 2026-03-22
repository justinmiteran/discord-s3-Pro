import { vi } from 'vitest';

const mockFindUserByUsername = vi.fn();
const mockFindUserById = vi.fn();
const mockFindRefreshToken = vi.fn();
const mockSaveRefreshToken = vi.fn();
const mockDeleteRefreshToken = vi.fn();
const mockCountUsers = vi.fn();
const mockCreateUser = vi.fn();

vi.mock('../../../../repositories/userRepository.js', () => ({
    findUserByUsername: (...a: any[]) => mockFindUserByUsername(...a),
    findUserById: (...a: any[]) => mockFindUserById(...a),
    findRefreshToken: (...a: any[]) => mockFindRefreshToken(...a),
    saveRefreshToken: (...a: any[]) => mockSaveRefreshToken(...a),
    deleteRefreshToken: (...a: any[]) => mockDeleteRefreshToken(...a),
    countUsers: () => mockCountUsers(),
    createUser: (...a: any[]) => mockCreateUser(...a),
}));
vi.mock('../../../../config/index.js', () => ({
    security: { jwtSecret: 'test-secret-key-32-characters!!', encryptionKey: Buffer.alloc(32) },
    database: { type: 'mongodb', mongoUri: null, jsonPath: '' },
    server: { port: 3000, chunkSize: 8388608 },
    discord: { token: 'test', channels: [] },
    auth: { mongoUri: 'mongodb://localhost:27017/test' },
}));
vi.mock('../../../../utils/logger.js', () => ({
    default: {
        debug: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        fatal: vi.fn(),
        http: vi.fn(),
    },
}));

import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthError } from '../../../../utils/errors/AppError.js';
import { login, refresh, logout, initAdmin } from '../../../../core/auth/authService.js';

const HASH = await bcrypt.hash('password123', 4);
const FAKE_USER = {
    id: '507f1f77bcf86cd799439011',
    username: 'admin',
    passwordHash: HASH,
    createdAt: '',
};
const SECRET = 'test-secret-key-32-characters!!';

describe('authService.login', () => {
    beforeEach(() => vi.clearAllMocks());

    it('throws AuthError when user not found', async () => {
        mockFindUserByUsername.mockResolvedValue(null);
        await expect(login('admin', 'password123')).rejects.toThrow(AuthError);
        await expect(login('admin', 'password123')).rejects.toThrow('Invalid credentials');
    });

    it('throws AuthError when password is wrong', async () => {
        mockFindUserByUsername.mockResolvedValue(FAKE_USER);
        await expect(login('admin', 'wrongpassword')).rejects.toThrow(AuthError);
    });

    it('returns valid JWT tokens on success', async () => {
        mockFindUserByUsername.mockResolvedValue(FAKE_USER);
        mockSaveRefreshToken.mockResolvedValue(undefined);

        const result = await login('admin', 'password123');

        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');
        expect(typeof result.accessToken).toBe('string');
        expect(typeof result.refreshToken).toBe('string');

        const decoded = jwt.verify(result.accessToken, SECRET) as any;
        expect(decoded.sub).toBe(FAKE_USER.id);
        expect(decoded.username).toBe(FAKE_USER.username);
        expect(mockSaveRefreshToken).toHaveBeenCalledWith(
            expect.objectContaining({
                token: result.refreshToken,
                userId: FAKE_USER.id,
            }),
        );
    });
});

describe('authService.refresh', () => {
    beforeEach(() => vi.clearAllMocks());

    it('throws AuthError when token not found', async () => {
        mockFindRefreshToken.mockResolvedValue(null);
        await expect(refresh('unknown-token')).rejects.toThrow(AuthError);
        await expect(refresh('unknown-token')).rejects.toThrow('Invalid or expired refresh token');
    });

    it('throws AuthError when token is expired', async () => {
        mockFindRefreshToken.mockResolvedValue({
            token: 'tok',
            userId: '1',
            expiresAt: new Date(Date.now() - 1000),
        });
        mockDeleteRefreshToken.mockResolvedValue(undefined);

        await expect(refresh('tok')).rejects.toThrow(AuthError);
        expect(mockDeleteRefreshToken).toHaveBeenCalledWith('tok');
    });

    it('rotates refresh token and returns new tokens', async () => {
        mockFindRefreshToken.mockResolvedValue({
            token: 'old-token',
            userId: FAKE_USER.id,
            expiresAt: new Date(Date.now() + 100000),
        });
        mockFindUserById.mockResolvedValue(FAKE_USER);
        mockDeleteRefreshToken.mockResolvedValue(undefined);
        mockSaveRefreshToken.mockResolvedValue(undefined);

        const result = await refresh('old-token');

        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');
        expect(result.refreshToken).not.toBe('old-token');
        expect(mockDeleteRefreshToken).toHaveBeenCalledWith('old-token');
        expect(mockSaveRefreshToken).toHaveBeenCalledWith(
            expect.objectContaining({
                token: result.refreshToken,
                userId: FAKE_USER.id,
            }),
        );
    });

    it('throws AuthError when user no longer exists', async () => {
        mockFindRefreshToken.mockResolvedValue({
            token: 'tok',
            userId: 'deleted-user',
            expiresAt: new Date(Date.now() + 100000),
        });
        mockFindUserById.mockResolvedValue(null);

        await expect(refresh('tok')).rejects.toThrow(AuthError);
    });
});

describe('authService.logout', () => {
    it('deletes refresh token', async () => {
        mockDeleteRefreshToken.mockResolvedValue(undefined);
        await logout('some-token');
        expect(mockDeleteRefreshToken).toHaveBeenCalledWith('some-token');
    });
});

describe('authService.initAdmin', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.ADMIN_USERNAME;
        delete process.env.ADMIN_PASSWORD;
    });

    it('does nothing when users already exist', async () => {
        mockCountUsers.mockResolvedValue(1);
        await initAdmin();
        expect(mockCreateUser).not.toHaveBeenCalled();
    });

    it('throws when ADMIN_USERNAME is missing', async () => {
        mockCountUsers.mockResolvedValue(0);
        process.env.ADMIN_PASSWORD = 'password123';
        await expect(initAdmin()).rejects.toThrow('Missing admin credentials');
    });

    it('throws when ADMIN_PASSWORD is missing', async () => {
        mockCountUsers.mockResolvedValue(0);
        process.env.ADMIN_USERNAME = 'admin';
        await expect(initAdmin()).rejects.toThrow('Missing admin credentials');
    });

    it('creates admin user on first startup', async () => {
        mockCountUsers.mockResolvedValue(0);
        process.env.ADMIN_USERNAME = 'admin';
        process.env.ADMIN_PASSWORD = 'password123';
        mockCreateUser.mockResolvedValue(undefined);

        await initAdmin();

        expect(mockCreateUser).toHaveBeenCalledOnce();
        const createdUser = mockCreateUser.mock.calls[0][0];
        expect(createdUser.username).toBe('admin');
        expect(createdUser.passwordHash).toBeDefined();
        expect(createdUser.passwordHash).not.toBe('password123');
    });
});

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Db, ObjectId } from 'mongodb';

const mockCollection = {
    findOne: vi.fn(),
    insertOne: vi.fn(),
    countDocuments: vi.fn(),
    deleteOne: vi.fn(),
    createIndex: vi.fn(),
};

const mockDb = {
    collection: vi.fn(() => mockCollection),
} as unknown as Db;

vi.mock('../../../utils/logger.js');

import {
    initUserRepository,
    findUserByUsername,
    findUserById,
    createUser,
    countUsers,
    saveRefreshToken,
    findRefreshToken,
    deleteRefreshToken,
    createIndexes,
} from '../../../repositories/userRepository.js';

describe('userRepository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        initUserRepository(mockDb);
    });

    describe('initUserRepository', () => {
        it('initializes database connection', () => {
            expect(() => initUserRepository(mockDb)).not.toThrow();
        });
    });

    describe('findUserByUsername', () => {
        it('finds user by username', async () => {
            const mockUser = {
                _id: new ObjectId(),
                username: 'admin',
                passwordHash: 'hash123',
                createdAt: new Date().toISOString(),
            };
            mockCollection.findOne.mockResolvedValue(mockUser);

            const user = await findUserByUsername('admin');

            expect(user).toMatchObject({
                id: mockUser._id.toString(),
                username: 'admin',
            });
            expect(mockCollection.findOne).toHaveBeenCalledWith({ username: 'admin' });
        });

        it('returns null when user not found', async () => {
            mockCollection.findOne.mockResolvedValue(null);

            const user = await findUserByUsername('nonexistent');

            expect(user).toBeNull();
        });
    });

    describe('findUserById', () => {
        it('finds user by ID', async () => {
            const userId = new ObjectId();
            const mockUser = {
                _id: userId,
                username: 'admin',
                passwordHash: 'hash123',
                createdAt: new Date().toISOString(),
            };
            mockCollection.findOne.mockResolvedValue(mockUser);

            const user = await findUserById(userId.toString());

            expect(user).toMatchObject({
                id: userId.toString(),
                username: 'admin',
            });
            expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: userId });
        });

        it('returns null when user not found', async () => {
            mockCollection.findOne.mockResolvedValue(null);

            const user = await findUserById(new ObjectId().toString());

            expect(user).toBeNull();
        });
    });

    describe('createUser', () => {
        it('creates new user', async () => {
            const newUser = {
                username: 'newuser',
                passwordHash: 'hash456',
                createdAt: new Date().toISOString(),
            };
            mockCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() });

            await createUser(newUser);

            expect(mockCollection.insertOne).toHaveBeenCalledWith(newUser);
        });
    });

    describe('countUsers', () => {
        it('returns user count', async () => {
            mockCollection.countDocuments.mockResolvedValue(5);

            const count = await countUsers();

            expect(count).toBe(5);
            expect(mockCollection.countDocuments).toHaveBeenCalled();
        });

        it('returns 0 when no users exist', async () => {
            mockCollection.countDocuments.mockResolvedValue(0);

            const count = await countUsers();

            expect(count).toBe(0);
        });
    });

    describe('saveRefreshToken', () => {
        it('saves refresh token', async () => {
            const tokenData = {
                token: 'refresh-token-123',
                userId: 'user-id',
                expiresAt: new Date(Date.now() + 86400000),
            };
            mockCollection.insertOne.mockResolvedValue({ insertedId: 'token-id' });

            await saveRefreshToken(tokenData);

            expect(mockCollection.insertOne).toHaveBeenCalledWith(tokenData);
        });
    });

    describe('findRefreshToken', () => {
        it('finds refresh token', async () => {
            const mockToken = {
                token: 'refresh-token-123',
                userId: 'user-id',
                expiresAt: new Date(Date.now() + 86400000),
            };
            mockCollection.findOne.mockResolvedValue(mockToken);

            const token = await findRefreshToken('refresh-token-123');

            expect(token).toMatchObject({
                token: 'refresh-token-123',
                userId: 'user-id',
            });
            expect(mockCollection.findOne).toHaveBeenCalledWith({ token: 'refresh-token-123' });
        });

        it('returns null when token not found', async () => {
            mockCollection.findOne.mockResolvedValue(null);

            const token = await findRefreshToken('invalid-token');

            expect(token).toBeNull();
        });
    });

    describe('deleteRefreshToken', () => {
        it('deletes refresh token', async () => {
            mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

            await deleteRefreshToken('refresh-token-123');

            expect(mockCollection.deleteOne).toHaveBeenCalledWith({ token: 'refresh-token-123' });
        });
    });

    describe('createIndexes', () => {
        it('creates all required indexes', async () => {
            mockCollection.createIndex.mockResolvedValue('index-name');

            await createIndexes();

            expect(mockCollection.createIndex).toHaveBeenCalledTimes(3);
            expect(mockCollection.createIndex).toHaveBeenCalledWith(
                { username: 1 },
                { unique: true },
            );
            expect(mockCollection.createIndex).toHaveBeenCalledWith({ token: 1 }, { unique: true });
            expect(mockCollection.createIndex).toHaveBeenCalledWith(
                { expiresAt: 1 },
                { expireAfterSeconds: 0 },
            );
        });
    });
});

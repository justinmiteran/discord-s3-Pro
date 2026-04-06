import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { security } from '../../config/index.js';
import { AuthError, AppError } from '../../utils/errors/AppError.js';
import * as userRepo from '../../repositories/userRepository.js';
import logger from '../../utils/logger.js';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const login = async (username: string, password: string) => {
    const user = await userRepo.findUserByUsername(username);
    if (!user) throw new AuthError('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AuthError('Invalid credentials');

    const accessToken = jwt.sign({ sub: user.id, username: user.username }, security.jwtSecret, {
        algorithm: 'HS256',
        expiresIn: ACCESS_TOKEN_TTL,
    });

    const refreshToken = randomUUID();
    await userRepo.saveRefreshToken({
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    return { accessToken, refreshToken };
};

export const refresh = async (refreshToken: string) => {
    const stored = await userRepo.findRefreshToken(refreshToken);
    if (!stored || stored.expiresAt < new Date()) {
        if (stored) await userRepo.deleteRefreshToken(refreshToken);
        throw new AuthError('Invalid or expired refresh token');
    }

    const user = await userRepo.findUserById(stored.userId);
    if (!user) throw new AuthError('User not found');

    // Rotate: delete old token, issue a new one
    await userRepo.deleteRefreshToken(refreshToken);
    const newRefreshToken = randomUUID();
    await userRepo.saveRefreshToken({
        token: newRefreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    const accessToken = jwt.sign({ sub: user.id, username: user.username }, security.jwtSecret, {
        algorithm: 'HS256',
        expiresIn: ACCESS_TOKEN_TTL,
    });

    return { accessToken, refreshToken: newRefreshToken };
};

export const logout = async (refreshToken: string): Promise<void> => {
    await userRepo.deleteRefreshToken(refreshToken);
};

/**
 * Creates the default admin user on first startup if no users exist.
 * Credentials are read from env, then the env vars are no longer needed.
 */
export const initAdmin = async (): Promise<void> => {
    const count = await userRepo.countUsers();
    if (count > 0) return;

    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;

    if (!username || !password) {
        logger.fatal('ADMIN_USERNAME and ADMIN_PASSWORD must be set for first startup');
        throw new AppError('Missing admin credentials for initialization', 500, false);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await userRepo.createUser({ username, passwordHash, createdAt: new Date().toISOString() });
    logger.success('Default admin user created', { username });
};

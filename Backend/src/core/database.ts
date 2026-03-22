import logger from '../utils/logger.js';
import { database, auth } from '../config/index.js';
import { IRepository } from '../types/interfaces/repository.interface.js';
import { MongoClient } from 'mongodb';
import { getDb } from '../repositories/mongodbRepository.js';
import { initUserRepository, createIndexes } from '../repositories/userRepository.js';
import { initAdmin } from './auth/authService.js';
import { toError } from '../utils/errors/AppError.js';

let repository: IRepository | null = null;

const initAuth = async (): Promise<void> => {
    if (database.type === 'mongodb') {
        initUserRepository(getDb());
    } else {
        logger.info('Storage is JSON — connecting dedicated MongoDB for auth', {
            uri: auth.mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'),
        });
        const client = await MongoClient.connect(auth.mongoUri);
        initUserRepository(client.db());
    }
    await createIndexes();
    await initAdmin();
};

/**
 * Initializes the database repository based on configuration
 * Dynamically loads the appropriate repository implementation (MongoDB or JSON)
 * @throws Error if repository fails to load or connect
 */
export const initDatabase = async (): Promise<void> => {
    const startTime = Date.now();

    try {
        logger.info('Initializing database', {
            provider: database.type,
        });

        const module = await import(`../repositories/${database.type}Repository.js`);
        repository = module.default || module;

        if (!repository) {
            logger.fatal('Repository module failed to load', undefined, {
                provider: database.type,
            });
            throw new Error('Repository module exports nothing.');
        }

        await repository.connect();
        await initAuth();

        const duration = Date.now() - startTime;
        logger.success('Database initialized', {
            provider: database.type,
            connectionTime: duration,
        });
    } catch (err) {
        logger.fatal('Database initialization failed', toError(err), {
            provider: database.type,
            error: toError(err).message,
        });
        process.exit(1);
    }
};

/**
 * Returns the initialized repository instance
 * @returns The active repository instance
 * @throws Error if repository is not initialized
 */
export const getRepository = (): IRepository => {
    if (!repository) {
        logger.error('Repository not initialized', undefined, {
            action: 'getRepository',
        });
        throw new Error('Database repository not initialized');
    }
    return repository;
};

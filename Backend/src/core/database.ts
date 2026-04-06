import logger, { startTimer } from '../utils/logger.js';
import { database } from '../config/index.js';
import { IRepository } from '../types/interfaces/repository.interface.js';
import { getDb } from '../repositories/mongodbRepository.js';
import { initUserRepository, createIndexes } from '../repositories/userRepository.js';
import { initAdmin } from './auth/authService.js';
import { toError, DatabaseError } from '../utils/errors/AppError.js';

let repository: IRepository | null = null;

/**
 * Initializes the database repository (MongoDB only)
 * @throws Error if repository fails to load or connect
 */
export const initDatabase = async (): Promise<void> => {
    const elapsed = startTimer();

    try {
        logger.info('Initializing MongoDB database');

        const module = await import('../repositories/mongodbRepository.js');
        repository = module.default || module;

        if (!repository) {
            logger.fatal('MongoDB repository module failed to load');
            throw new DatabaseError('Repository module exports nothing.');
        }

        await repository.connect();
        
        initUserRepository(getDb());
        await createIndexes();
        await initAdmin();

        logger.success('Database initialized', {
            provider: 'mongodb',
            connectionTime: elapsed(),
        });
    } catch (err) {
        logger.fatal('Database initialization failed', toError(err), {
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
        throw new DatabaseError('Database repository not initialized');
    }
    return repository;
};

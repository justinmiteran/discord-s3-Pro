import logger from '../utils/logger.js';
import { database } from '../config/index.js';
import { IRepository } from '../types/interfaces/repository.interface.js';

let repository: IRepository | null = null;

/**
 * Initializes the database repository based on configuration
 * Dynamically loads the appropriate repository implementation (MongoDB or JSON)
 * @throws Error if repository fails to load or connect
 */
export const initDatabase = async (): Promise<void> => {
    const startTime = Date.now();
    
    try {
        logger.info('Initializing database', {
            provider: database.type
        });
        
        const module = await import(`../repositories/${database.type}Repository.js`);
        repository = module.default || module;

        if (!repository) {
            logger.fatal('Repository module failed to load', undefined, {
                provider: database.type
            });
            throw new Error('Repository module exports nothing.');
        }

        await repository.connect();
        
        const duration = Date.now() - startTime;
        logger.success('Database initialized', {
            provider: database.type,
            connectionTime: duration
        });
    } catch (err: any) {
        logger.fatal('Database initialization failed', err, {
            provider: database.type,
            error: err.message
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
            action: 'getRepository'
        });
        throw new Error('Database repository not initialized');
    }
    return repository;
};

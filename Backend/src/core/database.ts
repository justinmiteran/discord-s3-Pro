import logger from '../utils/logger.js';
import { dbType } from '../config.js';
import { IRepository } from '../types/index.js';

let repository: IRepository | null = null;

export const initDatabase = async (): Promise<void> => {
    try {
        // Dynamic loading of the repository based on type
        const module = await import(`../repositories/${dbType}Repository.js`);
        repository = module.default || module;

        if (!repository) throw new Error('Repository module exports nothing.');

        await repository.connect();
        logger.success(`Database initialized with provider: ${dbType}`);
    } catch (err: any) {
        logger.error(`Critical: Failed to load database provider [${dbType}]: ${err.message}`);
        process.exit(1);
    }
};

export const getRepository = (): IRepository => {
    if (!repository) throw new Error('Database repository not initialized');
    return repository;
};

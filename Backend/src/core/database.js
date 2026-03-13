const logger = require('../utils/logger');
const { dbType } = require('../config');

let repository = null;

const initDatabase = async () => {
    try {
        // Dynamic loading of the repository based on type
        repository = require(`../repositories/${dbType}Repository`);
        await repository.connect();
        logger.success(`Database initialized with provider: ${dbType}`);
    } catch (err) {
        logger.error(`Critical: Failed to load database provider [${dbType}]: ${err.message}`);
        process.exit(1);
    }
};

const getRepository = () => {
    if (!repository) throw new Error('Database repository not initialized');
    return repository;
};

module.exports = { initDatabase, getRepository };

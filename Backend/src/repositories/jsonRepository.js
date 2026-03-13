const fs = require('fs');
const path = require('path');
const { dbPath } = require('../config');
const logger = require('../utils/logger');

/**
 * Helper to read the JSON file safely
 */
const readRegistry = () => {
    if (!fs.existsSync(dbPath)) return {};
    try {
        const data = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        logger.error(`Error reading JSON registry: ${err.message}`);
        return {};
    }
};

/**
 * Helper to write to the JSON file
 */
const writeRegistry = (data) => {
    try {
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(dbPath, JSON.stringify(data, null, 4));
    } catch (err) {
        logger.error(`Error writing to JSON registry: ${err.message}`);
        throw err;
    }
};

// Interface implementation
exports.connect = async () => {
    logger.info(`JSON Repository active. Target: ${dbPath}`);
    // No persistent connection needed for JSON, but we check access
    if (!fs.existsSync(path.dirname(dbPath))) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
};

exports.saveFile = async (fileId, fileData) => {
    const registry = readRegistry();
    registry[fileId] = fileData;
    writeRegistry(registry);
};

exports.getFile = async (fileId) => {
    const registry = readRegistry();
    return registry[fileId] || null;
};

exports.listFiles = async () => {
    const registry = readRegistry();
    return Object.keys(registry).map((id) => ({
        _id: id,
        ...registry[id],
    }));
};

exports.deleteFile = async (fileId) => {
    const registry = readRegistry();
    delete registry[fileId];
    writeRegistry(registry);
};

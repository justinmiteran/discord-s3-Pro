const crypto = require('crypto');
const fs = require('fs');

const logger = require('./logger');
const { Transform } = require('stream');

/**
 * Generates a SHA-256 checksum for a file to ensure data integrity.
 * @param {string} path - The absolute path to the file.
 * @returns {Promise<string>} - The hex-encoded hash string.
 */
exports.calculateHash = (path) =>
    new Promise((resolve, reject) => {
        const startTime = Date.now();
        const hash = crypto.createHash('sha256');
        const input = fs.createReadStream(path);

        logger.info(`Calculating SHA-256 hash for integrity check...`);

        input.on('error', (err) => {
            logger.error(`Hash calculation failed: ${err.message}`);
            reject(err);
        });

        // We use the 'data' event to update the hash chunk by chunk
        input.on('data', (chunk) => {
            hash.update(chunk);
        });

        input.on('end', () => {
            const fileHash = hash.digest('hex');
            const duration = Date.now() - startTime;

            logger.success(`Hash generated: ${fileHash.substring(0, 10)}... (Took ${duration}ms)`);
            resolve(fileHash);
        });
    });

/**
 * Creates a Transform stream that calculates SHA-256 on the fly.
 * It verifies the result against the storedHash when the stream finishes.
 */
exports.createVerificationStream = (storedHash, fileName) => {
    const hash = crypto.createHash('sha256');

    return new Transform({
        transform(chunk, encoding, callback) {
            hash.update(chunk);
            callback(null, chunk);
        },
        flush(callback) {
            const finalHash = hash.digest('hex');
            if (finalHash === storedHash) {
                logger.success(`Integrity verified for ${fileName}`);
            } else {
                logger.error(`CORRUPTION DETECTED: ${fileName}`);
                logger.error(`Expected: ${storedHash} | Got: ${finalHash}`);
            }
            callback();
        },
    });
};

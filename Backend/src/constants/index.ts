/**
 * Application-wide constants
 */

export const HTTP_STATUS = {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500,
} as const;

export const ERROR_CODES = {
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    CHUNK_LOST: 'CHUNK_LOST',
    INVALID_PATH: 'INVALID_PATH',
    DB_NOT_INITIALIZED: 'DB_NOT_INITIALIZED',
    NO_CHANNELS: 'NO_CHANNELS',
} as const;

export const DISCORD_ERROR_CODES = {
    MESSAGE_NOT_FOUND: 10008,
} as const;

export const ENCRYPTION = {
    ALGORITHM: 'aes-256-gcm',
    IV_LENGTH: 16,
    AUTH_TAG_LENGTH: 16,
    KEY_LENGTH: 32,
} as const;

export const QUEUE = {
    RATE_LIMIT_DELAY: 200,
} as const;

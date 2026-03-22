/**
 * Base application error class
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Normalizes any caught value into an Error instance
 */
export const toError = (err: unknown): Error => {
    if (err instanceof Error) return err;
    return new Error(String(err));
};

/**
 * Error for authentication failures (401)
 */
export class AuthError extends AppError {
    constructor(message: string) {
        super(message, 401);
    }
}

/**
 * Error for resource not found (404)
 */
export class NotFoundError extends AppError {
    constructor(resource: string) {
        super(`${resource} not found`, 404);
    }
}

/**
 * Error for validation failures (400)
 */
export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 400);
    }
}

/**
 * Error for database operations (500)
 */
export class DatabaseError extends AppError {
    constructor(message: string) {
        super(`Database error: ${message}`, 500);
    }
}

/**
 * Error for Discord API operations (503)
 */
export class DiscordError extends AppError {
    constructor(message: string) {
        super(`Discord API error: ${message}`, 503);
    }
}

/**
 * Error for encryption/decryption failures (500)
 */
export class EncryptionError extends AppError {
    constructor(message: string) {
        super(`Encryption error: ${message}`, 500);
    }
}

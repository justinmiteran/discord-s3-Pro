/**
 * Sensitive data sanitizer for logs
 * Masks passwords, tokens, keys, and other sensitive information
 */

/**
 * List of sensitive field names to sanitize
 */
const SENSITIVE_FIELDS = [
    'password',
    'passwordHash',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'encryptionKey',
    'jwtSecret',
    'authorization',
    'cookie',
    'session',
    'privateKey',
    'publicKey',
    'credentials',
    'auth',
    'key', // Catches apiKey, publicKey, privateKey, etc.
] as const;

/**
 * Patterns to detect sensitive data in strings
 */
const SENSITIVE_PATTERNS = [
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, // JWT tokens
    /\b[A-Za-z0-9]{32,}\b/g, // Long alphanumeric strings (likely tokens/keys)
] as const;

/**
 * Mask for sensitive data
 */
const MASK = '***REDACTED***';

/**
 * Checks if a field name is sensitive
 */
const isSensitiveField = (key: string): boolean => {
    const lowerKey = key.toLowerCase();
    return SENSITIVE_FIELDS.some((field) => lowerKey.includes(field));
};

/**
 * Masks sensitive string values
 */
const maskSensitiveString = (value: string): string => {
    let masked = value;
    for (const pattern of SENSITIVE_PATTERNS) {
        masked = masked.replace(pattern, MASK);
    }
    return masked;
};

/**
 * Recursively sanitizes an object by masking sensitive fields
 */
export const sanitize = (data: any): any => {
    if (data === null || data === undefined) {
        return data;
    }

    // Handle primitive types
    if (typeof data !== 'object') {
        return typeof data === 'string' ? maskSensitiveString(data) : data;
    }

    // Handle arrays
    if (Array.isArray(data)) {
        return data.map((item) => sanitize(item));
    }

    // Handle objects
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
        if (isSensitiveField(key)) {
            sanitized[key] = MASK;
        } else if (value === null || value === undefined) {
            sanitized[key] = value;
        } else if (typeof value === 'object') {
            sanitized[key] = sanitize(value);
        } else if (typeof value === 'string') {
            sanitized[key] = maskSensitiveString(value);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
};

/**
 * Sanitizes HTTP headers by masking authorization and cookie headers
 */
export const sanitizeHeaders = (headers: Record<string, any>): Record<string, any> => {
    const sanitized = { ...headers };
    
    if (sanitized.authorization) {
        sanitized.authorization = MASK;
    }
    if (sanitized.cookie) {
        sanitized.cookie = MASK;
    }
    if (sanitized.Authorization) {
        sanitized.Authorization = MASK;
    }
    if (sanitized.Cookie) {
        sanitized.Cookie = MASK;
    }

    return sanitized;
};

/**
 * Sanitizes error objects to prevent sensitive data in stack traces
 */
export const sanitizeError = (error: Error): { message: string; stack?: string } => {
    return {
        message: maskSensitiveString(error.message),
        stack: error.stack ? maskSensitiveString(error.stack) : undefined,
    };
};

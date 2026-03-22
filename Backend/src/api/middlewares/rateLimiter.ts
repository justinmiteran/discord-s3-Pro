import rateLimit from 'express-rate-limit';

const rateLimitMessage = (max: number, windowMin: number) => ({
    success: false,
    error: {
        message: `Too many requests — limit is ${max} requests per ${windowMin} minute(s)`,
        statusCode: 429,
    },
});

export const globalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitMessage(120, 1),
});

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitMessage(10, 15),
});

export const uploadLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitMessage(20, 1),
});

import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '../../utils/errors/AppError.js';

type Target = 'body' | 'params';

export const validate =
    (schema: ZodSchema, target: Target = 'body') =>
    (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req[target]);
        if (!result.success) {
            const message = result.error.issues
                .map((e) => `${e.path.join('.')}: ${e.message}`)
                .join(', ');
            return next(new ValidationError(message));
        }
        req[target] = result.data;
        next();
    };

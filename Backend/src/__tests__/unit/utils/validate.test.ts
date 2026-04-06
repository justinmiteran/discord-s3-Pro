import { vi } from 'vitest';
import { mockConfig } from '../../helpers/standardMocks.js';

vi.mock('../../../config/index.js', () => mockConfig);
vi.mock('../../../utils/logger.js');

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validate } from '../../../api/middlewares/validate.js';
import { ValidationError } from '../../../utils/errors/AppError.js';
import type { Request, Response, NextFunction } from 'express';

const mockReq = (body = {}, params = {}) => ({ body, params }) as unknown as Request;
const mockRes = () => ({}) as Response;

describe('validate middleware', () => {
    describe('body validation', () => {
        const schema = z.object({
            name: z.string().min(1),
            age: z.number(),
        });

        it('calls next() with valid body', () => {
            const next = vi.fn() as NextFunction;
            validate(schema)(mockReq({ name: 'Alice', age: 30 }), mockRes(), next);
            expect(next).toHaveBeenCalledWith();
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('calls next(ValidationError) with invalid body', () => {
            const next = vi.fn() as NextFunction;
            validate(schema)(mockReq({ name: '', age: 'bad' }), mockRes(), next);

            const err = (next as any).mock.calls[0][0];
            expect(err).toBeInstanceOf(ValidationError);
            expect(err.statusCode).toBe(400);
            expect(err.message).toContain('name');
        });

        it('replaces req.body with parsed data', () => {
            const next = vi.fn() as NextFunction;
            const req = mockReq({ name: 'Bob', age: 25 });
            validate(schema)(req, mockRes(), next);
            expect(req.body).toEqual({ name: 'Bob', age: 25 });
        });

        it('handles multiple validation errors', () => {
            const next = vi.fn() as NextFunction;
            validate(schema)(mockReq({ name: '', age: 'invalid' }), mockRes(), next);

            const err = (next as any).mock.calls[0][0];
            expect(err).toBeInstanceOf(ValidationError);
            expect(err.message).toContain('name');
            expect(err.message).toContain('age');
        });
    });

    describe('params validation', () => {
        const paramSchema = z.object({ id: z.string().min(1) });

        it('validates params when target is params', () => {
            const next = vi.fn() as NextFunction;
            validate(paramSchema, 'params')(mockReq({}, { id: 'abc' }), mockRes(), next);
            expect(next).toHaveBeenCalledWith();
        });

        it('calls next(ValidationError) with invalid params', () => {
            const next = vi.fn() as NextFunction;
            validate(paramSchema, 'params')(mockReq({}, { id: '' }), mockRes(), next);

            const err = (next as any).mock.calls[0][0];
            expect(err).toBeInstanceOf(ValidationError);
        });
    });

    describe('complex schemas', () => {
        const nestedSchema = z.object({
            user: z.object({
                name: z.string().min(1),
                email: z.string().email(),
            }),
            settings: z.object({
                notifications: z.boolean(),
                theme: z.enum(['light', 'dark']),
            }),
        });

        it('validates nested objects correctly', () => {
            const next = vi.fn() as NextFunction;
            const validData = {
                user: { name: 'Alice', email: 'alice@example.com' },
                settings: { notifications: true, theme: 'dark' },
            };

            validate(nestedSchema)(mockReq(validData), mockRes(), next);
            expect(next).toHaveBeenCalledWith();
        });

        it('catches errors in nested objects', () => {
            const next = vi.fn() as NextFunction;
            const invalidData = {
                user: { name: '', email: 'invalid-email' },
                settings: { notifications: true, theme: 'invalid' },
            };

            validate(nestedSchema)(mockReq(invalidData), mockRes(), next);

            const err = (next as any).mock.calls[0][0];
            expect(err).toBeInstanceOf(ValidationError);
            expect(err.message).toContain('user');
        });
    });

    describe('optional fields', () => {
        const optionalSchema = z.object({
            required: z.string(),
            optional: z.string().optional(),
        });

        it('accepts missing optional fields', () => {
            const next = vi.fn() as NextFunction;
            validate(optionalSchema)(mockReq({ required: 'value' }), mockRes(), next);
            expect(next).toHaveBeenCalledWith();
        });

        it('validates optional fields when present', () => {
            const next = vi.fn() as NextFunction;
            validate(optionalSchema)(
                mockReq({ required: 'value', optional: 123 }),
                mockRes(),
                next,
            );

            const err = (next as any).mock.calls[0][0];
            expect(err).toBeInstanceOf(ValidationError);
        });
    });
});

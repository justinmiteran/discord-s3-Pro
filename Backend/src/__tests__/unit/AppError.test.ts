import { vi } from 'vitest';
import { mockConfig, mockLogger } from '../helpers/standardMocks.js';

vi.mock('../../config/index.js', () => mockConfig);
vi.mock('../../utils/logger.js', () => mockLogger);

import { describe, it, expect } from 'vitest';
import {
    AppError,
    AuthError,
    ValidationError,
    NotFoundError,
    DatabaseError,
    DiscordError,
    EncryptionError,
    toError,
} from '../../utils/errors/AppError.js';

describe('AppError', () => {
    it('creates operational error with correct properties', () => {
        const err = new AppError('test', 418);
        expect(err.message).toBe('test');
        expect(err.statusCode).toBe(418);
        expect(err.isOperational).toBe(true);
        expect(err).toBeInstanceOf(Error);
        expect(err.stack).toBeDefined();
    });

    it('defaults to 500 status code', () => {
        expect(new AppError('x').statusCode).toBe(500);
    });
});

describe('Error subclasses', () => {
    it.each([
        ['AuthError', new AuthError('Unauthorized'), 401],
        ['ValidationError', new ValidationError('Invalid data'), 400],
        ['NotFoundError', new NotFoundError('File'), 404],
        ['DatabaseError', new DatabaseError('Connection failed'), 500],
        ['DiscordError', new DiscordError('API error'), 503],
        ['EncryptionError', new EncryptionError('Decryption failed'), 500],
    ])('%s has correct statusCode %i', (name, err, code) => {
        expect(err.statusCode).toBe(code);
        expect(err).toBeInstanceOf(AppError);
        expect(err.isOperational).toBe(true);
    });

    it('NotFoundError formats message correctly', () => {
        expect(new NotFoundError('File').message).toBe('File not found');
        expect(new NotFoundError('User').message).toBe('User not found');
    });
});

describe('toError', () => {
    it('returns Error instance unchanged', () => {
        const err = new Error('original');
        expect(toError(err)).toBe(err);
    });

    it('wraps string into Error', () => {
        const err = toError('something went wrong');
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('something went wrong');
    });

    it('wraps null into Error', () => {
        expect(toError(null).message).toBe('null');
    });

    it('wraps undefined into Error', () => {
        expect(toError(undefined).message).toBe('undefined');
    });

    it('wraps object into Error with string representation', () => {
        const err = toError({ code: 42, msg: 'fail' });
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('[object Object]');
    });
});

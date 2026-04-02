import { describe, it, expect } from 'vitest';
import { sanitize, sanitizeHeaders, sanitizeError } from '../../../utils/sanitizer.js';

describe('Sanitizer', () => {
    describe('sanitize', () => {
        it('should mask password fields', () => {
            const data = {
                username: 'admin',
                password: 'secret123',
                email: 'admin@example.com',
            };

            const result = sanitize(data);

            expect(result.username).toBe('admin');
            expect(result.password).toBe('***REDACTED***');
            expect(result.email).toBe('admin@example.com');
        });

        it('should mask token fields', () => {
            const data = {
                accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
                refreshToken: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                userId: '12345',
            };

            const result = sanitize(data);

            expect(result.accessToken).toBe('***REDACTED***');
            expect(result.refreshToken).toBe('***REDACTED***');
            expect(result.userId).toBe('12345');
        });

        it('should mask nested sensitive fields', () => {
            const data = {
                user: {
                    username: 'admin',
                    passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyz',
                },
                auth: {
                    token: 'abc123xyz',
                },
            };

            const result = sanitize(data);

            expect(result.user.username).toBe('admin');
            expect(result.user.passwordHash).toBe('***REDACTED***');
            expect(result.auth).toBe('***REDACTED***'); // 'auth' is a sensitive field name
        });

        it('should mask Bearer tokens in strings', () => {
            const data = {
                message: 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
            };

            const result = sanitize(data);

            expect(result.message).toContain('***REDACTED***');
            expect(result.message).not.toContain('Bearer eyJ');
        });

        it('should handle arrays', () => {
            const data = {
                users: [
                    { username: 'user1', password: 'pass1' },
                    { username: 'user2', password: 'pass2' },
                ],
            };

            const result = sanitize(data);

            expect(result.users[0].password).toBe('***REDACTED***');
            expect(result.users[1].password).toBe('***REDACTED***');
            expect(result.users[0].username).toBe('user1');
        });

        it('should handle null and undefined', () => {
            expect(sanitize(null)).toBe(null);
            expect(sanitize(undefined)).toBe(undefined);
            expect(sanitize({ value: null })).toEqual({ value: null });
        });

        it('should mask encryption keys', () => {
            const data = {
                encryptionKey: 'abcdefghijklmnopqrstuvwxyz123456',
                jwtSecret: 'my-super-secret-jwt-key',
            };

            const result = sanitize(data);

            expect(result.encryptionKey).toBe('***REDACTED***');
            expect(result.jwtSecret).toBe('***REDACTED***');
        });

        it('should mask API keys', () => {
            const data = {
                apiKey: 'sk_test_1234567890abcdefghijklmnop',
                publicKey: 'pk_test_abcdefghijklmnop',
            };

            const result = sanitize(data);

            // These are masked because field names contain 'key'
            expect(result.apiKey).toBe('***REDACTED***');
            expect(result.publicKey).toBe('***REDACTED***');
        });

        it('should preserve non-sensitive data', () => {
            const data = {
                id: '12345',
                name: 'Test User',
                email: 'test@example.com',
                age: 30,
                active: true,
            };

            const result = sanitize(data);

            expect(result).toEqual(data);
        });
    });

    describe('sanitizeHeaders', () => {
        it('should mask authorization header', () => {
            const headers = {
                'content-type': 'application/json',
                authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
                'user-agent': 'Mozilla/5.0',
            };

            const result = sanitizeHeaders(headers);

            expect(result.authorization).toBe('***REDACTED***');
            expect(result['content-type']).toBe('application/json');
            expect(result['user-agent']).toBe('Mozilla/5.0');
        });

        it('should mask cookie header', () => {
            const headers = {
                cookie: 'session=abc123; token=xyz789',
                host: 'localhost:3000',
            };

            const result = sanitizeHeaders(headers);

            expect(result.cookie).toBe('***REDACTED***');
            expect(result.host).toBe('localhost:3000');
        });

        it('should handle case-insensitive headers', () => {
            const headers = {
                Authorization: 'Bearer token123',
                Cookie: 'session=abc',
            };

            const result = sanitizeHeaders(headers);

            expect(result.Authorization).toBe('***REDACTED***');
            expect(result.Cookie).toBe('***REDACTED***');
        });
    });

    describe('sanitizeError', () => {
        it('should mask Bearer tokens in error messages', () => {
            const error = new Error('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload');

            const result = sanitizeError(error);

            expect(result.message).toContain('***REDACTED***');
            expect(result.message).not.toContain('Bearer eyJ');
        });

        it('should mask Bearer tokens in stack traces', () => {
            const error = new Error('Auth failed');
            error.stack = 'Error: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload\n    at auth';

            const result = sanitizeError(error);

            expect(result.stack).toContain('***REDACTED***');
            expect(result.stack).not.toContain('Bearer eyJ');
        });

        it('should handle errors without stack traces', () => {
            const error = new Error('Simple error');
            delete error.stack;

            const result = sanitizeError(error);

            expect(result.message).toBe('Simple error');
            expect(result.stack).toBeUndefined();
        });
    });
});

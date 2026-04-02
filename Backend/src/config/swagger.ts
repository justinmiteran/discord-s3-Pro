import swaggerJsdoc from 'swagger-jsdoc';
import { server } from './index.js';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Discord S3 Pro API',
            version: '1.0.0',
            description: 'A professional-grade, decentralized cloud storage solution that leverages Discord\'s infrastructure as a storage backend.',
            contact: {
                name: 'API Support',
            },
            license: {
                name: 'MIT',
            },
        },
        servers: [
            {
                url: `http://localhost:${server.port}`,
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT access token obtained from /auth/login',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error message',
                        },
                        code: {
                            type: 'string',
                            description: 'Error code',
                        },
                    },
                },
                FileDTO: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'Unique file identifier',
                            example: 'a7f2b3c4',
                        },
                        name: {
                            type: 'string',
                            description: 'Original filename',
                            example: 'document.pdf',
                        },
                        size: {
                            type: 'number',
                            description: 'File size in bytes',
                            example: 1048576,
                        },
                        date: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Upload timestamp',
                            example: '2024-01-01T00:00:00.000Z',
                        },
                        chunkCount: {
                            type: 'number',
                            description: 'Number of chunks stored on Discord',
                            example: 3,
                        },
                    },
                },
                AuthTokens: {
                    type: 'object',
                    properties: {
                        accessToken: {
                            type: 'string',
                            description: 'JWT access token (expires in 15 minutes)',
                        },
                        refreshToken: {
                            type: 'string',
                            description: 'JWT refresh token (expires in 7 days)',
                        },
                    },
                },
            },
        },
        tags: [
            {
                name: 'Health',
                description: 'System health and status endpoints',
            },
            {
                name: 'Authentication',
                description: 'User authentication and session management',
            },
            {
                name: 'Files',
                description: 'File upload, download, and management operations',
            },
        ],
    },
    apis: ['./src/api/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

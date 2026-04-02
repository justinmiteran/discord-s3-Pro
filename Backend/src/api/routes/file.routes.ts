import path from 'path';
import express, { Router, Request, Response, NextFunction } from 'express';
import { Client } from 'discord.js';
import * as storage from '../../core/storage/storageEngine.js';
import * as deleter from '../../core/storage/deleter.js';
import logger from '../../utils/logger.js';
import { getRepository } from '../../core/database.js';
import FileDTO from '../../types/dto/fileDto.js';
import { HTTP_STATUS } from '../../constants/index.js';
import { validate } from '../middlewares/validate.js';
import { uploadSchema, fileIdSchema } from '../validation/schemas.js';

/**
 * Creates file management routes
 * @param client - Discord bot client instance
 * @returns Configured router
 */
export const createFileRoutes = (client: Client): Router => {
    const router = Router();

    /**
     * @openapi
     * /list:
     *   get:
     *     tags:
     *       - Files
     *     summary: List all files
     *     description: Retrieve metadata for all stored files
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: List of files
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/FileDTO'
     *       401:
     *         description: Unauthorized - Invalid or missing token
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/list', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const repo = getRepository();
            const rawFiles = await repo.listFiles();
            const dtos = await FileDTO.fromList(rawFiles, (id) => repo.getChunkRegistry(id));
            res.json(dtos);
        } catch (err) {
            next(err);
        }
    });

    /**
     * @openapi
     * /upload:
     *   post:
     *     tags:
     *       - Files
     *     summary: Upload a file
     *     description: |
     *       Upload a file to Discord storage. The file will be:
     *       - Hashed (SHA-256) for deduplication
     *       - Compressed (gzip)
     *       - Encrypted (AES-256-GCM)
     *       - Chunked (8MB chunks)
     *       - Stored across Discord channels
     *       
     *       If the file hash already exists, it will be deduplicated (instant upload).
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - filePath
     *             properties:
     *               filePath:
     *                 type: string
     *                 description: Absolute path to the file on the server
     *                 example: C:\\Users\\user\\file.zip
     *     responses:
     *       200:
     *         description: Upload successful
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 id:
     *                   type: string
     *                   description: Unique file identifier
     *                   example: a7f2b3c4
     *                 url:
     *                   type: string
     *                   description: Download URL
     *                   example: /download/a7f2b3c4
     *       400:
     *         description: Invalid request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       413:
     *         description: File size exceeds maximum allowed limit
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       429:
     *         description: Rate limit exceeded
     */
    router.post(
        '/upload',
        express.json(),
        validate(uploadSchema),
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const { filePath } = req.body;
                const fileName = path.basename(filePath);
                const fileId = await storage.processUpload(client, filePath, fileName);
                res.json({ success: true, id: fileId, url: `/download/${fileId}` });
            } catch (err) {
                next(err);
            }
        },
    );

    /**
     * @openapi
     * /download/{id}:
     *   get:
     *     tags:
     *       - Files
     *     summary: Download a file
     *     description: |
     *       Download and reconstruct a file from Discord storage. The file will be:
     *       - Retrieved from Discord channels
     *       - Decrypted (AES-256-GCM)
     *       - Decompressed (gzip)
     *       - Verified (SHA-256 hash check)
     *       - Streamed to the client
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Unique file identifier
     *         example: a7f2b3c4
     *     responses:
     *       200:
     *         description: File download stream
     *         content:
     *           application/octet-stream:
     *             schema:
     *               type: string
     *               format: binary
     *         headers:
     *           Content-Disposition:
     *             schema:
     *               type: string
     *             description: Attachment with original filename
     *       404:
     *         description: File not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get(
        '/download/:id',
        validate(fileIdSchema, 'params'),
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                await storage.downloadFile(client, req.params.id as string, res);
            } catch (err) {
                next(err);
            }
        },
    );

    /**
     * @openapi
     * /file/{id}:
     *   delete:
     *     tags:
     *       - Files
     *     summary: Delete a file
     *     description: |
     *       Delete a file and its associated chunks from Discord storage.
     *       Uses reference counting for deduplication:
     *       - If refCount > 1: Only file metadata is deleted
     *       - If refCount = 1: File metadata AND Discord chunks are deleted
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Unique file identifier
     *         example: a7f2b3c4
     *     responses:
     *       200:
     *         description: File deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 message:
     *                   type: string
     *                   example: File document.pdf removed.
     *       404:
     *         description: File not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.delete(
        '/file/:id',
        validate(fileIdSchema, 'params'),
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const fileName = await deleter.deleteFile(client, req.params.id as string);
                res.json({ success: true, message: `File ${fileName} removed.` });
            } catch (err) {
                next(err);
            }
        },
    );

    return router;
};

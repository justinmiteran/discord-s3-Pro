import path from 'path';
import express, { Router, Request, Response, NextFunction } from 'express';
import { Client } from 'discord.js';
import * as storage from '../../core/storage/storageEngine.js';
import * as deleter from '../../core/storage/deleter.js';
import logger from '../../utils/logger.js';
import { getRepository } from '../../core/database.js';
import FileDTO from '../../types/dto/fileDto.js';
import { HTTP_STATUS } from '../../constants/index.js';
import { ValidationError } from '../../utils/errors/AppError.js';

/**
 * Creates file management routes
 * @param client - Discord bot client instance
 * @returns Configured router
 */
export const createFileRoutes = (client: Client): Router => {
    const router = Router();

    /**
     * GET /list - Retrieve all stored files
     */
    router.get('/list', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const repo = getRepository();
            const rawFiles = await repo.listFiles();
            res.json(FileDTO.fromList(rawFiles));
        } catch (err) {
            next(err);
        }
    });

    /**
     * POST /upload - Upload a new file
     * Body: { filePath: string }
     */
    router.post('/upload', express.json(), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { filePath } = req.body;
            if (typeof filePath !== 'string' || !filePath) {
                throw new ValidationError('Invalid or missing filePath');
            }

            const fileName = path.basename(filePath);
            const fileId = await storage.processUpload(client, filePath, fileName);

            res.json({
                success: true,
                id: fileId,
                url: `/download/${fileId}`,
            });
        } catch (err) {
            next(err);
        }
    });

    /**
     * GET /download/:id - Download a file by ID
     */
    router.get('/download/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const fileId = req.params.id as string;
            await storage.downloadFile(client, fileId, res);
        } catch (err) {
            next(err);
        }
    });

    /**
     * DELETE /file/:id - Delete a file by ID
     */
    router.delete('/file/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const fileId = req.params.id as string;
            const fileName = await deleter.deleteFile(client, fileId);
            res.json({ success: true, message: `File ${fileName} removed.` });
        } catch (err) {
            next(err);
        }
    });

    return router;
};

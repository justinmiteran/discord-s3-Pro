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

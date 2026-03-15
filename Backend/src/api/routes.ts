import path from 'path';
import express, { Router, Request, Response } from 'express'; // Added 'express' import
import { Client } from 'discord.js';
import * as storage from '../core/storageEngine.js';
import * as deleter from '../core/deleter.js';
import logger from '../utils/logger.js';
import { getRepository } from '../core/database.js';
import FileDTO from '../types/fileDto.js';

export default (client: Client): Router => {
    const router = Router();

    router.get('/status', (req: Request, res: Response) => {
        res.json({ status: 'online', bot: client.user?.tag || 'Ready' });
    });

    router.get('/list', async (req: Request, res: Response) => {
        try {
            const repo = getRepository();
            const rawFiles = await repo.listFiles();
            res.json(FileDTO.fromList(rawFiles));
        } catch (err: any) {
            logger.error(`API List Error: ${err.message}`);
            res.status(500).json({ error: 'Failed to retrieve file list' });
        }
    });

    // Use express.json() correctly and handle params as strict strings
    router.post('/upload', express.json(), async (req: Request, res: Response) => {
        try {
            const { filePath } = req.body;
            if (typeof filePath !== 'string') {
                return res.status(400).json({ error: 'Invalid or missing filePath' });
            }

            const fileName = path.basename(filePath);
            const fileId = await storage.processUpload(client, filePath, fileName);

            res.json({
                success: true,
                id: fileId,
                url: `/download/${fileId}`,
            });
        } catch (err: any) {
            logger.error(`Upload failed: ${err.message}`);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.get('/download/:id', async (req: Request, res: Response) => {
        try {
            const fileId = req.params.id as string; // Strict casting
            await storage.downloadFile(client, fileId, res);
        } catch (err: any) {
            logger.error(`Download Error: ${err.message}`);
            if (!res.headersSent) {
                const status = err.message === 'FILE_NOT_FOUND' ? 404 : 500;
                res.status(status).send(err.message);
            }
        }
    });

    router.delete('/file/:id', async (req: Request, res: Response) => {
        try {
            const fileId = req.params.id as string; // Strict casting
            const fileName = await deleter.deleteFile(client, fileId);
            res.json({ success: true, message: `File ${fileName} removed.` });
        } catch (err: any) {
            logger.error(`Deletion Error: ${err.message}`);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    return router;
};

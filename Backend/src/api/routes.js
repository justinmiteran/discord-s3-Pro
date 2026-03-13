const path = require('path');
const fs = require('fs');

const express = require('express');
const router = express.Router();

const storage = require('../core/storageEngine');
const deleter = require('../core/deleter');
const logger = require('../utils/logger');
const { getRepository } = require('../core/database');

module.exports = (client) => {
    // --- ROUTES ---

    router.get('/status', (req, res) => {
        res.json({ status: 'online', bot: client.user?.tag || 'Prêt' });
    });

    router.get('/list', async (req, res) => {
        try {
            const repo = getRepository();
            const files = await repo.listFiles();
            res.json(files);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/upload', express.json(), async (req, res) => {
        const { filePath } = req.body;

        try {
            if (!filePath || !fs.existsSync(filePath)) {
                return res.status(400).json({ success: false, error: 'INVALID_PATH' });
            }

            const fileName = path.basename(filePath);
            const fileId = await storage.processUpload(client, filePath, fileName);

            res.json({
                success: true,
                id: fileId,
                url: `http://localhost:3000/download/${fileId}`,
            });
        } catch (err) {
            logger.error(`Upload pipeline failed: ${err.stack}`);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.get('/download/:id', async (req, res) => {
        try {
            await storage.downloadFile(client, req.params.id, res);
        } catch (err) {
            logger.error(`Download Error: ${err.message}`);
            if (!res.headersSent) {
                const status = err.message === 'FILE_NOT_FOUND' ? 404 : 500;
                res.status(status).send(err.message);
            }
        }
    });

    router.delete('/file/:id', async (req, res) => {
        try {
            const fileName = await deleter.deleteFile(client, req.params.id);

            logger.success(`Successfully deleted ${fileName}`);
            res.json({ success: true, message: `File ${fileName} removed.` });
        } catch (err) {
            const status = err.message === 'FILE_NOT_FOUND' ? 404 : 500;
            res.status(status).json({ error: err.message });
        }
    });

    return router;
};

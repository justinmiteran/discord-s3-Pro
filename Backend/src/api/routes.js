const path = require('path');
const fs = require('fs');

const express = require('express');
const router = express.Router();

const storage = require('../core/storageEngine');
const deleter = require('../core/deleter');
const { dbPath } = require('../config');
const logger = require('../utils/logger');

module.exports = (client) => {
    // --- ROUTES ---

    router.get('/status', (req, res) => {
        res.json({ status: 'online', bot: client.user?.tag || 'Prêt' });
    });

    router.get('/list', (req, res) => {
        try {
            if (fs.existsSync(dbPath)) {
                const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                res.json(data);
            } else {
                res.json({});
            }
        } catch (err) {
            logger.error(`Failed to read registry: ${err.message}`);
            res.status(500).json({ success: false, error: 'Database read error' });
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

import fs from 'fs';
import path from 'path';
import { dbPath } from '../config.js';
import logger from '../utils/logger.js';
import { IRepository, FileData } from '../types/index.js';

const readRegistry = (): Record<string, Omit<FileData, 'id'>> => {
    if (!fs.existsSync(dbPath)) return {};
    try {
        return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch {
        return {};
    }
};

const writeRegistry = (data: Record<string, Omit<FileData, 'id'>>): void => {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 4));
};

const jsonRepository: IRepository = {
    async connect() {
        logger.info(`JSON Repository active at: ${dbPath}`);
    },
    async saveFile(fileData: FileData) {
        const registry = readRegistry();
        const { id, ...rest } = fileData;
        registry[id] = rest;
        writeRegistry(registry);
    },
    async getFile(fileId: string) {
        const data = readRegistry()[fileId];
        if (!data) return null;
        return { id: fileId, ...data } as FileData;
    },
    async listFiles() {
        const registry = readRegistry();
        return Object.entries(registry).map(([id, data]) => ({
            id,
            ...data,
        })) as FileData[];
    },
    async deleteFile(fileId: string) {
        const registry = readRegistry();
        delete registry[fileId];
        writeRegistry(registry);
    },
};

export default jsonRepository;

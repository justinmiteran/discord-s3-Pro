import fs from 'fs';
import path from 'path';
import { database } from '../config/index.js';
import logger from '../utils/logger.js';
import { IRepository } from '../types/interfaces/repository.interface.js';
import { FileData } from '../types/models/file.model.js';

/**
 * Reads the JSON registry file
 */
const readRegistry = (): Record<string, Omit<FileData, 'id'>> => {
    if (!fs.existsSync(database.jsonPath)) {
        logger.debug('JSON registry file does not exist, creating new', {
            path: database.jsonPath
        });
        return {};
    }
    try {
        const data = JSON.parse(fs.readFileSync(database.jsonPath, 'utf8'));
        logger.debug('JSON registry loaded', {
            fileCount: Object.keys(data).length
        });
        return data;
    } catch (err: any) {
        logger.error('Failed to read JSON registry', err, {
            path: database.jsonPath
        });
        return {};
    }
};

/**
 * Writes data to the JSON registry file
 */
const writeRegistry = (data: Record<string, Omit<FileData, 'id'>>): void => {
    const dir = path.dirname(database.jsonPath);
    if (!fs.existsSync(dir)) {
        logger.debug('Creating registry directory', { dir });
        fs.mkdirSync(dir, { recursive: true });
    }
    
    try {
        fs.writeFileSync(database.jsonPath, JSON.stringify(data, null, 4));
        logger.debug('JSON registry saved', {
            fileCount: Object.keys(data).length,
            path: database.jsonPath
        });
    } catch (err: any) {
        logger.error('Failed to write JSON registry', err, {
            path: database.jsonPath
        });
        throw err;
    }
};

/**
 * JSON file-based repository implementation
 */
const jsonRepository: IRepository = {
    async connect() {
        logger.info('Initializing JSON repository', {
            path: database.jsonPath
        });
        
        const registry = readRegistry();
        logger.success('JSON repository connected', {
            fileCount: Object.keys(registry).length
        });
    },
    
    async saveFile(fileData: FileData) {
        logger.debug('Saving file to JSON registry', {
            fileId: fileData.id,
            fileName: fileData.name
        });
        
        const registry = readRegistry();
        const { id, ...rest } = fileData;
        registry[id] = rest;
        writeRegistry(registry);
        
        logger.debug('File saved to JSON registry', {
            fileId: id
        });
    },
    
    async getFile(fileId: string) {
        logger.debug('Retrieving file from JSON registry', { fileId });
        
        const data = readRegistry()[fileId];
        if (!data) {
            logger.debug('File not found in JSON registry', { fileId });
            return null;
        }
        
        return { id: fileId, ...data } as FileData;
    },
    
    async listFiles() {
        logger.debug('Listing all files from JSON registry');
        
        const registry = readRegistry();
        const files = Object.entries(registry).map(([id, data]) => ({
            id,
            ...data,
        })) as FileData[];
        
        logger.debug('Files listed from JSON registry', {
            count: files.length
        });
        
        return files;
    },
    
    async deleteFile(fileId: string) {
        logger.debug('Deleting file from JSON registry', { fileId });
        
        const registry = readRegistry();
        delete registry[fileId];
        writeRegistry(registry);
        
        logger.debug('File deleted from JSON registry', { fileId });
    },
};

export default jsonRepository;

import fs from 'fs';
import path from 'path';
import { database } from '../config/index.js';
import logger from '../utils/logger.js';
import { toError } from '../utils/errors/AppError.js';
import { IRepository } from '../types/interfaces/repository.interface.js';
import { FileData, ChunkRegistry } from '../types/models/file.model.js';

interface JsonStore {
    files: Record<string, Omit<FileData, 'id'>>;
    chunkRegistry: Record<string, Omit<ChunkRegistry, 'id'>>;
}

/**
 * Reads the JSON registry file
 */
const readRegistry = (): JsonStore => {
    if (!fs.existsSync(database.jsonPath)) {
        logger.debug('JSON registry file does not exist, creating new', {
            path: database.jsonPath,
        });
        return { files: {}, chunkRegistry: {} };
    }
    try {
        const data = JSON.parse(fs.readFileSync(database.jsonPath, 'utf8'));
        logger.debug('JSON registry loaded', {
            fileCount: Object.keys(data.files || {}).length,
            chunkRegistryCount: Object.keys(data.chunkRegistry || {}).length,
        });
        return data.files ? data : { files: data, chunkRegistry: {} };
    } catch (err) {
        logger.error('Failed to read JSON registry', toError(err), { path: database.jsonPath });
        return { files: {}, chunkRegistry: {} };
    }
};

/**
 * Writes data to the JSON registry file
 */
const writeRegistry = (data: JsonStore): void => {
    const dir = path.dirname(database.jsonPath);
    if (!fs.existsSync(dir)) {
        logger.debug('Creating registry directory', { dir });
        fs.mkdirSync(dir, { recursive: true });
    }

    try {
        fs.writeFileSync(database.jsonPath, JSON.stringify(data, null, 4));
        logger.debug('JSON registry saved', {
            fileCount: Object.keys(data.files).length,
            chunkRegistryCount: Object.keys(data.chunkRegistry).length,
            path: database.jsonPath,
        });
    } catch (err) {
        logger.error('Failed to write JSON registry', toError(err), { path: database.jsonPath });
        throw toError(err);
    }
};

/**
 * JSON file-based repository implementation
 */
const jsonRepository: IRepository = {
    async connect() {
        logger.info('Initializing JSON repository', {
            path: database.jsonPath,
        });

        const registry = readRegistry();
        logger.success('JSON repository connected', {
            fileCount: Object.keys(registry.files).length,
            chunkRegistryCount: Object.keys(registry.chunkRegistry).length,
        });
    },

    async saveFile(fileData: FileData) {
        logger.debug('Saving file to JSON registry', {
            fileId: fileData.id,
            fileName: fileData.name,
        });

        const registry = readRegistry();
        const { id, ...rest } = fileData;
        registry.files[id] = rest;
        writeRegistry(registry);

        logger.debug('File saved to JSON registry', {
            fileId: id,
        });
    },

    async getFile(fileId: string) {
        logger.debug('Retrieving file from JSON registry', { fileId });

        const data = readRegistry().files[fileId];
        if (!data) {
            logger.debug('File not found in JSON registry', { fileId });
            return null;
        }

        return { id: fileId, ...data } as FileData;
    },

    async listFiles() {
        logger.debug('Listing all files from JSON registry');

        const registry = readRegistry();
        const files = Object.entries(registry.files).map(([id, data]) => ({
            id,
            ...data,
        })) as FileData[];

        logger.debug('Files listed from JSON registry', {
            count: files.length,
        });

        return files;
    },

    async deleteFile(fileId: string) {
        logger.debug('Deleting file from JSON registry', { fileId });

        const registry = readRegistry();
        delete registry.files[fileId];
        writeRegistry(registry);

        logger.debug('File deleted from JSON registry', { fileId });
    },

    async saveChunkRegistry(chunkRegistry: ChunkRegistry) {
        logger.debug('Saving chunk registry to JSON', { registryId: chunkRegistry.id, hash: chunkRegistry.hash });

        const registry = readRegistry();
        const { id, ...rest } = chunkRegistry;
        registry.chunkRegistry[id] = rest;
        writeRegistry(registry);

        logger.debug('Chunk registry saved to JSON', { registryId: id });
    },

    async updateChunkRegistryData(registryId: string, chunks: ChunkRegistry['chunks'], encryptionKeyId: string) {
        logger.debug('Updating chunk registry data (chunks + encryptionKeyId only)', { 
            registryId, 
            chunksCount: chunks.length,
            encryptionKeyId 
        });

        const registry = readRegistry();
        const chunkReg = registry.chunkRegistry[registryId];
        
        if (!chunkReg) {
            logger.error('Cannot update chunk registry: not found', undefined, { registryId });
            throw new Error(`Chunk registry ${registryId} not found`);
        }

        chunkReg.chunks = chunks;
        chunkReg.encryptionKeyId = encryptionKeyId;
        writeRegistry(registry);

        logger.debug('Chunk registry data updated', { registryId });
    },

    async getChunkRegistry(registryId: string) {
        logger.debug('Retrieving chunk registry from JSON', { registryId });

        const data = readRegistry().chunkRegistry[registryId];
        if (!data) {
            logger.debug('Chunk registry not found in JSON', { registryId });
            return null;
        }

        return { id: registryId, ...data } as ChunkRegistry;
    },

    async getChunkRegistryByHash(hash: string) {
        logger.debug('Retrieving chunk registry by hash from JSON', { hash });

        const registry = readRegistry();
        const entry = Object.entries(registry.chunkRegistry).find(([, data]) => data.hash === hash);
        
        if (!entry) {
            logger.debug('Chunk registry not found by hash in JSON', { hash });
            return null;
        }

        const [id, data] = entry;
        return { id, ...data } as ChunkRegistry;
    },

    async incrementChunkRegistryRefCount(registryId: string) {
        logger.debug('Incrementing refCount for chunk registry', { registryId });

        const registry = readRegistry();
        const chunkReg = registry.chunkRegistry[registryId];
        
        if (!chunkReg) {
            logger.error('Cannot increment refCount: chunk registry not found', undefined, { registryId });
            throw new Error(`Chunk registry ${registryId} not found`);
        }

        chunkReg.refCount = (chunkReg.refCount || 1) + 1;
        writeRegistry(registry);

        logger.debug('RefCount incremented', { registryId, newRefCount: chunkReg.refCount });
    },

    async decrementChunkRegistryRefCount(registryId: string): Promise<number> {
        logger.debug('Decrementing refCount for chunk registry', { registryId });

        const registry = readRegistry();
        const chunkReg = registry.chunkRegistry[registryId];
        
        if (!chunkReg) {
            logger.error('Cannot decrement refCount: chunk registry not found', undefined, { registryId });
            throw new Error(`Chunk registry ${registryId} not found`);
        }

        chunkReg.refCount = Math.max((chunkReg.refCount || 1) - 1, 0);
        writeRegistry(registry);

        logger.debug('RefCount decremented', { registryId, newRefCount: chunkReg.refCount });
        return chunkReg.refCount;
    },

    async deleteChunkRegistry(registryId: string) {
        logger.debug('Deleting chunk registry from JSON', { registryId });

        const registry = readRegistry();
        delete registry.chunkRegistry[registryId];
        writeRegistry(registry);

        logger.debug('Chunk registry deleted from JSON', { registryId });
    },
};

export default jsonRepository;

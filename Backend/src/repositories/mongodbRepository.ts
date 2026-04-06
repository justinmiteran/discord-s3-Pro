import { MongoClient, Db } from 'mongodb';
import { database } from '../config/index.js';
import { IRepository } from '../types/interfaces/repository.interface.js';
import { FileData, ChunkRegistry } from '../types/models/file.model.js';
import { toError, DatabaseError, NotFoundError } from '../utils/errors/AppError.js';
import logger, { startTimer } from '../utils/logger.js';

let db: Db | null = null;
let client: MongoClient | null = null;

export const getDb = (): Db => {
    if (!db) throw new DatabaseError('MongoDB not connected');
    return db;
};

/**
 * MongoDB-based repository implementation
 */
const mongodbRepository: IRepository = {
    async connect() {
        if (!database.mongoUri) {
            logger.fatal('MongoDB URI not defined', undefined, {
                config: 'database.mongoUri',
            });
            throw new DatabaseError('MONGODB_URI is not defined');
        }

        const elapsed = startTimer();
        logger.info('Connecting to MongoDB', {
            uri: database.mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'),
        });

        try {
            client = await MongoClient.connect(database.mongoUri);
            db = client.db();

            const duration = elapsed();
            const stats = await db.stats();

            await db.collection('chunk_registry').createIndex({ hash: 1 });
            logger.debug('MongoDB index created', { collection: 'chunk_registry', field: 'hash' });

            logger.success('MongoDB connected', {
                database: db.databaseName,
                connectionTime: duration,
                collections: stats.collections,
                dataSize: `${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`,
            });
        } catch (err) {
            logger.error('MongoDB connection failed', toError(err), {
                uri: database.mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'),
            });
            throw toError(err);
        }
    },

    async saveFile(fileData: FileData) {
        if (!db) {
            logger.error('MongoDB not connected', undefined, {
                operation: 'saveFile',
            });
            throw new DatabaseError('Database not connected');
        }

        logger.debug('Saving file to MongoDB', {
            fileId: fileData.id,
            fileName: fileData.name,
            size: fileData.size,
        });

        try {
            const collection = db.collection('files');
            const { id, ...rest } = fileData;
            await collection.insertOne({ _id: id as any, ...rest });

            logger.debug('File saved to MongoDB', {
                fileId: id,
            });
        } catch (err) {
            logger.error('Failed to save file to MongoDB', toError(err), { fileId: fileData.id });
            throw toError(err);
        }
    },

    async getFile(fileId: string) {
        if (!db) {
            logger.error('MongoDB not connected', undefined, {
                operation: 'getFile',
            });
            throw new DatabaseError('Database not connected');
        }

        logger.debug('Retrieving file from MongoDB', { fileId });

        try {
            const doc = await db.collection('files').findOne({ _id: fileId as any });

            if (!doc) {
                logger.debug('File not found in MongoDB', { fileId });
                return null;
            }

            const { _id, ...rest } = doc;
            return { id: _id.toString(), ...rest } as unknown as FileData;
        } catch (err) {
            logger.error('Failed to retrieve file from MongoDB', toError(err), { fileId });
            throw toError(err);
        }
    },



    async listFiles() {
        if (!db) {
            logger.error('MongoDB not connected', undefined, {
                operation: 'listFiles',
            });
            throw new DatabaseError('Database not connected');
        }

        logger.debug('Listing all files from MongoDB');

        try {
            const docs = await db.collection('files').find({}).toArray();
            const files = docs.map((doc) => {
                const { _id, ...rest } = doc;
                return { id: _id.toString(), ...rest } as unknown as FileData;
            });

            logger.debug('Files listed from MongoDB', {
                count: files.length,
            });

            return files;
        } catch (err) {
            logger.error('Failed to list files from MongoDB', toError(err));
            throw toError(err);
        }
    },

    async deleteFile(fileId: string) {
        if (!db) {
            logger.error('MongoDB not connected', undefined, {
                operation: 'deleteFile',
            });
            throw new DatabaseError('Database not connected');
        }

        logger.debug('Deleting file from MongoDB', { fileId });

        try {
            const result = await db.collection('files').deleteOne({ _id: fileId as any });

            if (result.deletedCount === 0) {
                logger.warn('File not found in MongoDB for deletion', { fileId });
            } else {
                logger.debug('File deleted from MongoDB', { fileId });
            }
        } catch (err) {
            logger.error('Failed to delete file from MongoDB', toError(err), { fileId });
            throw toError(err);
        }
    },

    async saveChunkRegistry(registry: ChunkRegistry) {
        if (!db) {
            logger.error('MongoDB not connected', undefined, { operation: 'saveChunkRegistry' });
            throw new DatabaseError('Database not connected');
        }

        logger.debug('Saving chunk registry to MongoDB', { registryId: registry.id, hash: registry.hash });

        try {
            const { id, ...rest } = registry;
            await db.collection('chunk_registry').replaceOne(
                { _id: id as any },
                { _id: id as any, ...rest },
                { upsert: true }
            );
            logger.debug('Chunk registry saved to MongoDB', { registryId: id });
        } catch (err) {
            logger.error('Failed to save chunk registry to MongoDB', toError(err), { registryId: registry.id });
            throw toError(err);
        }
    },

    async updateChunkRegistryData(registryId: string, chunks: ChunkRegistry['chunks'], encryptionKeyId: string) {
        if (!db) {
            logger.error('MongoDB not connected', undefined, { operation: 'updateChunkRegistryData' });
            throw new DatabaseError('Database not connected');
        }

        logger.debug('Updating chunk registry data (chunks + encryptionKeyId only)', { 
            registryId, 
            chunksCount: chunks.length,
            encryptionKeyId 
        });

        try {
            const result = await db.collection('chunk_registry').updateOne(
                { _id: registryId as any },
                { 
                    $set: { 
                        chunks,
                        encryptionKeyId 
                    } 
                }
            );

            if (result.matchedCount === 0) {
                logger.error('Cannot update chunk registry: not found', undefined, { registryId });
                throw new NotFoundError(`Chunk registry ${registryId}`);
            }

            logger.debug('Chunk registry data updated', { registryId });
        } catch (err) {
            logger.error('Failed to update chunk registry data in MongoDB', toError(err), { registryId });
            throw toError(err);
        }
    },

    async getChunkRegistry(registryId: string) {
        if (!db) {
            logger.error('MongoDB not connected', undefined, { operation: 'getChunkRegistry' });
            throw new DatabaseError('Database not connected');
        }

        logger.debug('Retrieving chunk registry from MongoDB', { registryId });

        try {
            const doc = await db.collection('chunk_registry').findOne({ _id: registryId as any });

            if (!doc) {
                logger.debug('Chunk registry not found in MongoDB', { registryId });
                return null;
            }

            const { _id, ...rest } = doc;
            return { id: _id.toString(), ...rest } as unknown as ChunkRegistry;
        } catch (err) {
            logger.error('Failed to retrieve chunk registry from MongoDB', toError(err), { registryId });
            throw toError(err);
        }
    },

    async getChunkRegistryByHash(hash: string) {
        if (!db) {
            logger.error('MongoDB not connected', undefined, { operation: 'getChunkRegistryByHash' });
            throw new DatabaseError('Database not connected');
        }

        logger.debug('Retrieving chunk registry by hash from MongoDB', { hash });

        try {
            const doc = await db.collection('chunk_registry').findOne({ hash });

            if (!doc) {
                logger.debug('Chunk registry not found by hash in MongoDB', { hash });
                return null;
            }

            const { _id, ...rest } = doc;
            return { id: _id.toString(), ...rest } as unknown as ChunkRegistry;
        } catch (err) {
            logger.error('Failed to retrieve chunk registry by hash from MongoDB', toError(err), { hash });
            throw toError(err);
        }
    },

    async incrementChunkRegistryRefCount(registryId: string) {
        if (!db) {
            logger.error('MongoDB not connected', undefined, { operation: 'incrementChunkRegistryRefCount' });
            throw new DatabaseError('Database not connected');
        }

        logger.debug('Incrementing refCount for chunk registry', { registryId });

        try {
            const result = await db.collection('chunk_registry').updateOne(
                { _id: registryId as any },
                { $inc: { refCount: 1 } }
            );

            if (result.matchedCount === 0) {
                logger.error('Cannot increment refCount: chunk registry not found', undefined, { registryId });
                throw new NotFoundError(`Chunk registry ${registryId}`);
            }

            logger.debug('RefCount incremented', { registryId });
        } catch (err) {
            logger.error('Failed to increment refCount in MongoDB', toError(err), { registryId });
            throw toError(err);
        }
    },

    async decrementChunkRegistryRefCount(registryId: string): Promise<number> {
        if (!db) {
            logger.error('MongoDB not connected', undefined, { operation: 'decrementChunkRegistryRefCount' });
            throw new DatabaseError('Database not connected');
        }

        logger.debug('Decrementing refCount for chunk registry', { registryId });

        try {
            const result = await db.collection('chunk_registry').findOneAndUpdate(
                { _id: registryId as any },
                { $inc: { refCount: -1 } },
                { returnDocument: 'after' }
            );

            if (!result) {
                logger.error('Cannot decrement refCount: chunk registry not found', undefined, { registryId });
                throw new NotFoundError(`Chunk registry ${registryId}`);
            }

            const newRefCount = Math.max(result.refCount || 0, 0);
            logger.debug('RefCount decremented', { registryId, newRefCount });
            return newRefCount;
        } catch (err) {
            logger.error('Failed to decrement refCount in MongoDB', toError(err), { registryId });
            throw toError(err);
        }
    },

    async deleteChunkRegistry(registryId: string) {
        if (!db) {
            logger.error('MongoDB not connected', undefined, { operation: 'deleteChunkRegistry' });
            throw new DatabaseError('Database not connected');
        }

        logger.debug('Deleting chunk registry from MongoDB', { registryId });

        try {
            const result = await db.collection('chunk_registry').deleteOne({ _id: registryId as any });

            if (result.deletedCount === 0) {
                logger.warn('Chunk registry not found in MongoDB for deletion', { registryId });
            } else {
                logger.debug('Chunk registry deleted from MongoDB', { registryId });
            }
        } catch (err) {
            logger.error('Failed to delete chunk registry from MongoDB', toError(err), { registryId });
            throw toError(err);
        }
    },
};

export default mongodbRepository;

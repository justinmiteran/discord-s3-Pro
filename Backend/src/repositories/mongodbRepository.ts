import { MongoClient, Db } from 'mongodb';
import { database } from '../config/index.js';
import { IRepository } from '../types/interfaces/repository.interface.js';
import { FileData } from '../types/models/file.model.js';
import logger from '../utils/logger.js';

let db: Db | null = null;
let client: MongoClient | null = null;

/**
 * MongoDB-based repository implementation
 */
const mongodbRepository: IRepository = {
    async connect() {
        if (!database.mongoUri) {
            logger.fatal('MongoDB URI not defined', undefined, {
                config: 'database.mongoUri'
            });
            throw new Error('MONGODB_URI is not defined');
        }
        
        const startTime = Date.now();
        logger.info('Connecting to MongoDB', {
            uri: database.mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@') // Hide password
        });
        
        try {
            client = await MongoClient.connect(database.mongoUri);
            db = client.db();
            
            const duration = Date.now() - startTime;
            const stats = await db.stats();
            
            logger.success('MongoDB connected', {
                database: db.databaseName,
                connectionTime: duration,
                collections: stats.collections,
                dataSize: `${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`
            });
        } catch (err: any) {
            logger.error('MongoDB connection failed', err, {
                uri: database.mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')
            });
            throw err;
        }
    },

    async saveFile(fileData: FileData) {
        if (!db) {
            logger.error('MongoDB not connected', undefined, {
                operation: 'saveFile'
            });
            throw new Error('Database not connected');
        }
        
        logger.debug('Saving file to MongoDB', {
            fileId: fileData.id,
            fileName: fileData.name,
            size: fileData.size
        });
        
        try {
            const collection = db.collection('files');
            const { id, ...rest } = fileData;
            await collection.insertOne({ _id: id as any, ...rest });
            
            logger.debug('File saved to MongoDB', {
                fileId: id
            });
        } catch (err: any) {
            logger.error('Failed to save file to MongoDB', err, {
                fileId: fileData.id
            });
            throw err;
        }
    },

    async getFile(fileId: string) {
        if (!db) {
            logger.error('MongoDB not connected', undefined, {
                operation: 'getFile'
            });
            throw new Error('Database not connected');
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
        } catch (err: any) {
            logger.error('Failed to retrieve file from MongoDB', err, {
                fileId
            });
            throw err;
        }
    },

    async listFiles() {
        if (!db) {
            logger.error('MongoDB not connected', undefined, {
                operation: 'listFiles'
            });
            throw new Error('Database not connected');
        }
        
        logger.debug('Listing all files from MongoDB');
        
        try {
            const docs = await db.collection('files').find({}).toArray();
            const files = docs.map((doc) => {
                const { _id, ...rest } = doc;
                return { id: _id.toString(), ...rest } as unknown as FileData;
            });
            
            logger.debug('Files listed from MongoDB', {
                count: files.length
            });
            
            return files;
        } catch (err: any) {
            logger.error('Failed to list files from MongoDB', err);
            throw err;
        }
    },

    async deleteFile(fileId: string) {
        if (!db) {
            logger.error('MongoDB not connected', undefined, {
                operation: 'deleteFile'
            });
            throw new Error('Database not connected');
        }
        
        logger.debug('Deleting file from MongoDB', { fileId });
        
        try {
            const result = await db.collection('files').deleteOne({ _id: fileId as any });
            
            if (result.deletedCount === 0) {
                logger.warn('File not found in MongoDB for deletion', { fileId });
            } else {
                logger.debug('File deleted from MongoDB', { fileId });
            }
        } catch (err: any) {
            logger.error('Failed to delete file from MongoDB', err, {
                fileId
            });
            throw err;
        }
    },
};

export default mongodbRepository;

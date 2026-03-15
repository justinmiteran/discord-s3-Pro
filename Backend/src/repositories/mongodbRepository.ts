import { MongoClient, Db } from 'mongodb';
import { mongoUri } from '../config.js';
import { FileData, IRepository } from '../types/index.js';

let db: Db | null = null;

const mongodbRepository: IRepository = {
    async connect() {
        if (!mongoUri) throw new Error('MONGODB_URI is not defined');
        const client = await MongoClient.connect(mongoUri);
        db = client.db();
    },

    async saveFile(fileData: FileData) {
        if (!db) throw new Error('Database not connected');
        const collection = db.collection('files');
        // Map our 'id' to Mongo's '_id'
        const { id, ...rest } = fileData;
        await collection.insertOne({ _id: id as any, ...rest });
    },

    async getFile(fileId: string) {
        if (!db) throw new Error('Database not connected');
        const doc = await db.collection('files').findOne({ _id: fileId as any });
        if (!doc) return null;

        const { _id, ...rest } = doc;
        return { id: _id.toString(), ...rest } as unknown as FileData;
    },

    async listFiles() {
        if (!db) throw new Error('Database not connected');
        const docs = await db.collection('files').find({}).toArray();
        return docs.map((doc) => {
            const { _id, ...rest } = doc;
            return { id: _id.toString(), ...rest } as unknown as FileData;
        });
    },

    async deleteFile(fileId: string) {
        if (!db) throw new Error('Database not connected');
        await db.collection('files').deleteOne({ _id: fileId as any });
    },
};

export default mongodbRepository;

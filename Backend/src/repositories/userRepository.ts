import { Db, ObjectId } from 'mongodb';
import { UserData, RefreshTokenData } from '../types/models/user.model.js';
import { DatabaseError } from '../utils/errors/AppError.js';

let db: Db | null = null;

export const initUserRepository = (database: Db): void => {
    db = database;
};

const getDb = (): Db => {
    if (!db) throw new DatabaseError('User repository not initialized');
    return db;
};

export const findUserByUsername = async (username: string): Promise<UserData | null> => {
    const doc = await getDb().collection('users').findOne({ username });
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { id: _id.toString(), ...rest } as unknown as UserData;
};

export const findUserById = async (userId: string): Promise<UserData | null> => {
    const doc = await getDb()
        .collection('users')
        .findOne({ _id: new ObjectId(userId) });
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { id: _id.toString(), ...rest } as unknown as UserData;
};

export const createUser = async (user: Omit<UserData, 'id'>): Promise<void> => {
    await getDb()
        .collection('users')
        .insertOne({ ...user });
};

export const countUsers = async (): Promise<number> => {
    return getDb().collection('users').countDocuments();
};

export const saveRefreshToken = async (data: RefreshTokenData): Promise<void> => {
    await getDb()
        .collection('refresh_tokens')
        .insertOne({ ...data });
};

export const findRefreshToken = async (token: string): Promise<RefreshTokenData | null> => {
    const doc = await getDb().collection('refresh_tokens').findOne({ token });
    if (!doc) return null;
    return doc as unknown as RefreshTokenData;
};

export const deleteRefreshToken = async (token: string): Promise<void> => {
    await getDb().collection('refresh_tokens').deleteOne({ token });
};

export const createIndexes = async (): Promise<void> => {
    const d = getDb();
    await d.collection('users').createIndex({ username: 1 }, { unique: true });
    await d.collection('refresh_tokens').createIndex({ token: 1 }, { unique: true });
    await d.collection('refresh_tokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
};

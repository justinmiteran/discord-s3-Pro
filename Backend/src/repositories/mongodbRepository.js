const { MongoClient } = require('mongodb');
const { mongoUri } = require('../config');

let db = null;

exports.connect = async () => {
    const client = await MongoClient.connect(mongoUri);
    db = client.db();
};

exports.saveFile = async (fileId, fileData) => {
    const collection = db.collection('files');
    await collection.insertOne({ _id: fileId, ...fileData });
};

exports.getFile = async (fileId) => {
    return await db.collection('files').findOne({ _id: fileId });
};

exports.listFiles = async () => {
    const files = await db.collection('files').find({}).toArray();

    return files.map((f) => ({
        id: f._id.toString(),
        name: f.name,
        size: f.size,
        date: f.timestamp,
    }));
};

exports.deleteFile = async (fileId) => {
    await db.collection('files').deleteOne({ _id: fileId });
};

import { FileData } from '../models/file.model.js';

/**
 * Repository interface for file metadata storage
 */
export interface IRepository {
    /** Initializes the repository connection */
    connect(): Promise<void>;
    /** Saves file metadata */
    saveFile(fileData: FileData): Promise<void>;
    /** Retrieves file metadata by ID */
    getFile(fileId: string): Promise<FileData | null>;
    /** Lists all stored files */
    listFiles(): Promise<FileData[]>;
    /** Deletes file metadata by ID */
    deleteFile(fileId: string): Promise<void>;
}

import { FileData, ChunkRegistry } from '../models/file.model.js';

/**
 * Repository interface for file metadata storage
 */
export interface IRepository {
    /** Initializes the repository connection */
    connect(): Promise<void>;
    
    // File operations
    /** Saves file metadata */
    saveFile(fileData: FileData): Promise<void>;
    /** Retrieves file metadata by ID */
    getFile(fileId: string): Promise<FileData | null>;
    /** Lists all stored files */
    listFiles(): Promise<FileData[]>;
    /** Deletes file metadata by ID */
    deleteFile(fileId: string): Promise<void>;
    
    // Chunk registry operations
    /** Saves chunk registry */
    saveChunkRegistry(registry: ChunkRegistry): Promise<void>;
    /** Updates only chunks and encryption key (preserves refCount) */
    updateChunkRegistryData(registryId: string, chunks: ChunkRegistry['chunks'], encryptionKeyId: string): Promise<void>;
    /** Retrieves chunk registry by ID */
    getChunkRegistry(registryId: string): Promise<ChunkRegistry | null>;
    /** Retrieves chunk registry by hash (for deduplication) */
    getChunkRegistryByHash(hash: string): Promise<ChunkRegistry | null>;
    /** Increments reference count for a chunk registry */
    incrementChunkRegistryRefCount(registryId: string): Promise<void>;
    /** Decrements reference count for a chunk registry */
    decrementChunkRegistryRefCount(registryId: string): Promise<number>;
    /** Deletes chunk registry by ID */
    deleteChunkRegistry(registryId: string): Promise<void>;
}

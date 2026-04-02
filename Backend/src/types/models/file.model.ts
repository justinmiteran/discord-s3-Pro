/**
 * Metadata for a single chunk stored in Discord
 */
export interface ChunkMetadata {
    /** Discord message ID containing the chunk */
    mId: string;
    /** Discord channel ID where the chunk is stored */
    cId: string;
}

/**
 * Physical storage registry for chunks (deduplication layer)
 */
export interface ChunkRegistry {
    /** Unique registry identifier */
    id: string;
    /** SHA-256 hash of the original file */
    hash: string;
    /** Array of chunk locations in Discord */
    chunks: ChunkMetadata[];
    /** Number of files referencing this registry */
    refCount: number;
    /** Whether the data is compressed */
    compressed: boolean;
    /** Encryption key ID used for this registry */
    encryptionKeyId?: string;
    /** ISO timestamp of creation */
    createdAt: string;
}

/**
 * User file metadata (presentation layer)
 */
export interface FileData {
    /** Unique file identifier */
    id: string;
    /** Original filename */
    name: string;
    /** SHA-256 hash for integrity verification */
    hash: string;
    /** Reference to the chunk registry */
    chunkRegistryId: string;
    /** Original file size in bytes */
    size: number;
    /** ISO timestamp of upload */
    uploadedAt: string;
}

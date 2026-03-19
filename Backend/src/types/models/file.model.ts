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
 * Complete file metadata stored in the registry
 */
export interface FileData {
    /** Unique file identifier */
    id: string;
    /** Original filename */
    name: string;
    /** SHA-256 hash for integrity verification */
    hash: string;
    /** Array of chunk locations in Discord */
    chunks: ChunkMetadata[];
    /** Original file size in bytes */
    size: number;
    /** Whether the file is compressed */
    compressed: boolean;
    /** ISO timestamp of upload */
    uploadedAt: string;
}

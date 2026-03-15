export interface ChunkMetadata {
    mId: string;
    cId: string;
}

export interface FileData {
    id: string;
    name: string;
    hash: string;
    chunks: ChunkMetadata[];
    size: number;
    compressed: boolean;
    uploadedAt: string;
}

export interface IRepository {
    connect(): Promise<void>;
    saveFile(fileData: FileData): Promise<void>;
    getFile(fileId: string): Promise<FileData | null>;
    listFiles(): Promise<FileData[]>;
    deleteFile(fileId: string): Promise<void>;
}

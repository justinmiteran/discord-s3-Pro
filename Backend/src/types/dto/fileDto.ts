import { FileData } from '../models/file.model.js';

/**
 * Data Transfer Object for file information
 * Provides a simplified view of file metadata for API responses
 */
export default class FileDTO {
    public id: string;
    public name: string;
    public size: number;
    public date: string;
    public chunkCount: number;

    constructor(file: FileData) {
        this.id = file.id;
        this.name = file.name;
        this.size = file.size;
        this.date = file.uploadedAt;
        this.chunkCount = file.chunks.length;
    }

    /**
     * Converts an array of FileData to FileDTO array
     * @param files - Array of file metadata
     * @returns Array of DTOs
     */
    static fromList(files: FileData[]): FileDTO[] {
        return files.map((file) => new FileDTO(file));
    }
}

import { FileData, ChunkRegistry } from '../models/file.model.js';

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

    constructor(file: FileData, registry?: ChunkRegistry) {
        this.id = file.id;
        this.name = file.name;
        this.size = file.size;
        this.date = file.uploadedAt;
        this.chunkCount = registry?.chunks.length || 0;
    }

    /**
     * Converts an array of FileData to FileDTO array
     * @param files - Array of file metadata
     * @param getRegistry - Function to retrieve chunk registry
     * @returns Array of DTOs
     */
    static async fromList(
        files: FileData[],
        getRegistry: (registryId: string) => Promise<ChunkRegistry | null>,
    ): Promise<FileDTO[]> {
        const dtos: FileDTO[] = [];
        for (const file of files) {
            const registry = await getRegistry(file.chunkRegistryId);
            dtos.push(new FileDTO(file, registry || undefined));
        }
        return dtos;
    }
}

import { FileData } from './index.js';

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

    static fromList(files: FileData[]): FileDTO[] {
        return files.map((file) => new FileDTO(file));
    }
}

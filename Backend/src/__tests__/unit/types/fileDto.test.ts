import { vi, describe, it, expect } from 'vitest';
import FileDTO from '../../../types/dto/fileDto.js';
import { FileData, ChunkRegistry } from '../../../types/models/file.model.js';

describe('FileDTO', () => {
    describe('constructor', () => {
        it('creates DTO from FileData with ChunkRegistry', () => {
            const fileData: FileData = {
                id: 'file123',
                name: 'test.txt',
                hash: 'abc123',
                chunkRegistryId: 'reg123',
                size: 1024,
                uploadedAt: '2024-01-01T00:00:00.000Z',
            };

            const registry: ChunkRegistry = {
                id: 'reg123',
                hash: 'abc123',
                chunks: [
                    { mId: 'msg1', cId: 'ch1' },
                    { mId: 'msg2', cId: 'ch2' },
                ],
                refCount: 1,
                compressed: true,
                createdAt: '2024-01-01T00:00:00.000Z',
            };

            const dto = new FileDTO(fileData, registry);

            expect(dto.id).toBe('file123');
            expect(dto.name).toBe('test.txt');
            expect(dto.size).toBe(1024);
            expect(dto.date).toBe('2024-01-01T00:00:00.000Z');
            expect(dto.chunkCount).toBe(2);
        });

        it('creates DTO without registry', () => {
            const fileData: FileData = {
                id: 'file123',
                name: 'test.txt',
                hash: 'abc123',
                chunkRegistryId: 'reg123',
                size: 1024,
                uploadedAt: '2024-01-01T00:00:00.000Z',
            };

            const dto = new FileDTO(fileData);

            expect(dto.chunkCount).toBe(0);
        });
    });

    describe('fromList', () => {
        it('converts array of FileData to DTOs', async () => {
            const files: FileData[] = [
                {
                    id: 'file1',
                    name: 'test1.txt',
                    hash: 'hash1',
                    chunkRegistryId: 'reg1',
                    size: 1024,
                    uploadedAt: '2024-01-01T00:00:00.000Z',
                },
            ];

            const mockGetRegistry = vi.fn().mockResolvedValue({
                id: 'reg1',
                hash: 'hash1',
                chunks: [{ mId: 'msg1', cId: 'ch1' }],
                refCount: 1,
                compressed: true,
                createdAt: '2024-01-01T00:00:00.000Z',
            });

            const dtos = await FileDTO.fromList(files, mockGetRegistry);

            expect(dtos).toHaveLength(1);
            expect(dtos[0].chunkCount).toBe(1);
        });

        it('handles empty file list', async () => {
            const mockGetRegistry = vi.fn();
            const dtos = await FileDTO.fromList([], mockGetRegistry);
            expect(dtos).toEqual([]);
        });
    });
});

/**
 * File extensions that are already compressed — gzip brings no benefit
 * and wastes CPU cycles
 */
const INCOMPRESSIBLE = new Set([
    'zip', 'gz', 'br', 'zst', 'xz', 'bz2', 'rar', '7z',
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic',
    'mp4', 'mkv', 'avi', 'mov', 'webm',
    'mp3', 'aac', 'flac', 'ogg', 'wav',
    'pdf',
]);

/**
 * File extensions that compress exceptionally well — use max level
 */
const HIGHLY_COMPRESSIBLE = new Set([
    'txt', 'csv', 'log', 'json', 'xml', 'yaml', 'yml',
    'html', 'htm', 'css', 'js', 'ts', 'md', 'sql',
]);

/**
 * Returns the gzip compression level appropriate for the given filename.
 * - 0: skip compression (file is already compressed)
 * - 6: default gzip level (good balance)
 * - 9: maximum compression (highly compressible text formats)
 */
export const getCompressionLevel = (filename: string): number => {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (INCOMPRESSIBLE.has(ext)) return 0;
    if (HIGHLY_COMPRESSIBLE.has(ext)) return 9;
    return 6;
};

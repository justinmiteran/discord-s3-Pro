import { describe, it, expect } from 'vitest';
import { getCompressionLevel } from '../../../utils/compressionPolicy.js';

describe('compressionPolicy', () => {
    describe('getCompressionLevel', () => {
        it('returns 0 for already-compressed image formats', () => {
            expect(getCompressionLevel('photo.jpg')).toBe(0);
            expect(getCompressionLevel('image.png')).toBe(0);
            expect(getCompressionLevel('animation.gif')).toBe(0);
            expect(getCompressionLevel('photo.jpeg')).toBe(0);
            expect(getCompressionLevel('image.webp')).toBe(0);
        });

        it('returns 0 for already-compressed video formats', () => {
            expect(getCompressionLevel('video.mp4')).toBe(0);
            expect(getCompressionLevel('movie.mkv')).toBe(0);
            expect(getCompressionLevel('clip.avi')).toBe(0);
            expect(getCompressionLevel('video.webm')).toBe(0);
        });

        it('returns 0 for already-compressed audio formats', () => {
            expect(getCompressionLevel('song.mp3')).toBe(0);
            expect(getCompressionLevel('audio.aac')).toBe(0);
            expect(getCompressionLevel('music.flac')).toBe(0);
            expect(getCompressionLevel('sound.ogg')).toBe(0);
        });

        it('returns 0 for already-compressed archive formats', () => {
            expect(getCompressionLevel('archive.zip')).toBe(0);
            expect(getCompressionLevel('file.gz')).toBe(0);
            expect(getCompressionLevel('backup.rar')).toBe(0);
            expect(getCompressionLevel('data.7z')).toBe(0);
        });

        it('returns 0 for pdf', () => {
            expect(getCompressionLevel('document.pdf')).toBe(0);
        });

        it('returns 9 for highly compressible text formats', () => {
            expect(getCompressionLevel('data.txt')).toBe(9);
            expect(getCompressionLevel('data.csv')).toBe(9);
            expect(getCompressionLevel('app.log')).toBe(9);
            expect(getCompressionLevel('config.json')).toBe(9);
            expect(getCompressionLevel('config.xml')).toBe(9);
            expect(getCompressionLevel('config.yaml')).toBe(9);
            expect(getCompressionLevel('config.yml')).toBe(9);
            expect(getCompressionLevel('index.html')).toBe(9);
            expect(getCompressionLevel('style.css')).toBe(9);
            expect(getCompressionLevel('script.js')).toBe(9);
            expect(getCompressionLevel('module.ts')).toBe(9);
            expect(getCompressionLevel('README.md')).toBe(9);
            expect(getCompressionLevel('query.sql')).toBe(9);
        });

        it('returns 6 for unknown/binary formats', () => {
            expect(getCompressionLevel('file.bin')).toBe(6);
            expect(getCompressionLevel('data.dat')).toBe(6);
            expect(getCompressionLevel('archive.tar')).toBe(6);
            expect(getCompressionLevel('noextension')).toBe(6);
        });

        it('is case-insensitive for extensions', () => {
            expect(getCompressionLevel('IMAGE.JPG')).toBe(0);
            expect(getCompressionLevel('DATA.CSV')).toBe(9);
            expect(getCompressionLevel('FILE.BIN')).toBe(6);
        });

        it('handles files with no extension', () => {
            expect(getCompressionLevel('Makefile')).toBe(6);
        });

        it('handles files with multiple dots', () => {
            expect(getCompressionLevel('archive.tar.gz')).toBe(0);
            expect(getCompressionLevel('data.backup.json')).toBe(9);
        });
    });
});

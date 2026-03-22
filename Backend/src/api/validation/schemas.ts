import { z } from 'zod';

export const loginSchema = z.object({
    username: z.string().min(1).max(64),
    password: z.string().min(8).max(128),
});

export const refreshSchema = z.object({
    refreshToken: z.string().min(1),
});

export const logoutSchema = z.object({
    refreshToken: z.string().min(1),
});

export const uploadSchema = z.object({
    filePath: z.string().min(1).max(512),
});

export const fileIdSchema = z.object({
    id: z.string().min(1).max(64),
});

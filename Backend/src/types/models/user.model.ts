/**
 * User stored in MongoDB
 */
export interface UserData {
    id: string;
    username: string;
    passwordHash: string;
    createdAt: string;
}

/**
 * Refresh token stored in MongoDB with expiry
 */
export interface RefreshTokenData {
    token: string;
    userId: string;
    expiresAt: Date;
}

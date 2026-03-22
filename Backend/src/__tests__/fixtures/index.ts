import bcrypt from 'bcrypt';

export const authFixtures = {
    validUser: {
        id: '507f1f77bcf86cd799439011',
        username: 'admin',
        password: 'password123',
        passwordHash: '', // Will be set async
    },
    validTokens: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        refreshToken: 'refresh-token-uuid',
    },
};

export const fileFixtures = {
    smallFile: {
        id: 'abc123',
        name: 'test.txt',
        size: 1024,
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        chunks: [
            { mId: 'msg1', cId: 'ch1' },
            { mId: 'msg2', cId: 'ch2' },
        ],
        compressed: true,
        uploadedAt: new Date('2024-01-01').toISOString(),
    },
    largeFile: {
        id: 'def456',
        name: 'large.zip',
        size: 10485760,
        hash: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
        chunks: Array.from({ length: 10 }, (_, i) => ({
            mId: `msg${i}`,
            cId: `ch${i % 3}`,
        })),
        compressed: true,
        uploadedAt: new Date('2024-01-01').toISOString(),
    },
};

export const initAuthFixtures = async () => {
    authFixtures.validUser.passwordHash = await bcrypt.hash(authFixtures.validUser.password, 4);
};

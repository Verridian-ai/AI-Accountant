import { sign, verify } from 'hono/jwt';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config({ path: '../env.local' });

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}

export const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string) => {
    return await bcrypt.compare(password, hash);
};

export const generateToken = async (userId: string) => {
    return await sign({ userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 }, JWT_SECRET);
};

export const verifyToken = async (token: string) => {
    try {
        return await verify(token, JWT_SECRET);
    } catch (_e) {
        return null;
    }
};

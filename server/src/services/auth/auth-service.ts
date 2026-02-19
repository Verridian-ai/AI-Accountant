import { userRepository } from '../../repositories/user-repository.js';
import bcrypt from 'bcryptjs';
import { sign } from 'hono/jwt';
import { requireEnv } from '../../lib/config.js';
import { AuthenticationError, DuplicateError } from '../../errors.js';
import { validatePassword } from '../admin-auth/index.js';

const JWT_SECRET = requireEnv('JWT_SECRET');

export class AuthService {
  async register(username: string, password: string) {
    const validation = validatePassword(password);
    if (!validation.valid) {
      throw new Error(`Password requirements not met: ${validation.errors.join(', ')}`);
    }

    const existing = await userRepository.findByUsername(username);
    if (existing) {
      throw new DuplicateError('User', 'username', username);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userRepository.create({ username, passwordHash });

    if (!user) throw new Error('Failed to create user');

    const payload = {
      userId: user.id,
      username,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    };
    const token = await sign(payload, JWT_SECRET);
    return { token, user: { id: user.id, username } };
  }

  async login(username: string, password: string) {
    const user = await userRepository.findByUsername(username);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AuthenticationError('Invalid credentials');
    }

    const payload = {
      userId: user.id,
      username,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    };
    const token = await sign(payload, JWT_SECRET);
    return { token, user: { id: user.id, username } };
  }

  async getCurrentUser(userId: string) {
    const user = await userRepository.getById(userId);
    if (!user) throw new AuthenticationError('User not found');
    return { user: { id: user.id, username: user.username } };
  }
}
export const authService = new AuthService();

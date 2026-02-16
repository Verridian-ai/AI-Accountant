import { userRepository } from '../../repositories/user-repository.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { requireEnv } from '../../lib/config.js';
import { AuthenticationError, DuplicateError } from '../../errors.js';

const JWT_SECRET = requireEnv('JWT_SECRET');

export class AuthService {
  async register(username: string, password: string) {
    const existing = await userRepository.findByUsername(username);
    if (existing) {
      throw new DuplicateError('User', 'username', username);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userRepository.create({ username, passwordHash });

    if (!user) throw new Error('Failed to create user');

    const token = jwt.sign({ userId: user.id, username }, JWT_SECRET, { expiresIn: '7d' });
    return { token, user: { id: user.id, username } };
  }

  async login(username: string, password: string) {
    const user = await userRepository.findByUsername(username);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AuthenticationError('Invalid credentials');
    }

    const token = jwt.sign({ userId: user.id, username }, JWT_SECRET, { expiresIn: '7d' });
    return { token, user: { id: user.id, username } };
  }

  async getCurrentUser(userId: string) {
    const user = await userRepository.getById(userId);
    if (!user) throw new AuthenticationError('User not found');
    return { user: { id: user.id, username: user.username } };
  }
}
export const authService = new AuthService();

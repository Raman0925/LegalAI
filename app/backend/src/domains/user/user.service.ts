import pg from 'pg';
import { FastifyError } from 'fastify';
import { createUserRepository } from './user.repository.js';

export interface UserService {
  getProfile(userId: string): Promise<any>;
  updateProfile(
    userId: string,
    updates: { fullName: string | null; avatarUrl: string | null },
  ): Promise<any>;
}

export function createUserService(pgPool: pg.Pool): UserService {
  const repository = createUserRepository(pgPool);

  async function getProfile(userId: string): Promise<any> {
    const profile = await repository.findById(userId);
    if (!profile) {
      const error = new Error('User profile not found.') as FastifyError;
      error.statusCode = 404;
      throw error;
    }
    return profile;
  }

  async function updateProfile(
    userId: string,
    updates: { fullName: string | null; avatarUrl: string | null },
  ): Promise<any> {
    return repository.updateProfile(userId, updates);
  }

  return {
    getProfile,
    updateProfile,
  };
}

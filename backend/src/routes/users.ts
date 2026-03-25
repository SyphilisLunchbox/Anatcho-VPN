import type { FastifyRequest, FastifyReply } from 'fastify';
import type { App } from '../index.js';

function formatUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

export function registerUsersRoutes(app: App) {
  const requireAuth = app.requireAuth();

  app.fastify.get(
    '/api/users/me',
    {
      schema: {
        description: 'Get the authenticated user profile',
        tags: ['users'],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              name: { type: ['string', 'null'] },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Fetching user profile');

      app.logger.info({ userId }, 'User profile fetched');
      return formatUser(session.user);
    }
  );
}

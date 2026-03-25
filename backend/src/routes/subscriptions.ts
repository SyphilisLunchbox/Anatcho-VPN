import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

interface SubscriptionBody {
  plan: string;
  status: string;
  expires_at?: string;
}

function formatSubscription(sub: any) {
  return {
    id: sub.id,
    user_id: sub.userId,
    plan: sub.plan,
    status: sub.status,
    started_at: sub.startedAt,
    expires_at: sub.expiresAt,
    created_at: sub.createdAt,
  };
}

export function registerSubscriptionsRoutes(app: App) {
  const requireAuth = app.requireAuth();

  app.fastify.get(
    '/api/subscriptions/me',
    {
      schema: {
        description: 'Get the authenticated user subscription',
        tags: ['subscriptions'],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              user_id: { type: 'string' },
              plan: { type: 'string' },
              status: { type: 'string' },
              started_at: { type: ['string', 'null'], format: 'date-time' },
              expires_at: { type: ['string', 'null'], format: 'date-time' },
              created_at: { type: 'string', format: 'date-time' },
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
      app.logger.info({ userId }, 'Fetching subscription');

      let subscription = await app.db.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.userId, userId),
      });

      if (!subscription) {
        app.logger.info({ userId }, 'No subscription found, creating default free plan');
        const [newSubscription] = await app.db
          .insert(schema.subscriptions)
          .values({
            userId,
            plan: 'free',
            status: 'active',
          })
          .onConflictDoNothing()
          .returning();

        if (newSubscription) {
          subscription = newSubscription;
        } else {
          // In case of race condition, fetch the one that was inserted
          subscription = await app.db.query.subscriptions.findFirst({
            where: eq(schema.subscriptions.userId, userId),
          });
        }
      }

      app.logger.info({ userId }, 'Subscription fetched');
      return formatSubscription(subscription!);
    }
  );

  app.fastify.post(
    '/api/subscriptions',
    {
      schema: {
        description: 'Create or update user subscription',
        tags: ['subscriptions'],
        body: {
          type: 'object',
          required: ['plan', 'status'],
          properties: {
            plan: { type: 'string' },
            status: { type: 'string' },
            expires_at: { type: 'string', format: 'date-time' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              user_id: { type: 'string' },
              plan: { type: 'string' },
              status: { type: 'string' },
              started_at: { type: ['string', 'null'], format: 'date-time' },
              expires_at: { type: ['string', 'null'], format: 'date-time' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: SubscriptionBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { plan, status, expires_at } = request.body;
      app.logger.info({ userId, plan, status }, 'Upserting subscription');

      const expiresAtDate = expires_at ? new Date(expires_at) : null;

      const [subscription] = await app.db
        .insert(schema.subscriptions)
        .values({
          userId,
          plan,
          status,
          startedAt: new Date(),
          expiresAt: expiresAtDate,
        })
        .onConflictDoUpdate({
          target: schema.subscriptions.userId,
          set: {
            plan,
            status,
            expiresAt: expiresAtDate,
          },
        })
        .returning();

      app.logger.info({ userId, subscriptionId: subscription.id }, 'Subscription upserted');
      return formatSubscription(subscription);
    }
  );
}

import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, isNull, desc, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

interface CreateConnectionBody {
  server_id: string;
  protocol: string;
}

interface DisconnectBody {
  bytes_sent?: number;
  bytes_received?: number;
}

function formatConnection(conn: any, server: any) {
  return {
    id: conn.id,
    user_id: conn.userId,
    server_id: conn.serverId,
    connected_at: conn.connectedAt,
    disconnected_at: conn.disconnectedAt,
    bytes_sent: conn.bytesSent,
    bytes_received: conn.bytesReceived,
    protocol: conn.protocol,
    created_at: conn.createdAt,
    server: server
      ? {
          id: server.id,
          name: server.name,
          country: server.country,
          country_code: server.countryCode,
          city: server.city,
        }
      : null,
  };
}

export function registerConnectionsRoutes(app: App) {
  const requireAuth = app.requireAuth();

  app.fastify.post(
    '/api/connections',
    {
      schema: {
        description: 'Start a new VPN connection',
        tags: ['connections'],
        body: {
          type: 'object',
          required: ['server_id', 'protocol'],
          properties: {
            server_id: { type: 'string', format: 'uuid' },
            protocol: { type: 'string' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              user_id: { type: 'string' },
              server_id: { type: 'string', format: 'uuid' },
              connected_at: { type: 'string', format: 'date-time' },
              disconnected_at: { type: ['string', 'null'], format: 'date-time' },
              bytes_sent: { type: 'integer' },
              bytes_received: { type: 'integer' },
              protocol: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              server: { type: 'object' },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateConnectionBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { server_id, protocol } = request.body;
      app.logger.info(
        { userId, serverId: server_id, protocol },
        'Creating new connection'
      );

      const server = await app.db.query.servers.findFirst({
        where: eq(schema.servers.id, server_id),
      });

      const [connection] = await app.db
        .insert(schema.connections)
        .values({
          userId,
          serverId: server_id,
          protocol,
        })
        .returning();

      app.logger.info(
        { userId, connectionId: connection.id, serverId: server_id },
        'Connection created'
      );
      return reply.status(201).send(formatConnection(connection, server));
    }
  );

  app.fastify.patch(
    '/api/connections/:id/disconnect',
    {
      schema: {
        description: 'Disconnect a VPN connection',
        tags: ['connections'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            bytes_sent: { type: 'number' },
            bytes_received: { type: 'number' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              user_id: { type: 'string' },
              server_id: { type: 'string', format: 'uuid' },
              connected_at: { type: 'string', format: 'date-time' },
              disconnected_at: { type: ['string', 'null'], format: 'date-time' },
              bytes_sent: { type: 'integer' },
              bytes_received: { type: 'integer' },
              protocol: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          403: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: DisconnectBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { id } = request.params;
      const { bytes_sent, bytes_received } = request.body;
      app.logger.info({ userId, connectionId: id }, 'Disconnecting connection');

      const connection = await app.db.query.connections.findFirst({
        where: eq(schema.connections.id, id),
      });

      if (!connection) {
        app.logger.warn({ userId, connectionId: id }, 'Connection not found');
        return reply.status(404).send({ error: 'Connection not found' });
      }

      if (connection.userId !== userId) {
        app.logger.warn(
          { userId, connectionId: id, ownerId: connection.userId },
          'Ownership check failed'
        );
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const updateData: any = {
        disconnectedAt: new Date(),
      };
      if (bytes_sent !== undefined) updateData.bytesSent = bytes_sent;
      if (bytes_received !== undefined) updateData.bytesReceived = bytes_received;

      const [updated] = await app.db
        .update(schema.connections)
        .set(updateData)
        .where(eq(schema.connections.id, id))
        .returning();

      const server = await app.db.query.servers.findFirst({
        where: eq(schema.servers.id, updated.serverId),
      });

      app.logger.info({ userId, connectionId: id }, 'Connection disconnected');
      return formatConnection(updated, server);
    }
  );

  app.fastify.get(
    '/api/connections',
    {
      schema: {
        description: 'Get all connections for the authenticated user',
        tags: ['connections'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                user_id: { type: 'string' },
                server_id: { type: 'string', format: 'uuid' },
                connected_at: { type: 'string', format: 'date-time' },
                disconnected_at: { type: ['string', 'null'], format: 'date-time' },
                bytes_sent: { type: 'integer' },
                bytes_received: { type: 'integer' },
                protocol: { type: 'string' },
                created_at: { type: 'string', format: 'date-time' },
              },
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
      app.logger.info({ userId }, 'Fetching all connections');

      const connections = await app.db
        .select()
        .from(schema.connections)
        .where(eq(schema.connections.userId, userId))
        .orderBy(desc(schema.connections.connectedAt));

      const formatted = await Promise.all(
        connections.map(async (conn) => {
          const server = await app.db.query.servers.findFirst({
            where: eq(schema.servers.id, conn.serverId),
          });
          return formatConnection(conn, server);
        })
      );

      app.logger.info({ userId, count: connections.length }, 'Connections fetched');
      return formatted;
    }
  );

  app.fastify.get(
    '/api/connections/active',
    {
      schema: {
        description: 'Get the active connection for the authenticated user',
        tags: ['connections'],
        response: {
          200: {
            type: 'object',
            properties: {
              connection: {
                anyOf: [
                  {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      user_id: { type: 'string' },
                      server_id: { type: 'string', format: 'uuid' },
                      connected_at: { type: 'string', format: 'date-time' },
                      disconnected_at: { type: ['string', 'null'], format: 'date-time' },
                      bytes_sent: { type: 'integer' },
                      bytes_received: { type: 'integer' },
                      protocol: { type: 'string' },
                      created_at: { type: 'string', format: 'date-time' },
                    },
                  },
                  { type: 'null' },
                ],
              },
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
      app.logger.info({ userId }, 'Fetching active connection');

      const connection = await app.db
        .select()
        .from(schema.connections)
        .where(
          and(
            eq(schema.connections.userId, userId),
            isNull(schema.connections.disconnectedAt)
          )
        )
        .orderBy(desc(schema.connections.connectedAt))
        .limit(1);

      if (connection.length === 0) {
        app.logger.info({ userId }, 'No active connection');
        return { connection: null };
      }

      const server = await app.db.query.servers.findFirst({
        where: eq(schema.servers.id, connection[0].serverId),
      });

      app.logger.info({ userId, connectionId: connection[0].id }, 'Active connection fetched');
      return { connection: formatConnection(connection[0], server) };
    }
  );
}

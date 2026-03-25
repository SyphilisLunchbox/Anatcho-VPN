import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, ilike, asc, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

interface ServersQuerystring {
  country?: string;
  is_tor?: string;
  protocol?: string;
}

export function registerServersRoutes(app: App) {
  app.fastify.get(
    '/api/servers',
    {
      schema: {
        description: 'List all VPN servers with optional filtering',
        tags: ['servers'],
        querystring: {
          type: 'object',
          properties: {
            country: { type: 'string', description: 'Filter by country (case-insensitive)' },
            is_tor: {
              type: 'string',
              enum: ['true', 'false'],
              description: 'Filter by Tor support',
            },
            protocol: { type: 'string', description: 'Filter by protocol' },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                country: { type: 'string' },
                country_code: { type: 'string' },
                city: { type: 'string' },
                ip_address: { type: 'string' },
                protocol: { type: 'string' },
                load: { type: 'integer' },
                is_tor: { type: 'boolean' },
                is_premium: { type: 'boolean' },
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                created_at: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ServersQuerystring }>, reply: FastifyReply) => {
      const { country, is_tor, protocol } = request.query;
      app.logger.info({ query: request.query }, 'Fetching servers');

      const conditions = [];
      if (country) {
        conditions.push(ilike(schema.servers.country, `%${country}%`));
      }
      if (is_tor !== undefined) {
        conditions.push(eq(schema.servers.isTor, is_tor === 'true'));
      }
      if (protocol) {
        conditions.push(ilike(schema.servers.protocol, `%${protocol}%`));
      }

      const servers = await app.db
        .select()
        .from(schema.servers)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(schema.servers.country), asc(schema.servers.city));

      const formatted = servers.map((s) => ({
        id: s.id,
        name: s.name,
        country: s.country,
        country_code: s.countryCode,
        city: s.city,
        ip_address: s.ipAddress,
        protocol: s.protocol,
        load: s.load,
        is_tor: s.isTor,
        is_premium: s.isPremium,
        latitude: s.latitude,
        longitude: s.longitude,
        created_at: s.createdAt,
      }));

      app.logger.info({ count: servers.length }, 'Servers fetched');
      return formatted;
    }
  );

  app.fastify.get(
    '/api/servers/:id',
    {
      schema: {
        description: 'Get a specific VPN server by ID',
        tags: ['servers'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid', description: 'Server ID' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              country: { type: 'string' },
              country_code: { type: 'string' },
              city: { type: 'string' },
              ip_address: { type: 'string' },
              protocol: { type: 'string' },
              load: { type: 'integer' },
              is_tor: { type: 'boolean' },
              is_premium: { type: 'boolean' },
              latitude: { type: 'number' },
              longitude: { type: 'number' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      app.logger.info({ serverId: id }, 'Fetching server');

      const server = await app.db.query.servers.findFirst({
        where: eq(schema.servers.id, id),
      });

      if (!server) {
        app.logger.info({ serverId: id }, 'Server not found');
        return reply.status(404).send({ error: 'Server not found' });
      }

      const formatted = {
        id: server.id,
        name: server.name,
        country: server.country,
        country_code: server.countryCode,
        city: server.city,
        ip_address: server.ipAddress,
        protocol: server.protocol,
        load: server.load,
        is_tor: server.isTor,
        is_premium: server.isPremium,
        latitude: server.latitude,
        longitude: server.longitude,
        created_at: server.createdAt,
      };

      app.logger.info({ serverId: id }, 'Server fetched');
      return formatted;
    }
  );
}

import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  bigint,
  doublePrecision,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema.js';

export const servers = pgTable('servers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  country: text('country').notNull(),
  countryCode: text('country_code').notNull(),
  city: text('city').notNull(),
  ipAddress: text('ip_address').notNull(),
  protocol: text('protocol').notNull(),
  load: integer('load'),
  isTor: boolean('is_tor').default(false).notNull(),
  isPremium: boolean('is_premium').default(false).notNull(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const connections = pgTable('connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  serverId: uuid('server_id').notNull().references(() => servers.id),
  connectedAt: timestamp('connected_at', { withTimezone: true }).defaultNow().notNull(),
  disconnectedAt: timestamp('disconnected_at', { withTimezone: true }),
  bytesSent: bigint('bytes_sent', { mode: 'number' }).default(0).notNull(),
  bytesReceived: bigint('bytes_received', { mode: 'number' }).default(0).notNull(),
  protocol: text('protocol'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  plan: text('plan').notNull(),
  status: text('status').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
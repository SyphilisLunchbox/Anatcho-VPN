import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
import { registerServersRoutes } from './routes/servers.js';
import { registerConnectionsRoutes } from './routes/connections.js';
import { registerSubscriptionsRoutes } from './routes/subscriptions.js';
import { registerUsersRoutes } from './routes/users.js';
import { seedServers } from './seed.js';

const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Set up authentication with email/password and OAuth providers
app.withAuth();

// Seed servers on startup
await seedServers(app);

// Register all route modules
registerServersRoutes(app);
registerConnectionsRoutes(app);
registerSubscriptionsRoutes(app);
registerUsersRoutes(app);

await app.run();
app.logger.info('Anarcho VPN backend running');

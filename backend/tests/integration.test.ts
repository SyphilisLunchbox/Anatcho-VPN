import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus } from "./helpers";

describe("API Integration Tests", () => {
  let authToken: string;
  let userId: string;
  let serverId: string;
  let connectionId: string;

  // ========== Servers (Public) ==========

  test("GET /api/servers - list all servers", async () => {
    const res = await api("/api/servers");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      serverId = data[0].id;
      expect(data[0]).toHaveProperty("id");
      expect(data[0]).toHaveProperty("name");
    }
  });

  test("GET /api/servers?country=US - filter by country", async () => {
    const res = await api("/api/servers?country=US");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("GET /api/servers?protocol=wireguard - filter by protocol", async () => {
    const res = await api("/api/servers?protocol=wireguard");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("GET /api/servers?is_tor=true - filter by Tor", async () => {
    const res = await api("/api/servers?is_tor=true");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("GET /api/servers/{id} - get server by ID", async () => {
    if (serverId) {
      const res = await api(`/api/servers/${serverId}`);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBe(serverId);
      expect(data).toHaveProperty("name");
      expect(data).toHaveProperty("country");
    }
  });

  test("GET /api/servers/{id} - 404 for nonexistent server", async () => {
    const res = await api("/api/servers/00000000-0000-0000-0000-000000000000");
    await expectStatus(res, 404);
  });

  // ========== Authentication Setup ==========

  test("Sign up test user", async () => {
    const { token, user } = await signUpTestUser();
    authToken = token;
    userId = user.id;
    expect(authToken).toBeDefined();
    expect(userId).toBeDefined();
  });

  // ========== Users ==========

  test("GET /api/users/me - get authenticated user profile", async () => {
    const res = await authenticatedApi("/api/users/me", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(userId);
    expect(data.email).toBeDefined();
  });

  test("GET /api/users/me - 401 without authentication", async () => {
    const res = await api("/api/users/me");
    await expectStatus(res, 401);
  });

  // ========== Subscriptions ==========

  test("GET /api/subscriptions/me - get user subscription", async () => {
    const res = await authenticatedApi("/api/subscriptions/me", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("user_id");
    expect(data).toHaveProperty("plan");
    expect(data).toHaveProperty("status");
  });

  test("POST /api/subscriptions - create subscription", async () => {
    const res = await authenticatedApi("/api/subscriptions", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: "premium",
        status: "active"
      })
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.plan).toBe("premium");
    expect(data.status).toBe("active");
    expect(data).toHaveProperty("id");
  });

  test("POST /api/subscriptions - missing required field (status)", async () => {
    const res = await authenticatedApi("/api/subscriptions", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: "premium"
      })
    });
    await expectStatus(res, 400);
  });

  test("POST /api/subscriptions - missing required field (plan)", async () => {
    const res = await authenticatedApi("/api/subscriptions", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "active"
      })
    });
    await expectStatus(res, 400);
  });

  test("GET /api/subscriptions/me - 401 without authentication", async () => {
    const res = await api("/api/subscriptions/me");
    await expectStatus(res, 401);
  });

  // ========== Connections ==========

  test("POST /api/connections - create connection", async () => {
    if (!serverId) {
      const listRes = await api("/api/servers");
      const servers = await listRes.json();
      if (servers.length > 0) {
        serverId = servers[0].id;
      }
    }

    if (serverId) {
      const res = await authenticatedApi("/api/connections", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          server_id: serverId,
          protocol: "wireguard"
        })
      });
      await expectStatus(res, 201);
      const data = await res.json();
      connectionId = data.id;
      expect(data.server_id).toBe(serverId);
      expect(data.protocol).toBe("wireguard");
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("user_id");
    }
  });

  test("POST /api/connections - missing required field (protocol)", async () => {
    if (serverId) {
      const res = await authenticatedApi("/api/connections", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          server_id: serverId
        })
      });
      await expectStatus(res, 400);
    }
  });

  test("POST /api/connections - missing required field (server_id)", async () => {
    const res = await authenticatedApi("/api/connections", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        protocol: "wireguard"
      })
    });
    await expectStatus(res, 400);
  });

  test("GET /api/connections - list all user connections", async () => {
    const res = await authenticatedApi("/api/connections", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("GET /api/connections/active - get active connection", async () => {
    const res = await authenticatedApi("/api/connections/active", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data).toHaveProperty("connection");
  });

  test("PATCH /api/connections/{id}/disconnect - disconnect connection", async () => {
    if (!connectionId) {
      if (serverId) {
        const createRes = await authenticatedApi("/api/connections", authToken, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            server_id: serverId,
            protocol: "wireguard"
          })
        });
        const data = await createRes.json();
        connectionId = data.id;
      }
    }

    if (connectionId) {
      const res = await authenticatedApi(
        `/api/connections/${connectionId}/disconnect`,
        authToken,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bytes_sent: 1024,
            bytes_received: 2048
          })
        }
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBe(connectionId);
      expect(data).toHaveProperty("disconnected_at");
    }
  });

  test("PATCH /api/connections/{id}/disconnect - 404 for nonexistent connection", async () => {
    const res = await authenticatedApi(
      "/api/connections/00000000-0000-0000-0000-000000000000/disconnect",
      authToken,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }
    );
    await expectStatus(res, 404);
  });

  test("GET /api/connections - 401 without authentication", async () => {
    const res = await api("/api/connections");
    await expectStatus(res, 401);
  });

  test("POST /api/connections - 401 without authentication", async () => {
    const res = await api("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        server_id: "00000000-0000-0000-0000-000000000000",
        protocol: "wireguard"
      })
    });
    await expectStatus(res, 401);
  });
});

import { Elysia } from "elysia";
import { describe, it, expect } from "vitest";

import type { ElysiaApp } from "~/utils/loader.js";
import { extractRoutes, formatRoutes, routesToJson } from "~/utils/routes.js";

describe("extractRoutes", () => {
  it("should extract routes from an Elysia app", () => {
    const app = new Elysia()
      .get("/", () => "home")
      .post("/users", () => "create")
      .delete("/users/:id", () => "delete");

    const routes = extractRoutes(app as unknown as ElysiaApp);
    expect(routes.length).toBeGreaterThan(0);

    const paths = routes.map((r) => r.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/users");
    expect(paths).toContain("/users/:id");
  });

  it("should detect WebSocket routes", () => {
    //? Avoid depending on a real WebSocket adapter (Node/vitest often logs
    //? "Current adapter doesn't support WebSocket"). Assert mapping logic only.
    const mockApp = {
      routes: [{ method: "WS", path: "/chat" }],
    } as unknown as ElysiaApp;

    const routes = extractRoutes(mockApp);
    const wsRoute = routes.find((r) => r.path === "/chat");
    expect(wsRoute).toBeDefined();
    expect(wsRoute!.hasWebSocket).toBe(true);
  });

  it("should identify correct HTTP methods", () => {
    const app = new Elysia()
      .get("/get", () => "get")
      .post("/post", () => "post")
      .put("/put", () => "put")
      .patch("/patch", () => "patch")
      .delete("/delete", () => "delete");

    const routes = extractRoutes(app as unknown as ElysiaApp);
    const methodMap = Object.fromEntries(routes.map((r) => [r.path, r.method]));

    expect(methodMap["/get"]).toBe("GET");
    expect(methodMap["/post"]).toBe("POST");
    expect(methodMap["/put"]).toBe("PUT");
    expect(methodMap["/patch"]).toBe("PATCH");
    expect(methodMap["/delete"]).toBe("DELETE");
  });
});

describe("formatRoutes", () => {
  it("should return message for empty routes", () => {
    const result = formatRoutes([]);
    expect(result).toContain("No routes registered");
  });

  it("should format routes with methods and paths", () => {
    const routes = [
      { method: "GET", path: "/", hasWebSocket: false },
      { method: "POST", path: "/users", hasWebSocket: false },
    ];
    const result = formatRoutes(routes);
    expect(result).toContain("/");
    expect(result).toContain("/users");
  });

  it("should mark WebSocket routes", () => {
    const routes = [{ method: "GET", path: "/chat", hasWebSocket: true }];
    const result = formatRoutes(routes);
    expect(result).toContain("[WS]");
  });

  it("should sort routes by path", () => {
    const routes = [
      { method: "GET", path: "/z", hasWebSocket: false },
      { method: "GET", path: "/a", hasWebSocket: false },
      { method: "GET", path: "/m", hasWebSocket: false },
    ];
    const result = formatRoutes(routes);
    const aIdx = result.indexOf("/a");
    const mIdx = result.indexOf("/m");
    const zIdx = result.indexOf("/z");
    expect(aIdx).toBeLessThan(mIdx);
    expect(mIdx).toBeLessThan(zIdx);
  });
});

describe("routesToJson", () => {
  it("should serialize routes to JSON", () => {
    const routes = [
      { method: "GET", path: "/", hasWebSocket: false },
      { method: "WS", path: "/chat", hasWebSocket: true },
    ];
    const json = routesToJson(routes);
    const parsed = JSON.parse(json) as Array<{ method: string; path: string; websocket?: boolean }>;

    expect(parsed[0]).toEqual({ method: "GET", path: "/" });
    expect(parsed[1]).toEqual({ method: "WS", path: "/chat", websocket: true });
  });
});

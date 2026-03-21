import { Elysia, type AnyElysia } from "elysia";
import { describe, it, expect, beforeEach } from "vitest";

describe("request command - core functionality", () => {
  let app: AnyElysia;

  beforeEach(() => {
    app = new Elysia()
      .get("/", () => "Hello Elysia")
      .get("/json", () => ({ message: "json response" }))
      .post("/echo", ({ body }) => body)
      .get(
        "/status/:code",
        ({ params: { code } }) => new Response("custom status", { status: Number(code) }),
      );
  });

  it("should handle GET request", async () => {
    const response = await app.handle(new Request("http://localhost/"));
    expect(response.status).toBe(200);

    const text = await response.text();
    expect(text).toBe("Hello Elysia");
  });

  it("should handle GET request returning JSON", async () => {
    const response = await app.handle(new Request("http://localhost/json"));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ message: "json response" });
  });

  it("should handle POST request with body", async () => {
    const body = JSON.stringify({ key: "value" });
    const response = await app.handle(
      new Request("http://localhost/echo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      }),
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ key: "value" });
  });

  it("should return 404 for unknown routes", async () => {
    const response = await app.handle(new Request("http://localhost/not-found"));
    expect(response.status).toBe(404);
  });

  it("should handle custom status codes", async () => {
    const response = await app.handle(new Request("http://localhost/status/201"));
    expect(response.status).toBe(201);
  });
});

describe("request URL building", () => {
  it("should normalize path to URL correctly", () => {
    const buildUrl = (path: string): string => {
      return path.startsWith("http")
        ? path
        : `http://localhost${path.startsWith("/") ? "" : "/"}${path}`;
    };

    expect(buildUrl("/")).toBe("http://localhost/");
    expect(buildUrl("/users")).toBe("http://localhost/users");
    expect(buildUrl("users")).toBe("http://localhost/users");
    expect(buildUrl("http://example.com/api")).toBe("http://example.com/api");
  });
});

describe("header parsing", () => {
  it("should parse header strings correctly", () => {
    const parseHeaders = (headers: string[]): Record<string, string> => {
      const result: Record<string, string> = {};

      for (const h of headers) {
        const colonIdx = h.indexOf(":");

        if (colonIdx === -1) {
          throw new Error(`Invalid header: ${h}`);
        }

        const name = h.slice(0, colonIdx).trim().toLowerCase();
        const value = h.slice(colonIdx + 1).trim();
        result[name] = value;
      }

      return result;
    };

    const result = parseHeaders([
      "Content-Type: application/json",
      "Authorization: Bearer token123",
    ]);

    expect(result["content-type"]).toBe("application/json");
    expect(result["authorization"]).toBe("Bearer token123");
  });

  it("should throw on invalid header format", () => {
    const parseHeaders = (headers: string[]): void => {
      for (const h of headers) {
        if (!h.includes(":")) throw new Error(`Invalid header format: "${h}"`);
      }
    };

    expect(() => parseHeaders(["InvalidHeader"])).toThrow("Invalid header format");
  });
});

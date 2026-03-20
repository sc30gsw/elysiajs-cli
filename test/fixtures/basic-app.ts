import { Elysia } from "elysia";

export const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .get("/health", () => ({ status: "ok" }))
  .post("/echo", ({ body }) => body)
  .get("/users/:id", ({ params: { id } }) => ({ id, name: `User ${id}` }))
  .delete("/users/:id", ({ params: { id } }) => ({ deleted: id }));

export default app;

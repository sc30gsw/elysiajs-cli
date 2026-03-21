import { pipe, prop, sortBy } from "remeda";

import { formatMethod } from "~/utils/display.js";
import type { ElysiaApp, ElysiaRoute } from "~/utils/loader.js";

type RouteInfo = Pick<ElysiaRoute, "method" | "path"> & Record<"hasWebSocket", boolean>;

/**
 * Extract route information from an Elysia app
 * @param app - The Elysia app instance
 * @returns Array of route info objects with method, path, and WebSocket flag
 */
export function extractRoutes(app: ElysiaApp) {
  return app.routes.map((route) => ({
    method: route.method,
    path: route.path,
    hasWebSocket: Boolean(route.websocket) || route.method === "WS",
  }));
}

/**
 * Format routes for terminal display
 * @param routes - Array of route info to format
 * @returns Multi-line string with ANSI-colored route table, sorted by path
 */
export function formatRoutes(routes: RouteInfo[]) {
  if (routes.length === 0) {
    return "  No routes registered";
  }

  const lines: string[] = [];
  const sorted = pipe(routes, sortBy(prop("path"), prop("method")));

  for (const route of sorted) {
    const method = formatMethod(route.method);
    const ws = route.hasWebSocket ? " [WS]" : "";
    lines.push(`  ${method}  ${route.path}${ws}`);
  }

  return lines.join("\n");
}

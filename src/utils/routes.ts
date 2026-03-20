import { formatMethod } from "~/utils/display.js";
import type { ElysiaApp } from "~/utils/loader.js";

export interface RouteInfo {
  method: string;
  path: string;
  hasWebSocket: boolean;
}

/**
 * Extract route information from an Elysia app
 */
export function extractRoutes(app: ElysiaApp): RouteInfo[] {
  return app.routes.map((route) => ({
    method: route.method,
    path: route.path,
    hasWebSocket: Boolean(route.websocket) || route.method === "WS",
  }));
}

/**
 * Format routes for terminal display
 */
export function formatRoutes(routes: RouteInfo[]): string {
  if (routes.length === 0) {
    return "  No routes registered";
  }

  const lines: string[] = [];

  // Group by path prefix for better readability
  const sorted = [...routes].sort((a, b) => {
    if (a.path < b.path) return -1;
    if (a.path > b.path) return 1;
    return a.method.localeCompare(b.method);
  });

  for (const route of sorted) {
    const method = formatMethod(route.method);
    const ws = route.hasWebSocket ? " [WS]" : "";
    lines.push(`  ${method}  ${route.path}${ws}`);
  }

  return lines.join("\n");
}

/**
 * Format routes as JSON
 */
export function routesToJson(routes: RouteInfo[]): string {
  return JSON.stringify(
    routes.map(({ method, path, hasWebSocket }) => ({
      method,
      path,
      ...(hasWebSocket ? { websocket: true } : {}),
    })),
    null,
    2,
  );
}

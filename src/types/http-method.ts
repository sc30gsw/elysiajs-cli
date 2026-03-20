/** Methods we highlight in the terminal; `Request` still allows other uppercase methods. */
export const KNOWN_HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

export type KnownHttpMethod = (typeof KNOWN_HTTP_METHODS)[number];

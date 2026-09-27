export function internalServiceUrl(path: string): URL {
  if (!path.startsWith("/api/") || path.startsWith("//")) throw new Error("Invalid internal API path.");
  const port = Number(process.env.PORT ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Internal service port is invalid.");
  return new URL(path, `http://127.0.0.1:${port}`);
}

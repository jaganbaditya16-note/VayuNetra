const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_CHARS = /^[0-9a-f:]+$/;
const BRACKETED_IPV6_PATTERN = /^\[([^\]]+)\](?::\d{1,5})?$/;

function normalizeIp(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Proxies commonly send bracketed IPv6, optionally with a port:
  // `[::1]` or `[::1]:443`. Unwrap that before anything else.
  const bracketed = BRACKETED_IPV6_PATTERN.exec(trimmed);
  const raw = bracketed
    ? bracketed[1]
    : trimmed.split("%")[0].trim();

  if (!raw) return null;

  if (IPV4_PATTERN.test(raw)) {
    return raw
      .split(".")
      .every((octet) => octet.length <= 3 && Number(octet) <= 255)
      ? raw
      : null;
  }

  if (
    IPV6_CHARS.test(raw) &&
    (raw.includes("::") || raw.split(":").length === 8)
  ) {
    return raw.toLowerCase();
  }

  return null;
}

/**
 * Resolves the client address used for rate limiting.
 *
 * Only the right-most `X-Forwarded-For` hop is trusted. Platform proxies such
 * as Google Cloud Run append the real client address as the final entry, so a
 * caller cannot pick its own rate-limit bucket by sending its own header.
 * Every earlier hop is caller-controlled and is deliberately ignored.
 *
 * Unidentifiable callers share a single `"unidentified"` bucket so that a
 * caller who omits or corrupts forwarding headers is limited rather than
 * granted an unlimited allowance.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    const hops = forwarded.split(",");
    for (let index = hops.length - 1; index >= 0; index -= 1) {
      const ip = normalizeIp(hops[index]);
      if (ip) return ip;
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    const ip = normalizeIp(realIp);
    if (ip) return ip;
  }

  return "unidentified";
}

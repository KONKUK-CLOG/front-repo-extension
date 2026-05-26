export function decodeJwtPayload(
  token: string,
): Record<string, unknown> | undefined {
  const parts = token.split(".");
  if (parts.length < 2) {
    return undefined;
  }

  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function isJwtExpired(token: string, skewSeconds = 30): boolean {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;

  if (typeof exp !== "number") {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return exp <= nowSeconds + skewSeconds;
}

export function getUserIdFromToken(token: string): number | undefined {
  const payload = decodeJwtPayload(token);
  const sub = payload?.sub;

  if (typeof sub === "number") {
    return sub;
  }

  if (typeof sub === "string" && sub.trim()) {
    const parsed = Number.parseInt(sub, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

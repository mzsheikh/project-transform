import type { StringValue } from "ms";

function parseDurationToMs(value: string, fallbackMs: number): number {
  const match = value.trim().match(/^(\d+)\s*([smhd])$/i);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    case "d":
      return amount * 24 * 60 * 60 * 1000;
    default:
      return fallbackMs;
  }
}

function normalizeJwtTtl(rawValue: string | undefined, fallback: StringValue): StringValue {
  const value = rawValue?.trim();
  const isSimpleDuration = value ? /^(\d+)\s*([smhd])$/i.test(value) : false;
  if (!isSimpleDuration) return fallback;
  return value!.replace(/\s+/g, "").toLowerCase() as StringValue;
}

export const ACCESS_TOKEN_EXPIRES_IN = normalizeJwtTtl(process.env.JWT_ACCESS_TTL, "24h");
export const REFRESH_TOKEN_EXPIRES_IN = normalizeJwtTtl(process.env.JWT_REFRESH_TTL, "30d");

export const ACCESS_COOKIE_MAX_AGE_MS = parseDurationToMs(ACCESS_TOKEN_EXPIRES_IN, 24 * 60 * 60 * 1000);
export const REFRESH_COOKIE_MAX_AGE_MS = parseDurationToMs(REFRESH_TOKEN_EXPIRES_IN, 30 * 24 * 60 * 60 * 1000);

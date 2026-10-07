import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** Hashes a password with scrypt as "scrypt$<salt>$<hash>" (both base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64url"), expected.length);
  return timingSafeEqual(actual, expected);
}

export type TokenClaims = { sub: string; iat: number; exp: number };

const TOKEN_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");

function sign(data: string, secret: string) {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

/** Issues an HS256 JWT for the given user id. */
export function signToken(userId: string, secret: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, iat, exp: iat + TOKEN_LIFETIME_SECONDS }),
  ).toString("base64url");
  return `${header}.${payload}.${sign(`${header}.${payload}`, secret)}`;
}

/** Returns the token's claims when its signature is valid and it has not expired. */
export function verifyToken(token: string, secret: string, now = Date.now()): TokenClaims | null {
  const [h, payload, signature] = token.split(".");
  if (h !== header || !payload || !signature) return null;

  const expected = Buffer.from(sign(`${h}.${payload}`, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as TokenClaims;
    if (typeof claims.sub !== "string" || typeof claims.exp !== "number") return null;
    return claims.exp > now / 1000 ? claims : null;
  } catch {
    return null;
  }
}

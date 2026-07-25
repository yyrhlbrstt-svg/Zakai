import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "zakai_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Fixed, non-secret key used ONLY when AUTH_SECRET is absent in local
 * development. It is a hard error in production (see `secretKey`), so this can
 * never sign a real user's session. It exists so a fresh clone / preview boots
 * with working auth instead of 500-ing before any env setup.
 */
const DEV_ONLY_FALLBACK_SECRET =
  "zakai-insecure-development-only-secret-do-not-use-in-production";

let warnedAboutFallback = false;

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;

  if (secret && secret.length >= 32) {
    return new TextEncoder().encode(secret);
  }

  // In production a weak or missing signing key would let anyone forge a
  // session cookie, so refuse to run rather than degrade silently.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET is missing or shorter than 32 characters. Set a strong secret " +
        "in the environment (e.g. `openssl rand -base64 32`).",
    );
  }

  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn(
      "[zakai] AUTH_SECRET is not set — signing sessions with an INSECURE " +
        "development-only key. Set AUTH_SECRET before deploying.",
    );
  }
  return new TextEncoder().encode(DEV_ONLY_FALLBACK_SECRET);
}

export interface SessionPayload {
  userId: string;
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Returns the userId of the current session, or null. */
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, secretKey());
    return payload.userId ?? null;
  } catch {
    return null;
  }
}

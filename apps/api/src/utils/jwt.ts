import jwt from "jsonwebtoken";

const JWT_SECRET: string =
  process.env.JWT_SECRET ??
  (() => {
    throw new Error("JWT_SECRET must be set");
  })();

export interface AuthTokenPayload {
  userId: string;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (typeof decoded !== "object" || decoded === null || typeof decoded.userId !== "string") {
    throw new Error("Jeton invalide.");
  }
  return { userId: decoded.userId };
}

// Jeton intermediaire, de tres courte duree, emis apres verification du mot
// de passe quand la 2FA est activee : il ne donne acces a rien d'autre qu'a
// la finalisation de la connexion via /api/auth/2fa-login.
export function signTwoFactorPendingToken(payload: AuthTokenPayload): string {
  return jwt.sign({ ...payload, purpose: "2fa-pending" }, JWT_SECRET, { expiresIn: "5m" });
}

export function verifyTwoFactorPendingToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof decoded.userId !== "string" ||
    decoded.purpose !== "2fa-pending"
  ) {
    throw new Error("Jeton invalide.");
  }
  return { userId: decoded.userId };
}

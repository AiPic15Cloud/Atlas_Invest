import crypto from "node:crypto";

// Jeton d'acces personnel (voir schema.prisma) : deja 192 bits d'entropie
// (24 octets aleatoires), donc un hash SHA-256 simple suffit pour le
// stockage/l'index -- pas besoin du ralentissement volontaire de bcrypt,
// reserve aux secrets a faible entropie choisis par un humain (mot de
// passe, code de secours).
const TOKEN_PREFIX = "atlas_pat_";

export function generatePersonalAccessToken(): string {
  return TOKEN_PREFIX + crypto.randomBytes(24).toString("base64url");
}

export function hashPersonalAccessToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

import rateLimit from "express-rate-limit";

// Protection anti brute-force (spec section 70 : "rate limiting" cite
// explicitement parmi les mesures de securite attendues). Store en memoire
// (par defaut d'express-rate-limit) : suffisant pour une seule instance,
// mais se reinitialise a chaque redemarrage et n'est pas partage entre
// plusieurs instances -- limite connue, documentee plutot que masquee
// (garde-fou section 78, ne jamais cacher une limite silencieusement).
// Necessite `app.set("trust proxy", ...)` en amont (Railway est derriere
// un reverse proxy) : sans ca, req.ip renverrait l'IP du proxy pour toutes
// les requetes et le rate limiting deviendrait une limite globale au lieu
// d'etre par visiteur.

const RATE_LIMIT_MESSAGE = { error: "Trop de tentatives. Réessaie dans quelques minutes." };

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
});

export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
});

export const twoFactorSensitiveRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
});

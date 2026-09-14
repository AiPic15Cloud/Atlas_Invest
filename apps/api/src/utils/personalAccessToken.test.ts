import { describe, expect, it } from "vitest";
import { generatePersonalAccessToken, hashPersonalAccessToken } from "./personalAccessToken.js";

describe("personalAccessToken", () => {
  it("génère un jeton préfixé avec suffisamment d'entropie", () => {
    const token = generatePersonalAccessToken();
    expect(token.startsWith("atlas_pat_")).toBe(true);
    expect(token.length).toBeGreaterThan(30);
  });

  it("génère un jeton différent à chaque appel", () => {
    const a = generatePersonalAccessToken();
    const b = generatePersonalAccessToken();
    expect(a).not.toBe(b);
  });

  it("hash de façon déterministe (même jeton → même hash, pour l'index en base)", () => {
    const token = generatePersonalAccessToken();
    expect(hashPersonalAccessToken(token)).toBe(hashPersonalAccessToken(token));
  });

  it("des jetons différents produisent des hash différents", () => {
    const a = generatePersonalAccessToken();
    const b = generatePersonalAccessToken();
    expect(hashPersonalAccessToken(a)).not.toBe(hashPersonalAccessToken(b));
  });

  it("le hash ne contient jamais le jeton en clair", () => {
    const token = generatePersonalAccessToken();
    expect(hashPersonalAccessToken(token)).not.toContain(token);
  });
});

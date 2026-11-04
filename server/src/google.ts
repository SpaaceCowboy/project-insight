import { OAuth2Client } from 'google-auth-library';
import { DomainError } from './rules.js';

/** The small part of a Google ID token the account service needs. */
export interface GoogleProfile { sub: string; email: string; name?: string }

/** Injectable so tests can exercise linking and account creation without Google's network. */
export type GoogleVerifier = (idToken: string) => Promise<GoogleProfile>;

/** What a token is allowed to say, once Google has vouched for it. */
export interface GoogleClaims { sub?: string; email?: string; name?: string; verified: boolean }

const FAILED = 'Google sign-in could not be completed. Please try again.';
const TOKEN_INFO = 'https://oauth2.googleapis.com/tokeninfo?id_token=';

/** Reads a token's claims from Google. Injectable so the fallback can be tested without the network. */
export type ClaimsFetcher = (idToken: string, clientId: string) => Promise<GoogleClaims>;

/**
 * Google's own validation of an ID token, for when the signing keys cannot be fetched: this host is refused by
 * www.googleapis.com (HTTP 403), which is where google-auth-library reads the keys from, so every real token failed.
 * oauth2.googleapis.com is reachable and checks the signature, issuer and expiry itself; the audience, the expiry and the
 * verified email are checked here as well.
 */
export const tokenInfoClaims: ClaimsFetcher = async (idToken, clientId) => {
  let response: Response;
  try {
    response = await fetch(TOKEN_INFO + encodeURIComponent(idToken), { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new DomainError(401, 'GOOGLE_INVALID', FAILED);
  }
  if (!response.ok) throw new DomainError(401, 'GOOGLE_INVALID', FAILED);
  const info = await response.json() as {
    aud?: string; iss?: string; exp?: string; sub?: string; email?: string; name?: string; email_verified?: string | boolean;
  };
  const issuer = (info.iss ?? '').replace(/^https:\/\//, '');
  if (info.aud !== clientId || issuer !== 'accounts.google.com') throw new DomainError(401, 'GOOGLE_INVALID', FAILED);
  if (!info.exp || Number(info.exp) * 1000 <= Date.now()) throw new DomainError(401, 'GOOGLE_INVALID', FAILED);
  return { sub: info.sub, email: info.email, name: info.name, verified: info.email_verified === true || info.email_verified === 'true' };
};

/**
 * Verifies a Google ID token with the same Web client ID the app uses as `serverClientId`. The library checks the
 * signature, issuer, audience and expiry; when it cannot (no signing keys), Google's own tokeninfo does. Email ownership
 * is checked here either way.
 */
export function googleVerifier(clientId: string, fetchClaims: ClaimsFetcher = tokenInfoClaims): GoogleVerifier {
  const client = new OAuth2Client(clientId);
  return async idToken => {
    let claims: GoogleClaims;
    try {
      const payload = (await client.verifyIdToken({ idToken, audience: clientId })).getPayload();
      claims = { sub: payload?.sub, email: payload?.email, name: payload?.name, verified: payload?.email_verified === true };
    } catch {
      claims = await fetchClaims(idToken, clientId);
    }
    const sub = claims.sub ?? '';
    const email = (claims.email ?? '').trim().toLowerCase();
    if (!sub || !email || !claims.verified) throw new DomainError(401, 'GOOGLE_INVALID', FAILED);
    return { sub, email, name: claims.name };
  };
}

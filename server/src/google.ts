import { OAuth2Client } from 'google-auth-library';
import { DomainError } from './rules.js';

/** The small part of a Google ID token the account service needs. */
export interface GoogleProfile { sub: string; email: string; name?: string }

/** Injectable so tests can exercise linking and account creation without Google's network. */
export type GoogleVerifier = (idToken: string) => Promise<GoogleProfile>;

/**
 * Verifies a Google ID token with the same Web client ID the app uses as `serverClientId`.
 * The library checks the signature, issuer, audience and expiry; email ownership is checked here.
 */
export function googleVerifier(clientId: string): GoogleVerifier {
  const client = new OAuth2Client(clientId);
  return async idToken => {
    let profile: GoogleProfile;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      const payload = ticket.getPayload();
      profile = {
        sub: payload?.sub ?? '',
        email: (payload?.email ?? '').trim().toLowerCase(),
        name: payload?.name,
      };
      if (!profile.sub || !profile.email || payload?.email_verified !== true) throw new Error('GOOGLE_EMAIL_UNVERIFIED');
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError(401, 'GOOGLE_INVALID', 'Google sign-in could not be completed. Please try again.');
    }
    return profile;
  };
}

import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema.js';

const VALID_HEX_KEY = '0123456789abcdef'.repeat(4);
const VALID_JWT_SECRET = 'super-secret-jwt-token-at-least-32-chars';

describe('validateEnv', () => {
  it('applies local development defaults when optional keys are omitted or empty', () => {
    const parsed = validateEnv({
      NODE_ENV: 'development',
      DATABASE_URL: '',
      ENCRYPTION_KEY: '',
    });

    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.PORT).toBe(3000);
    expect(parsed.FRONTEND_URL).toBe('http://localhost:5173');
    expect(parsed.THROTTLE_TTL_MS).toBe(60000);
    expect(parsed.THROTTLE_LIMIT).toBe(100);
    expect(parsed.PAYPAL_MODE).toBe('sandbox');
    expect(parsed.GEMINI_MODEL).toBe('gemini-2.5-flash');
    expect(parsed.DATABASE_URL).toBeUndefined();
    expect(parsed.ENCRYPTION_KEY).toBeUndefined();
  });

  it('coerces numeric values and validates provided secret formats', () => {
    const parsed = validateEnv({
      PORT: '4000',
      THROTTLE_TTL_MS: '30000',
      THROTTLE_LIMIT: '50',
      DATABASE_URL: 'postgresql://postgres:pass@localhost:6543/postgres?pgbouncer=true',
      ENCRYPTION_KEY: VALID_HEX_KEY,
      JWT_ACCESS_SECRET: VALID_JWT_SECRET,
    });

    expect(parsed.PORT).toBe(4000);
    expect(parsed.THROTTLE_TTL_MS).toBe(30000);
    expect(parsed.THROTTLE_LIMIT).toBe(50);
    expect(parsed.ENCRYPTION_KEY).toBe(VALID_HEX_KEY);
  });

  it('rejects malformed DATABASE_URL, ENCRYPTION_KEY or short JWT secrets', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'mysql://invalid',
        ENCRYPTION_KEY: 'short-key',
        JWT_ACCESS_SECRET: 'too-short',
      }),
    ).toThrow(/Invalid environment configuration/);
  });

  it('requires all critical keys in production mode', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
      }),
    ).toThrow(/DATABASE_URL/);

    const validProd = validateEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:pass@db.example.com:6543/postgres?pgbouncer=true',
      DIRECT_URL: 'postgresql://postgres:pass@db.example.com:5432/postgres',
      JWT_ACCESS_SECRET: VALID_JWT_SECRET,
      JWT_REFRESH_SECRET: VALID_JWT_SECRET,
      JWT_2FA_TEMP_SECRET: VALID_JWT_SECRET,
      ENCRYPTION_KEY: VALID_HEX_KEY,
      GEMINI_API_KEY: 'gemini-key',
      META_APP_SECRET: 'meta-secret',
      META_VERIFY_TOKEN: 'meta-verify',
      GOOGLE_CLIENT_ID: 'google-client-id',
      GOOGLE_CLIENT_SECRET: 'google-client-secret',
      GOOGLE_REDIRECT_URI: 'https://api.example.com/api/integrations/google-calendar/callback',
      GOOGLE_MAPS_API_KEY: 'maps-key',
      PAYPAL_CLIENT_ID: 'paypal-id',
      PAYPAL_CLIENT_SECRET: 'paypal-secret',
      PAYPAL_WEBHOOK_ID: 'webhook-id',
    });

    expect(validProd.NODE_ENV).toBe('production');
  });
});

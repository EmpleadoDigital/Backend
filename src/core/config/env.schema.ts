import { z } from 'zod';

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
};

const optionalNonEmptyString = (minLength = 1) =>
  z.preprocess(emptyToUndefined, z.string().trim().min(minLength).optional());

const optionalUrl = () =>
  z.preprocess(emptyToUndefined, z.string().trim().url().optional());

const optionalPostgresUrl = () =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .regex(/^postgres(ql)?:\/\/.+/i, 'Debe ser una URL valida de PostgreSQL (postgresql://...)')
      .optional(),
  );

const optionalHexKey64 = () =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .regex(/^[0-9a-fA-F]{64}$/, 'Debe ser una clave hexadecimal de exactamente 64 caracteres (32 bytes)')
      .optional(),
  );

const PRODUCTION_REQUIRED_KEYS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_2FA_TEMP_SECRET',
  'ENCRYPTION_KEY',
  'GEMINI_API_KEY',
  'META_APP_SECRET',
  'META_VERIFY_TOKEN',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'GOOGLE_MAPS_API_KEY',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
] as const;

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    FRONTEND_URL: z.string().trim().url().default('http://localhost:5173'),
    THROTTLE_TTL_MS: z.coerce.number().int().min(1000).default(60000),
    THROTTLE_LIMIT: z.coerce.number().int().min(1).default(100),

    DATABASE_URL: optionalPostgresUrl(),
    DIRECT_URL: optionalPostgresUrl(),

    JWT_ACCESS_SECRET: optionalNonEmptyString(32),
    JWT_REFRESH_SECRET: optionalNonEmptyString(32),
    JWT_2FA_TEMP_SECRET: optionalNonEmptyString(32),
    ENCRYPTION_KEY: optionalHexKey64(),
    TOTP_ISSUER: z.preprocess(emptyToUndefined, z.string().trim().min(1).default('Empleado Digital')),

    GEMINI_API_KEY: optionalNonEmptyString(1),
    GEMINI_MODEL: z.preprocess(emptyToUndefined, z.string().trim().min(1).default('gemini-2.5-flash')),

    META_APP_SECRET: optionalNonEmptyString(1),
    META_VERIFY_TOKEN: optionalNonEmptyString(1),
    META_API_VERSION: z.preprocess(emptyToUndefined, z.string().trim().min(2).default('v21.0')),

    GOOGLE_CLIENT_ID: optionalNonEmptyString(1),
    GOOGLE_CLIENT_SECRET: optionalNonEmptyString(1),
    GOOGLE_REDIRECT_URI: optionalUrl(),
    GOOGLE_MAPS_API_KEY: optionalNonEmptyString(1),

    PAYPAL_MODE: z.preprocess(emptyToUndefined, z.enum(['sandbox', 'live']).default('sandbox')),
    PAYPAL_CLIENT_ID: optionalNonEmptyString(1),
    PAYPAL_CLIENT_SECRET: optionalNonEmptyString(1),
    PAYPAL_WEBHOOK_ID: optionalNonEmptyString(1),

    PUBLIC_TUNNEL_URL: optionalUrl(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'production') {
      return;
    }

    for (const key of PRODUCTION_REQUIRED_KEYS) {
      if (!data[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `Variable obligatoria en produccion: ${key}`,
        });
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return result.data;
}

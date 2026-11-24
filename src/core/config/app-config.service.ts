import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from './env.schema.js';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  get nodeEnv(): EnvConfig['NODE_ENV'] {
    return this.configService.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.configService.get('PORT', { infer: true });
  }

  get frontendUrl(): string {
    return this.configService.get('FRONTEND_URL', { infer: true });
  }

  get throttleTtlMs(): number {
    return this.configService.get('THROTTLE_TTL_MS', { infer: true });
  }

  get throttleLimit(): number {
    return this.configService.get('THROTTLE_LIMIT', { infer: true });
  }

  get databaseUrl(): string | undefined {
    return this.configService.get('DATABASE_URL', { infer: true });
  }

  get directUrl(): string | undefined {
    return this.configService.get('DIRECT_URL', { infer: true });
  }

  get jwtAccessSecret(): string | undefined {
    return this.configService.get('JWT_ACCESS_SECRET', { infer: true });
  }

  get jwtRefreshSecret(): string | undefined {
    return this.configService.get('JWT_REFRESH_SECRET', { infer: true });
  }

  get jwt2faTempSecret(): string | undefined {
    return this.configService.get('JWT_2FA_TEMP_SECRET', { infer: true });
  }

  get encryptionKey(): string | undefined {
    return this.configService.get('ENCRYPTION_KEY', { infer: true });
  }

  get totpIssuer(): string {
    return this.configService.get('TOTP_ISSUER', { infer: true });
  }

  get geminiApiKey(): string | undefined {
    return this.configService.get('GEMINI_API_KEY', { infer: true });
  }

  get geminiModel(): string {
    return this.configService.get('GEMINI_MODEL', { infer: true });
  }

  get metaAppSecret(): string | undefined {
    return this.configService.get('META_APP_SECRET', { infer: true });
  }

  get metaVerifyToken(): string | undefined {
    return this.configService.get('META_VERIFY_TOKEN', { infer: true });
  }

  get metaApiVersion(): string {
    return this.configService.get('META_API_VERSION', { infer: true });
  }

  get googleClientId(): string | undefined {
    return this.configService.get('GOOGLE_CLIENT_ID', { infer: true });
  }

  get googleClientSecret(): string | undefined {
    return this.configService.get('GOOGLE_CLIENT_SECRET', { infer: true });
  }

  get googleRedirectUri(): string | undefined {
    return this.configService.get('GOOGLE_REDIRECT_URI', { infer: true });
  }

  get googleMapsApiKey(): string | undefined {
    return this.configService.get('GOOGLE_MAPS_API_KEY', { infer: true });
  }

  get paypalMode(): EnvConfig['PAYPAL_MODE'] {
    return this.configService.get('PAYPAL_MODE', { infer: true });
  }

  get paypalClientId(): string | undefined {
    return this.configService.get('PAYPAL_CLIENT_ID', { infer: true });
  }

  get paypalClientSecret(): string | undefined {
    return this.configService.get('PAYPAL_CLIENT_SECRET', { infer: true });
  }

  get paypalWebhookId(): string | undefined {
    return this.configService.get('PAYPAL_WEBHOOK_ID', { infer: true });
  }

  get publicTunnelUrl(): string | undefined {
    return this.configService.get('PUBLIC_TUNNEL_URL', { infer: true });
  }
}

import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import crypto from 'node:crypto';
import { AppConfigService } from '../../../core/config/app-config.service.js';
import type {
  AccessTokenPayload,
  AuthenticatedUser,
  RefreshTokenPayload,
  TempTwoFactorTokenPayload,
} from '../entities/authenticated-user.entity.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const TEMP_2FA_TOKEN_TTL_SECONDS = 5 * 60;

export interface SignedRefreshToken {
  rawToken: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly appConfig: AppConfigService,
  ) {}

  async signAccessToken(user: AuthenticatedUser): Promise<string> {
    const secret = this.requireSecret(
      this.appConfig.jwtAccessSecret,
      'JWT_ACCESS_SECRET',
    );
    const payload: AccessTokenPayload = {
      sub: user.userId,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      type: 'access',
    };
    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
  }

  async signRefreshToken(
    userId: string,
    familyId: string = crypto.randomUUID(),
  ): Promise<SignedRefreshToken> {
    const secret = this.requireSecret(
      this.appConfig.jwtRefreshSecret,
      'JWT_REFRESH_SECRET',
    );
    const payload: RefreshTokenPayload = {
      sub: userId,
      familyId,
      jti: crypto.randomUUID(),
      type: 'refresh',
    };
    const rawToken = await this.jwtService.signAsync(payload, {
      secret,
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    });
    return {
      rawToken,
      tokenHash: this.hashToken(rawToken),
      familyId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    };
  }

  async signTwoFactorTempToken(userId: string): Promise<string> {
    const secret = this.requireSecret(
      this.appConfig.jwt2faTempSecret,
      'JWT_2FA_TEMP_SECRET',
    );
    const payload: TempTwoFactorTokenPayload = {
      sub: userId,
      type: '2fa_pending',
    };
    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn: TEMP_2FA_TOKEN_TTL_SECONDS,
    });
  }

  async verifyRefreshToken(rawToken: string): Promise<RefreshTokenPayload> {
    const secret = this.requireSecret(
      this.appConfig.jwtRefreshSecret,
      'JWT_REFRESH_SECRET',
    );
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        rawToken,
        { secret },
      );
      if (
        payload.type !== 'refresh' ||
        typeof payload.sub !== 'string' ||
        typeof payload.familyId !== 'string'
      ) {
        throw new UnauthorizedException('Invalid refresh token payload');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  private requireSecret(value: string | undefined, envName: string): string {
    if (!value) {
      throw new InternalServerErrorException(
        `${envName} is not configured in environment`,
      );
    }
    return value;
  }
}

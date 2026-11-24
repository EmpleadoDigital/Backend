import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PlanCode, SecurityEventType, UserRole } from '@prisma/client';
import crypto from 'node:crypto';
import type {
  AuthTokensResponseDto,
  AuthUserDto,
  LogoutResponseDto,
  TwoFactorPendingResponseDto,
} from '../dto/auth-response.dto.js';
import type { LoginDto } from '../dto/login.dto.js';
import type { LogoutDto } from '../dto/logout.dto.js';
import type { RefreshTokenDto } from '../dto/refresh-token.dto.js';
import type { RegisterDto } from '../dto/register.dto.js';
import type { AuthenticatedUser } from '../entities/authenticated-user.entity.js';
import {
  AuthRepository,
  type UserWithTenant,
} from '../repositories/auth.repository.js';
import { PasswordService } from './password.service.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  TEMP_2FA_TOKEN_TTL_SECONDS,
  TokenService,
} from './token.service.js';

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async register(
    dto: RegisterDto,
    meta: RequestMeta = {},
  ): Promise<AuthTokensResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.authRepository.findUserByEmail(email);
    if (existing) {
      throw new ConflictException('El correo electronico ya esta registrado');
    }

    const freePlan = await this.authRepository.findFreePlan();
    if (!freePlan) {
      throw new InternalServerErrorException(
        'Plan FREE no encontrado; ejecuta prisma db seed',
      );
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const slug = await this.generateUniqueSlug(dto.businessName);
    const userId = `usr_${crypto.randomBytes(12).toString('hex')}`;
    const familyId = crypto.randomUUID();
    const signedRefresh = await this.tokenService.signRefreshToken(
      userId,
      familyId,
    );

    const createdUser = await this.authRepository.registerOwnerTransaction({
      userId,
      businessName: dto.businessName.trim(),
      slug,
      fullName: dto.fullName.trim(),
      email,
      phone: dto.phone?.trim(),
      passwordHash,
      freePlanId: freePlan.id,
      refreshTokenHash: signedRefresh.tokenHash,
      refreshTokenFamilyId: signedRefresh.familyId,
      refreshTokenExpiresAt: signedRefresh.expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const accessToken = await this.tokenService.signAccessToken({
      userId: createdUser.id,
      email: createdUser.email,
      role: createdUser.role,
      tenantId: createdUser.tenantId,
    });

    return {
      status: 'authenticated',
      accessToken,
      refreshToken: signedRefresh.rawToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: this.toAuthUserDto(createdUser),
    };
  }

  async login(
    dto: LoginDto,
    meta: RequestMeta = {},
  ): Promise<AuthTokensResponseDto | TwoFactorPendingResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.authRepository.findUserByEmail(email);

    if (!user || !user.isActive) {
      await this.authRepository.createAuditLog({
        tenantId: user?.tenantId ?? null,
        userId: user?.id ?? null,
        eventType: SecurityEventType.LOGIN_FAILED,
        ipAddress: meta.ipAddress,
        metadata: { email, reason: 'invalid_credentials_or_inactive' },
      });
      throw new UnauthorizedException('Credenciales invalidas');
    }

    if (user.tenant && !user.tenant.isActive) {
      await this.authRepository.createAuditLog({
        tenantId: user.tenantId,
        userId: user.id,
        eventType: SecurityEventType.LOGIN_FAILED,
        ipAddress: meta.ipAddress,
        metadata: { email, reason: 'tenant_inactive' },
      });
      throw new UnauthorizedException('La cuenta del negocio esta desactivada');
    }

    const now = Date.now();
    if (user.lockedUntil && user.lockedUntil.getTime() > now) {
      await this.authRepository.createAuditLog({
        tenantId: user.tenantId,
        userId: user.id,
        eventType: SecurityEventType.LOGIN_FAILED,
        ipAddress: meta.ipAddress,
        metadata: {
          email,
          reason: 'account_locked',
          lockedUntil: user.lockedUntil.toISOString(),
        },
      });
      throw new HttpException(
        {
          code: 'ACCOUNT_LOCKED',
          lockedUntil: user.lockedUntil.toISOString(),
          message:
            'Cuenta bloqueada temporalmente por multiples intentos fallidos',
        },
        HttpStatus.LOCKED,
      );
    }

    const validPassword = await this.passwordService.verify(
      user.passwordHash,
      dto.password,
    );

    if (!validPassword) {
      const nextAttempts = user.failedLoginAttempts + 1;
      const isLockout = nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
      const lockedUntil = isLockout
        ? new Date(now + LOCKOUT_DURATION_MS)
        : null;

      await this.authRepository.recordFailedLogin({
        userId: user.id,
        tenantId: user.tenantId,
        failedAttempts: nextAttempts,
        lockedUntil,
        isLockout,
        email,
        ipAddress: meta.ipAddress,
      });

      if (isLockout && lockedUntil) {
        throw new HttpException(
          {
            code: 'ACCOUNT_LOCKED',
            lockedUntil: lockedUntil.toISOString(),
            message:
              'Cuenta bloqueada durante 15 minutos tras 5 intentos fallidos',
          },
          HttpStatus.LOCKED,
        );
      }

      throw new UnauthorizedException('Credenciales invalidas');
    }

    if (user.twoFactorEnabled) {
      await this.authRepository.clearFailedAttempts(user.id);
      const tempToken = await this.tokenService.signTwoFactorTempToken(user.id);
      return {
        status: '2fa_pending',
        tempToken,
        expiresIn: TEMP_2FA_TOKEN_TTL_SECONDS,
      };
    }

    const signedRefresh = await this.tokenService.signRefreshToken(user.id);
    await this.authRepository.recordSuccessfulLogin({
      userId: user.id,
      tenantId: user.tenantId,
      refreshTokenHash: signedRefresh.tokenHash,
      refreshTokenFamilyId: signedRefresh.familyId,
      refreshTokenExpiresAt: signedRefresh.expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const accessToken = await this.tokenService.signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });

    return {
      status: 'authenticated',
      accessToken,
      refreshToken: signedRefresh.rawToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: this.toAuthUserDto(user),
    };
  }

  async refresh(
    dto: RefreshTokenDto,
    meta: RequestMeta = {},
  ): Promise<AuthTokensResponseDto> {
    const payload = await this.tokenService.verifyRefreshToken(dto.refreshToken);
    const tokenHash = this.tokenService.hashToken(dto.refreshToken);

    const stored = await this.authRepository.findRefreshTokenByHash(tokenHash);
    if (!stored) {
      throw new UnauthorizedException('Refresh token no reconocido');
    }

    if (stored.revokedAt !== null) {
      await this.authRepository.revokeTokenFamilyWithAudit({
        familyId: stored.familyId,
        userId: stored.userId,
        tenantId: stored.user.tenantId,
        ipAddress: meta.ipAddress,
      });
      throw new UnauthorizedException(
        'Reuso de refresh token detectado; todas las sesiones de la familia fueron revocadas',
      );
    }

    if (
      stored.expiresAt.getTime() <= Date.now() ||
      stored.userId !== payload.sub ||
      !stored.user.isActive ||
      (stored.user.tenant && !stored.user.tenant.isActive)
    ) {
      await this.authRepository.revokeSingleRefreshToken(stored.id);
      throw new UnauthorizedException('Refresh token expirado o sesion inactiva');
    }

    const nextRefresh = await this.tokenService.signRefreshToken(
      stored.userId,
      stored.familyId,
    );

    await this.authRepository.rotateRefreshTokenTransaction({
      currentTokenId: stored.id,
      userId: stored.userId,
      tenantId: stored.user.tenantId,
      newTokenHash: nextRefresh.tokenHash,
      familyId: stored.familyId,
      newExpiresAt: nextRefresh.expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const accessToken = await this.tokenService.signAccessToken({
      userId: stored.user.id,
      email: stored.user.email,
      role: stored.user.role,
      tenantId: stored.user.tenantId,
    });

    return {
      status: 'authenticated',
      accessToken,
      refreshToken: nextRefresh.rawToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: this.toAuthUserDto(stored.user),
    };
  }

  async logout(
    currentUser: AuthenticatedUser,
    dto: LogoutDto,
  ): Promise<LogoutResponseDto> {
    if (dto.allSessions || !dto.refreshToken) {
      const revokedSessions =
        await this.authRepository.revokeAllUserRefreshTokens(currentUser.userId);
      return { success: true, revokedSessions };
    }

    const tokenHash = this.tokenService.hashToken(dto.refreshToken);
    const revokedSessions = await this.authRepository.revokeRefreshTokenByHash(
      currentUser.userId,
      tokenHash,
    );
    return { success: true, revokedSessions };
  }

  async getMe(currentUser: AuthenticatedUser): Promise<AuthUserDto> {
    const user = await this.authRepository.findUserByIdWithTenant(
      currentUser.userId,
    );
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }
    return this.toAuthUserDto(user);
  }

  private async generateUniqueSlug(businessName: string): Promise<string> {
    const base = businessName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);

    const cleanBase = base || 'negocio';
    if (!(await this.authRepository.slugExists(cleanBase))) {
      return cleanBase;
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `${cleanBase}-${crypto.randomBytes(2).toString('hex')}`;
      if (!(await this.authRepository.slugExists(candidate))) {
        return candidate;
      }
    }
    return `${cleanBase}-${Date.now()}`;
  }

  private toAuthUserDto(user: UserWithTenant): AuthUserDto {
    const requiresTwoFactorSetup =
      (user.role === UserRole.OWNER || user.role === UserRole.SUPER_ADMIN) &&
      !user.twoFactorEnabled;

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      tenantId: user.tenantId,
      twoFactorEnabled: user.twoFactorEnabled,
      requiresTwoFactorSetup,
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
            businessType: user.tenant.businessType,
            customerLabel: user.tenant.customerLabel,
            resourceLabel: user.tenant.resourceLabel,
            onboardingCompleted: user.tenant.onboardingCompleted,
            planCode: user.tenant.subscription?.plan.code ?? PlanCode.FREE,
          }
        : null,
    };
  }
}

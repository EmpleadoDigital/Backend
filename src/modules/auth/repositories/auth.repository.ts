import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  PlanCode,
  Prisma,
  SecurityEventType,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service.js';

const USER_WITH_TENANT_INCLUDE = {
  tenant: {
    include: {
      subscription: {
        include: {
          plan: true,
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

export type UserWithTenant = Prisma.UserGetPayload<{
  include: typeof USER_WITH_TENANT_INCLUDE;
}>;

export type RefreshTokenWithUser = Prisma.RefreshTokenGetPayload<{
  include: {
    user: {
      include: typeof USER_WITH_TENANT_INCLUDE;
    };
  };
}>;

export interface RegisterOwnerParams {
  userId: string;
  businessName: string;
  slug: string;
  fullName: string;
  email: string;
  phone?: string;
  passwordHash: string;
  freePlanId: string;
  refreshTokenHash: string;
  refreshTokenFamilyId: string;
  refreshTokenExpiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface RecordFailedLoginParams {
  userId: string;
  tenantId: string | null;
  failedAttempts: number;
  lockedUntil: Date | null;
  isLockout: boolean;
  email: string;
  ipAddress?: string;
}

export interface RecordSuccessfulLoginParams {
  userId: string;
  tenantId: string | null;
  refreshTokenHash: string;
  refreshTokenFamilyId: string;
  refreshTokenExpiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface RotateRefreshTokenParams {
  currentTokenId: string;
  userId: string;
  tenantId: string | null;
  newTokenHash: string;
  familyId: string;
  newExpiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findFreePlan() {
    return this.prisma.plan.findUnique({
      where: { code: PlanCode.FREE },
    });
  }

  findUserByEmail(email: string): Promise<UserWithTenant | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: USER_WITH_TENANT_INCLUDE,
    });
  }

  findUserByIdWithTenant(userId: string): Promise<UserWithTenant | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_WITH_TENANT_INCLUDE,
    });
  }

  async slugExists(slug: string): Promise<boolean> {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });
    return Boolean(existing);
  }

  async registerOwnerTransaction(
    params: RegisterOwnerParams,
  ): Promise<UserWithTenant> {
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: params.businessName,
          slug: params.slug,
          subscription: {
            create: {
              planId: params.freePlanId,
              status: SubscriptionStatus.ACTIVE,
              currentPeriodEnd: periodEnd,
            },
          },
        },
      });

      const [user] = await Promise.all([
        tx.user.create({
          data: {
            id: params.userId,
            tenantId: tenant.id,
            email: params.email,
            passwordHash: params.passwordHash,
            fullName: params.fullName,
            phone: params.phone ?? null,
            role: UserRole.OWNER,
            twoFactorEnabled: false,
            isActive: true,
            refreshTokens: {
              create: {
                tokenHash: params.refreshTokenHash,
                familyId: params.refreshTokenFamilyId,
                userAgent: params.userAgent ?? null,
                ipAddress: params.ipAddress ?? null,
                expiresAt: params.refreshTokenExpiresAt,
              },
            },
          },
          include: USER_WITH_TENANT_INCLUDE,
        }),
        tx.securityAuditLog.create({
          data: {
            tenantId: tenant.id,
            userId: params.userId,
            eventType: SecurityEventType.LOGIN_SUCCESS,
            ipAddress: params.ipAddress ?? null,
            metadataJson: { source: 'register' },
          },
        }),
      ]);

      return user;
    });
  }

  async recordFailedLogin(params: RecordFailedLoginParams): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: params.userId },
        data: {
          failedLoginAttempts: params.failedAttempts,
          lockedUntil: params.lockedUntil,
        },
      }),
      this.prisma.securityAuditLog.create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId,
          eventType: params.isLockout
            ? SecurityEventType.LOCKOUT
            : SecurityEventType.LOGIN_FAILED,
          ipAddress: params.ipAddress ?? null,
          metadataJson: {
            email: params.email,
            failedAttempts: params.failedAttempts,
            lockedUntil: params.lockedUntil?.toISOString() ?? null,
          },
        },
      }),
    ]);
  }

  async clearFailedAttempts(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  async recordSuccessfulLogin(
    params: RecordSuccessfulLoginParams,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: params.userId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: params.userId,
          tokenHash: params.refreshTokenHash,
          familyId: params.refreshTokenFamilyId,
          userAgent: params.userAgent ?? null,
          ipAddress: params.ipAddress ?? null,
          expiresAt: params.refreshTokenExpiresAt,
        },
      }),
      this.prisma.securityAuditLog.create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId,
          eventType: SecurityEventType.LOGIN_SUCCESS,
          ipAddress: params.ipAddress ?? null,
          metadataJson: { source: 'login' },
        },
      }),
    ]);
  }

  findRefreshTokenByHash(
    tokenHash: string,
  ): Promise<RefreshTokenWithUser | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: USER_WITH_TENANT_INCLUDE,
        },
      },
    });
  }

  async rotateRefreshTokenTransaction(
    params: RotateRefreshTokenParams,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: {
          id: params.currentTokenId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      if (revoked.count === 0) {
        throw new UnauthorizedException('Refresh token was already rotated');
      }

      await tx.refreshToken.create({
        data: {
          userId: params.userId,
          tokenHash: params.newTokenHash,
          familyId: params.familyId,
          userAgent: params.userAgent ?? null,
          ipAddress: params.ipAddress ?? null,
          expiresAt: params.newExpiresAt,
        },
      });

      await tx.securityAuditLog.create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId,
          eventType: SecurityEventType.TOKEN_ROTATED,
          ipAddress: params.ipAddress ?? null,
          metadataJson: { familyId: params.familyId },
        },
      });
    });
  }

  async revokeTokenFamilyWithAudit(params: {
    familyId: string;
    userId: string;
    tenantId: string | null;
    ipAddress?: string;
  }): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: {
          familyId: params.familyId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
      this.prisma.securityAuditLog.create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId,
          eventType: SecurityEventType.TOKEN_REUSE_DETECTED,
          ipAddress: params.ipAddress ?? null,
          metadataJson: { familyId: params.familyId },
        },
      }),
    ]);
  }

  async revokeSingleRefreshToken(tokenId: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeRefreshTokenByHash(
    userId: string,
    tokenHash: string,
  ): Promise<number> {
    const res = await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
    return res.count;
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<number> {
    const res = await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
    return res.count;
  }

  async createAuditLog(params: {
    tenantId: string | null;
    userId: string | null;
    eventType: SecurityEventType;
    ipAddress?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.securityAuditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        eventType: params.eventType,
        ipAddress: params.ipAddress ?? null,
        metadataJson: params.metadata ?? Prisma.JsonNull,
      },
    });
  }
}

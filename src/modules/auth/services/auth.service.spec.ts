import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { BusinessType, PlanCode, UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthRepository, UserWithTenant } from '../repositories/auth.repository.js';
import { AuthService } from './auth.service.js';
import type { PasswordService } from './password.service.js';
import type { TokenService } from './token.service.js';

function createMockUser(overrides: Partial<UserWithTenant> = {}): UserWithTenant {
  return {
    id: 'usr_123',
    tenantId: 'ten_123',
    email: 'owner@demo.local',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$salt$hash',
    fullName: 'Carlos Mendoza',
    phone: '+525511110001',
    role: UserRole.OWNER,
    twoFactorEnabled: false,
    twoFactorSecretEnc: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    tenant: {
      id: 'ten_123',
      name: 'Barberia Demo',
      slug: 'barberia-demo',
      businessType: BusinessType.BARBERSHOP,
      customerLabel: 'Cliente',
      resourceLabel: 'Barbero',
      address: null,
      googlePlaceId: null,
      lat: null,
      lng: null,
      arrivalNotes: null,
      bankClabeEnc: null,
      logoUrl: null,
      onboardingCompleted: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      subscription: {
        id: 'sub_123',
        tenantId: 'ten_123',
        planId: 'plan_free',
        status: 'ACTIVE',
        paypalSubscriptionId: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        aiRequestsUsed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        plan: {
          id: 'plan_free',
          code: PlanCode.FREE,
          name: 'Gratis',
          monthlyPriceMxn: 0 as unknown as UserWithTenant['tenant'] extends null ? never : any,
          setupFeeMxn: 0 as unknown as any,
          maxUsers: 1,
          maxResources: 2,
          maxAppointmentsMonth: 60,
          maxCustomers: 100,
          maxProducts: 30,
          maxAiRequestsMonth: 0,
          featuresJson: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    },
    ...overrides,
  };
}

describe('AuthService', () => {
  let authRepository: {
    findFreePlan: ReturnType<typeof vi.fn>;
    findUserByEmail: ReturnType<typeof vi.fn>;
    findUserByIdWithTenant: ReturnType<typeof vi.fn>;
    slugExists: ReturnType<typeof vi.fn>;
    registerOwnerTransaction: ReturnType<typeof vi.fn>;
    recordFailedLogin: ReturnType<typeof vi.fn>;
    clearFailedAttempts: ReturnType<typeof vi.fn>;
    recordSuccessfulLogin: ReturnType<typeof vi.fn>;
    findRefreshTokenByHash: ReturnType<typeof vi.fn>;
    rotateRefreshTokenTransaction: ReturnType<typeof vi.fn>;
    revokeTokenFamilyWithAudit: ReturnType<typeof vi.fn>;
    revokeSingleRefreshToken: ReturnType<typeof vi.fn>;
    revokeRefreshTokenByHash: ReturnType<typeof vi.fn>;
    revokeAllUserRefreshTokens: ReturnType<typeof vi.fn>;
    createAuditLog: ReturnType<typeof vi.fn>;
  };
  let passwordService: {
    hash: ReturnType<typeof vi.fn>;
    verify: ReturnType<typeof vi.fn>;
  };
  let tokenService: {
    signAccessToken: ReturnType<typeof vi.fn>;
    signRefreshToken: ReturnType<typeof vi.fn>;
    signTwoFactorTempToken: ReturnType<typeof vi.fn>;
    verifyRefreshToken: ReturnType<typeof vi.fn>;
    hashToken: ReturnType<typeof vi.fn>;
  };
  let service: AuthService;

  beforeEach(() => {
    authRepository = {
      findFreePlan: vi.fn(),
      findUserByEmail: vi.fn(),
      findUserByIdWithTenant: vi.fn(),
      slugExists: vi.fn(),
      registerOwnerTransaction: vi.fn(),
      recordFailedLogin: vi.fn(),
      clearFailedAttempts: vi.fn(),
      recordSuccessfulLogin: vi.fn(),
      findRefreshTokenByHash: vi.fn(),
      rotateRefreshTokenTransaction: vi.fn(),
      revokeTokenFamilyWithAudit: vi.fn(),
      revokeSingleRefreshToken: vi.fn(),
      revokeRefreshTokenByHash: vi.fn(),
      revokeAllUserRefreshTokens: vi.fn(),
      createAuditLog: vi.fn(),
    };
    passwordService = {
      hash: vi.fn().mockResolvedValue('$argon2id$hashed'),
      verify: vi.fn(),
    };
    tokenService = {
      signAccessToken: vi.fn().mockResolvedValue('access.jwt.token'),
      signRefreshToken: vi.fn().mockResolvedValue({
        rawToken: 'refresh.jwt.token',
        tokenHash: 'sha256_refresh',
        familyId: 'fam_1',
        expiresAt: new Date(Date.now() + 604800_000),
      }),
      signTwoFactorTempToken: vi.fn().mockResolvedValue('temp.2fa.token'),
      verifyRefreshToken: vi.fn(),
      hashToken: vi.fn().mockReturnValue('sha256_refresh'),
    };

    service = new AuthService(
      authRepository as unknown as AuthRepository,
      passwordService as unknown as PasswordService,
      tokenService as unknown as TokenService,
    );
  });

  it('registers a new business owner on FREE plan and returns JWT tokens', async () => {
    authRepository.findUserByEmail.mockResolvedValue(null);
    authRepository.findFreePlan.mockResolvedValue({ id: 'plan_free', code: PlanCode.FREE });
    authRepository.slugExists.mockResolvedValue(false);
    authRepository.registerOwnerTransaction.mockResolvedValue(createMockUser());

    const result = await service.register({
      businessName: 'Barberia Demo',
      fullName: 'Carlos Mendoza',
      email: 'OWNER@demo.local',
      password: 'Password123',
    });

    expect(result.status).toBe('authenticated');
    expect(result.accessToken).toBe('access.jwt.token');
    expect(result.refreshToken).toBe('refresh.jwt.token');
    expect(result.user.requiresTwoFactorSetup).toBe(true);
    expect(authRepository.registerOwnerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'owner@demo.local',
        slug: 'barberia-demo',
      }),
    );
  });

  it('locks account for 15 minutes on the 5th failed login attempt', async () => {
    const userOn4thFailure = createMockUser({ failedLoginAttempts: 4 });
    authRepository.findUserByEmail.mockResolvedValue(userOn4thFailure);
    passwordService.verify.mockResolvedValue(false);

    let caught: unknown;
    try {
      await service.login({ email: 'owner@demo.local', password: 'wrong' });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(HttpException);
    expect((caught as HttpException).getStatus()).toBe(HttpStatus.LOCKED);
    expect(authRepository.recordFailedLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        failedAttempts: 5,
        isLockout: true,
      }),
    );
  });

  it('returns 2fa_pending with tempToken when 2FA is enabled', async () => {
    const user2fa = createMockUser({ twoFactorEnabled: true });
    authRepository.findUserByEmail.mockResolvedValue(user2fa);
    passwordService.verify.mockResolvedValue(true);

    const res = await service.login({
      email: 'owner@demo.local',
      password: 'Password123',
    });

    expect(res).toEqual({
      status: '2fa_pending',
      tempToken: 'temp.2fa.token',
      expiresIn: 300,
    });
    expect(authRepository.clearFailedAttempts).toHaveBeenCalledWith('usr_123');
  });

  it('revokes entire token family and audits when refresh token reuse is detected', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'usr_123',
      familyId: 'fam_compromised',
      jti: 'jti_old',
      type: 'refresh',
    });
    authRepository.findRefreshTokenByHash.mockResolvedValue({
      id: 'rt_old',
      userId: 'usr_123',
      familyId: 'fam_compromised',
      revokedAt: new Date(Date.now() - 10_000),
      expiresAt: new Date(Date.now() + 100_000),
      user: createMockUser(),
    });

    await expect(
      service.refresh({ refreshToken: 'reused.token' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(authRepository.revokeTokenFamilyWithAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: 'fam_compromised',
        userId: 'usr_123',
      }),
    );
  });
});

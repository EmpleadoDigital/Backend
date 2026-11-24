import type { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  familyId: string;
  jti: string;
  type: 'refresh';
}

export interface TempTwoFactorTokenPayload {
  sub: string;
  type: '2fa_pending';
}

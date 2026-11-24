import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessType, PlanCode, UserRole } from '@prisma/client';

export class AuthTenantSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ enum: BusinessType })
  businessType: BusinessType;

  @ApiProperty()
  customerLabel: string;

  @ApiProperty()
  resourceLabel: string;

  @ApiProperty()
  onboardingCompleted: boolean;

  @ApiProperty({ enum: PlanCode })
  planCode: PlanCode;
}

export class AuthUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;

  @ApiPropertyOptional({ nullable: true })
  phone: string | null;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiPropertyOptional({ nullable: true })
  tenantId: string | null;

  @ApiProperty()
  twoFactorEnabled: boolean;

  @ApiProperty()
  requiresTwoFactorSetup: boolean;

  @ApiPropertyOptional({ type: AuthTenantSummaryDto, nullable: true })
  tenant: AuthTenantSummaryDto | null;
}

export class AuthTokensResponseDto {
  @ApiProperty({ example: 'authenticated' })
  status: 'authenticated';

  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ example: 900 })
  expiresIn: number;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}

export class TwoFactorPendingResponseDto {
  @ApiProperty({ example: '2fa_pending' })
  status: '2fa_pending';

  @ApiProperty()
  tempToken: string;

  @ApiProperty({ example: 300 })
  expiresIn: number;
}

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 1 })
  revokedSessions: number;
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../../../core/decorators/current-user.decorator.js';
import { Public } from '../../../core/decorators/public.decorator.js';
import {
  AuthTokensResponseDto,
  AuthUserDto,
  LogoutResponseDto,
  TwoFactorPendingResponseDto,
} from '../dto/auth-response.dto.js';
import { LoginDto } from '../dto/login.dto.js';
import { LogoutDto } from '../dto/logout.dto.js';
import { RefreshTokenDto } from '../dto/refresh-token.dto.js';
import { RegisterDto } from '../dto/register.dto.js';
import type { AuthenticatedUser } from '../entities/authenticated-user.entity.js';
import { AuthService } from '../services/auth.service.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Registra un negocio nuevo y su usuario OWNER local' })
  @ApiCreatedResponse({ type: AuthTokensResponseDto })
  @ApiConflictResponse({ description: 'Correo electronico ya registrado' })
  register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
  ): Promise<AuthTokensResponseDto> {
    return this.authService.register(dto, this.extractRequestMeta(request));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Inicia sesion local con Argon2id y emite JWT o tempToken 2FA',
  })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  @ApiUnauthorizedResponse({ description: 'Credenciales invalidas' })
  login(
    @Body() dto: LoginDto,
    @Req() request: Request,
  ): Promise<AuthTokensResponseDto | TwoFactorPendingResponseDto> {
    return this.authService.login(dto, this.extractRequestMeta(request));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Rota el refresh token y detecta reuso revocando la familia',
  })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token invalido, expirado o reusado' })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
  ): Promise<AuthTokensResponseDto> {
    return this.authService.refresh(dto, this.extractRequestMeta(request));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoca la sesion actual o todas las sesiones del usuario' })
  @ApiOkResponse({ type: LogoutResponseDto })
  logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: LogoutDto,
  ): Promise<LogoutResponseDto> {
    return this.authService.logout(user, dto);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Obtiene el perfil del usuario autenticado y su tenant' })
  @ApiOkResponse({ type: AuthUserDto })
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<AuthUserDto> {
    return this.authService.getMe(user);
  }

  private extractRequestMeta(request: Request) {
    const userAgentHeader = request.headers['user-agent'];
    return {
      ipAddress: request.ip,
      userAgent:
        typeof userAgentHeader === 'string' ? userAgentHeader : undefined,
    };
  }
}

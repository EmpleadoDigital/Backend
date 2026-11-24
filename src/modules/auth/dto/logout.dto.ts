import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Refresh token de la sesion a cerrar' })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({
    description: 'Si es true revoca todas las sesiones activas del usuario',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  allSessions?: boolean;
}

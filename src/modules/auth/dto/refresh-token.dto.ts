import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token rotativo emitido por NestJS' })
  @IsString()
  @MinLength(1)
  refreshToken: string;
}

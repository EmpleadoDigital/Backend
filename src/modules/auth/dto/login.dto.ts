import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'carlos@barberia.mx' })
  @IsEmail()
  @MaxLength(180)
  email: string;

  @ApiProperty({ example: 'MiClaveSegura123' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

import { ApiProperty } from '@nestjs/swagger';
import type { DatabaseStatus, HealthStatus } from '../entities/health-status.entity.js';

export class HealthResponseDto implements HealthStatus {
  @ApiProperty({ example: 'ok' })
  status: 'ok';

  @ApiProperty({ example: 'empleado-digital-backend' })
  service: string;

  @ApiProperty({ example: 'development' })
  environment: string;

  @ApiProperty({
    enum: ['connected', 'disconnected', 'not_configured'],
    example: 'connected',
  })
  database: DatabaseStatus;

  @ApiProperty({ example: 12.45 })
  uptimeSeconds: number;

  @ApiProperty({ example: '2026-11-24T06:50:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '1.0.0' })
  version: string;
}

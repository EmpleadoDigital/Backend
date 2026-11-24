import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../core/config/app-config.service.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import type { DatabaseStatus } from '../entities/health-status.entity.js';

export interface RuntimeHealthSnapshot {
  service: string;
  database: DatabaseStatus;
  uptimeSeconds: number;
  timestamp: string;
  version: string;
}

@Injectable()
export class HealthRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
  ) {}

  async checkDatabase(): Promise<DatabaseStatus> {
    if (!this.appConfig.databaseUrl) {
      return 'not_configured';
    }
    const healthy = await this.prisma.isHealthy();
    return healthy ? 'connected' : 'disconnected';
  }

  async getRuntimeSnapshot(): Promise<RuntimeHealthSnapshot> {
    const database = await this.checkDatabase();
    return {
      service: 'empleado-digital-backend',
      database,
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
    };
  }
}

import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../core/config/app-config.service.js';
import type { HealthStatus } from '../entities/health-status.entity.js';
import { HealthRepository } from '../repositories/health.repository.js';

@Injectable()
export class HealthService {
  constructor(
    private readonly healthRepository: HealthRepository,
    private readonly appConfig: AppConfigService,
  ) {}

  async getHealth(): Promise<HealthStatus> {
    const snapshot = await this.healthRepository.getRuntimeSnapshot();
    return {
      status: 'ok',
      service: snapshot.service,
      environment: this.appConfig.nodeEnv,
      database: snapshot.database,
      uptimeSeconds: snapshot.uptimeSeconds,
      timestamp: snapshot.timestamp,
      version: snapshot.version,
    };
  }
}

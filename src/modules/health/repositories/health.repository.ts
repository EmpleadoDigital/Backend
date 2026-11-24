import { Injectable } from '@nestjs/common';

export interface RuntimeHealthSnapshot {
  service: string;
  uptimeSeconds: number;
  timestamp: string;
  version: string;
}

@Injectable()
export class HealthRepository {
  getRuntimeSnapshot(): RuntimeHealthSnapshot {
    return {
      service: 'empleado-digital-backend',
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
    };
  }
}

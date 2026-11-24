import { describe, expect, it, vi } from 'vitest';
import { AppConfigService } from '../../../core/config/app-config.service.js';
import { HealthController } from './health.controller.js';
import { HealthRepository } from '../repositories/health.repository.js';
import { HealthService } from '../services/health.service.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';

describe('HealthController', () => {
  it('returns operational health payload with connected database', async () => {
    const mockAppConfig = {
      nodeEnv: 'test',
      databaseUrl: 'postgresql://postgres:pass@localhost:6543/postgres',
    } as unknown as AppConfigService;
    const mockPrisma = {
      isHealthy: vi.fn().mockResolvedValue(true),
    } as unknown as PrismaService;

    const repository = new HealthRepository(mockPrisma, mockAppConfig);
    const service = new HealthService(repository, mockAppConfig);
    const controller = new HealthController(service);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('empleado-digital-backend');
    expect(result.environment).toBe('test');
    expect(result.database).toBe('connected');
    expect(typeof result.uptimeSeconds).toBe('number');
    expect(typeof result.timestamp).toBe('string');
  });
});

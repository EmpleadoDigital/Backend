import { describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '../config/app-config.service.js';
import { PrismaService } from './prisma.service.js';

describe('PrismaService', () => {
  it('skips connection and reports unhealthy when DATABASE_URL is absent', async () => {
    const service = new PrismaService({ databaseUrl: undefined } as AppConfigService);
    const connectSpy = vi.spyOn(service, '$connect').mockResolvedValue();

    await service.onModuleInit();
    const healthy = await service.isHealthy();

    expect(connectSpy).not.toHaveBeenCalled();
    expect(healthy).toBe(false);
  });

  it('connects, queries health and disconnects cleanly when DATABASE_URL is present', async () => {
    const service = new PrismaService({
      databaseUrl: 'postgresql://postgres:pass@localhost:6543/postgres?pgbouncer=true',
    } as AppConfigService);
    const connectSpy = vi.spyOn(service, '$connect').mockResolvedValue();
    const disconnectSpy = vi.spyOn(service, '$disconnect').mockResolvedValue();
    const querySpy = vi.spyOn(service, '$queryRaw').mockResolvedValue([{ '?column?': 1 }]);

    await service.onModuleInit();
    const healthy = await service.isHealthy();
    await service.onModuleDestroy();

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(healthy).toBe(true);
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});

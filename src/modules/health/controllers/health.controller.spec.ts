import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppConfigService } from '../../../core/config/app-config.service.js';
import { HealthController } from './health.controller.js';
import { HealthRepository } from '../repositories/health.repository.js';
import { HealthService } from '../services/health.service.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        HealthRepository,
        {
          provide: AppConfigService,
          useValue: { nodeEnv: 'test' },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns operational health payload', () => {
    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('empleado-digital-backend');
    expect(result.environment).toBe('test');
    expect(typeof result.uptimeSeconds).toBe('number');
    expect(typeof result.timestamp).toBe('string');
  });
});

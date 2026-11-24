import { ArgumentsHost, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { GlobalHttpExceptionFilter } from './http-exception.filter.js';

function createMockHost(url = '/api/test', method = 'GET') {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url, method }),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('GlobalHttpExceptionFilter', () => {
  const filter = new GlobalHttpExceptionFilter();

  it('formats standard HttpException consistently', () => {
    const { host, status, json } = createMockHost('/api/health');

    filter.catch(new BadRequestException('Invalid payload'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid payload',
        path: '/api/health',
      }),
    );
  });

  it('preserves custom business fields such as PLAN_LIMIT_REACHED', () => {
    const { host, status, json } = createMockHost('/api/appointments');
    const planException = new HttpException(
      {
        code: 'PLAN_LIMIT_REACHED',
        feature: 'appointments',
        currentPlan: 'FREE',
        requiredPlan: 'BASIC',
        currentUsage: 60,
        limit: 60,
        message: 'Monthly appointment limit reached',
      },
      HttpStatus.FORBIDDEN,
    );

    filter.catch(planException, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        code: 'PLAN_LIMIT_REACHED',
        feature: 'appointments',
        currentPlan: 'FREE',
        requiredPlan: 'BASIC',
        currentUsage: 60,
        limit: 60,
      }),
    );
  });

  it('hides internal details for non-HTTP errors and returns 500', () => {
    const { host, status, json } = createMockHost('/api/crash', 'POST');

    filter.catch(new Error('Sensitive database detail'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
        path: '/api/crash',
      }),
    );
  });
});

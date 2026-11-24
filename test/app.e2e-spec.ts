import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

describe('Bootstrap & Core Security (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/health returns 200 with helmet, CORS and rate-limit headers', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'http://localhost:5173')
      .expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'empleado-digital-backend',
        database: 'connected',
      }),
    );
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
  });

  it('GET /api/docs and /api/docs-json expose Swagger OpenAPI specification', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);

    const specRes = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    expect(specRes.body.info.title).toBe('Empleado Digital API');
    expect(specRes.body.paths['/api/health']).toBeDefined();
    expect(specRes.body.components.securitySchemes['access-token']).toBeDefined();
  });

  it('returns uniform error payload on unknown routes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/non-existent-route')
      .expect(404);

    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 404,
        path: '/api/non-existent-route',
      }),
    );
  });
});

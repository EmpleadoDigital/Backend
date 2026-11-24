import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SecurityEventType } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';

describe('Local Auth, Refresh Rotation & Lockout (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const uniqueSuffix = Date.now();
  const testEmail = `e2e-auth-${uniqueSuffix}@test.local`;
  const testPassword = 'Password123!';
  let createdTenantId: string | null = null;
  let createdUserId: string | null = null;
  let initialRefreshToken = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      if (createdUserId) {
        await prisma.securityAuditLog.deleteMany({
          where: { userId: createdUserId },
        });
      }
      if (createdTenantId) {
        await prisma.tenant.deleteMany({
          where: { id: createdTenantId },
        });
      }
    }
    if (app) {
      await app.close();
    }
  });

  it('registers locally with Argon2id and enforces JWT on /auth/me', async () => {
    const regRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        businessName: `Barberia E2E ${uniqueSuffix}`,
        fullName: 'Usuario Prueba E2E',
        email: testEmail,
        phone: '+525599887766',
        password: testPassword,
      })
      .expect(201);

    expect(regRes.body.status).toBe('authenticated');
    expect(regRes.body.accessToken).toEqual(expect.any(String));
    expect(regRes.body.refreshToken).toEqual(expect.any(String));
    expect(regRes.body.user.email).toBe(testEmail);
    expect(regRes.body.user.passwordHash).toBeUndefined();
    expect(regRes.body.user.requiresTwoFactorSetup).toBe(true);
    expect(regRes.body.user.tenant.planCode).toBe('FREE');

    createdUserId = regRes.body.user.id;
    createdTenantId = regRes.body.user.tenantId;
    initialRefreshToken = regRes.body.refreshToken as string;

    const dbUser = await prisma.user.findUnique({
      where: { id: createdUserId! },
    });
    expect(dbUser?.passwordHash.startsWith('$argon2id$')).toBe(true);

    await request(app.getHttpServer()).get('/api/auth/me').expect(401);

    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${regRes.body.accessToken}`)
      .expect(200);

    expect(meRes.body.email).toBe(testEmail);
    expect(meRes.body.tenant.id).toBe(createdTenantId);
  });

  it('rotates refresh tokens and revokes entire family on reuse detection', async () => {
    const rotatedRes = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: initialRefreshToken })
      .expect(200);

    const secondRefresh = rotatedRes.body.refreshToken as string;
    expect(secondRefresh).not.toBe(initialRefreshToken);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: initialRefreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: secondRefresh })
      .expect(401);

    const reuseAudit = await prisma.securityAuditLog.findFirst({
      where: {
        userId: createdUserId!,
        eventType: SecurityEventType.TOKEN_REUSE_DETECTED,
      },
    });
    expect(reuseAudit).not.toBeNull();
  });

  it('logs in and revokes session cleanly on logout', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    const freshAccess = loginRes.body.accessToken as string;
    const freshRefresh = loginRes.body.refreshToken as string;

    const logoutRes = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${freshAccess}`)
      .send({ refreshToken: freshRefresh })
      .expect(200);

    expect(logoutRes.body.revokedSessions).toBe(1);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: freshRefresh })
      .expect(401);
  });

  it('locks account for 15 minutes after 5 failed login attempts', async () => {
    for (let attempt = 1; attempt <= 4; attempt++) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'WrongPassword123' })
        .expect(401);
    }

    const fifthRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'WrongPassword123' })
      .expect(423);

    expect(fifthRes.body.code).toBe('ACCOUNT_LOCKED');

    const sixthRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(423);

    expect(sixthRes.body.code).toBe('ACCOUNT_LOCKED');

    const lockoutAudit = await prisma.securityAuditLog.findFirst({
      where: {
        userId: createdUserId!,
        eventType: SecurityEventType.LOCKOUT,
      },
    });
    expect(lockoutAudit).not.toBeNull();
  });
});

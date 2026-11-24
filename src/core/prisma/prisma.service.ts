import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly appConfig: AppConfigService) {
    super(
      appConfig.databaseUrl
        ? { datasources: { db: { url: appConfig.databaseUrl } } }
        : undefined,
    );
  }

  async onModuleInit(): Promise<void> {
    if (!this.appConfig.databaseUrl) {
      this.logger.warn('DATABASE_URL not configured; skipping Prisma $connect');
      return;
    }
    await this.$connect();
    this.logger.log('Prisma connected to PostgreSQL database');
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.appConfig.databaseUrl) {
      return;
    }
    await this.$disconnect();
  }

  async isHealthy(): Promise<boolean> {
    if (!this.appConfig.databaseUrl) {
      return false;
    }
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.warn(
        `Database health check failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return false;
    }
  }
}

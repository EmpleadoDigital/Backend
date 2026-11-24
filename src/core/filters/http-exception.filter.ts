import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const path = request.originalUrl || request.url;
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const rawResponse = exception.getResponse();

      if (typeof rawResponse === 'object' && rawResponse !== null) {
        const {
          message,
          error,
          statusCode: _ignoredStatusCode,
          ...extraFields
        } = rawResponse as Record<string, unknown>;

        response.status(status).json({
          ...extraFields,
          statusCode: status,
          error: typeof error === 'string' ? error : exception.name,
          message: message ?? exception.message,
          path,
          timestamp,
        });
        return;
      }

      response.status(status).json({
        statusCode: status,
        error: exception.name,
        message: typeof rawResponse === 'string' ? rawResponse : exception.message,
        path,
        timestamp,
      });
      return;
    }

    const errorMessage =
      exception instanceof Error ? exception.message : 'Unexpected error';
    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(
      `Unhandled exception on ${request.method} ${path}: ${errorMessage}`,
      stack,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
      path,
      timestamp,
    });
  }
}

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
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
          ? exception.message
          : 'Unknown server error';

    const stack = exception instanceof Error ? exception.stack : undefined;
    const requestId = request.headers['x-request-id'] ?? 'none';

    this.logger.error(
      [
        `[requestId=${requestId}] ${request.method} ${request.originalUrl ?? request.url}`,
        `status=${status}`,
        `reason=${typeof message === 'string' ? message : JSON.stringify(message)}`,
        stack ? `stack=${stack}` : 'stack=unavailable',
      ].join('\n'),
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
      method: request.method,
      reason: typeof message === 'string'
        ? message
        : (message as { message?: unknown }).message ?? 'Request failed',
    });
  }
}

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode, type ApiErrorBody } from '@brokeriq/shared';
import { MonitoringService } from '../../core/monitoring/monitoring.service';

const STATUS_CODE: Record<number, ErrorCode> = {
  400: ErrorCode.VALIDATION_FAILED,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  429: ErrorCode.RATE_LIMITED,
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');
  constructor(@Optional() private readonly monitoring?: MonitoringService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    if (!res || typeof res.status !== 'function') return; // websocket context
    const body = this.toBody(exception);
    if (body.statusCode >= 500) {
      const req = ctx.getRequest();
      this.logger.error(`${req?.method} ${req?.url} → ${body.statusCode}`, exception instanceof Error ? exception.stack : String(exception));
      void this.monitoring?.record({
        source: 'API',
        message: exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : null,
        route: req?.route?.path ?? req?.url,
        method: req?.method,
        userId: req?.user?.id,
        userAgent: req?.headers?.['user-agent'],
      });
    }
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const r = exception.getResponse();
      if (r && typeof r === 'object' && 'code' in r) return r as ApiErrorBody;
      const message = typeof r === 'string' ? r : Array.isArray((r as any)?.message) ? (r as any).message.join(', ') : ((r as any)?.message ?? exception.message);
      return { statusCode: status, code: STATUS_CODE[status] ?? (status >= 500 ? ErrorCode.INTERNAL : ErrorCode.VALIDATION_FAILED), message };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const target = (exception.meta?.target as string[] | undefined)?.join(', ');
        return { statusCode: 409, code: ErrorCode.CONFLICT, message: `Already exists${target ? ` (${target})` : ''}` };
      }
      if (exception.code === 'P2025') return { statusCode: 404, code: ErrorCode.NOT_FOUND, message: 'Record not found' };
      if (exception.code === 'P2003') return { statusCode: 400, code: ErrorCode.VALIDATION_FAILED, message: 'Related record not found' };
    }
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, code: ErrorCode.INTERNAL, message: 'Something went wrong. Please try again.' };
  }
}

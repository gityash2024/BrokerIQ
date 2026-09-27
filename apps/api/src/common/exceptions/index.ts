import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, getIntegration, settingsPathFor, type ApiErrorBody } from '@brokeriq/shared';

export class AppException extends HttpException {
  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super({ statusCode: status, code, message, details } satisfies ApiErrorBody, status);
  }
}

/**
 * Thrown whenever a feature needs a third-party credential that has not been configured yet.
 * Clients show the message with a direct link to the right settings page.
 */
export class IntegrationNotConfiguredException extends HttpException {
  constructor(key: string, customMessage?: string) {
    const def = getIntegration(key);
    const name = def?.name ?? key;
    const scope = def?.scope ?? 'platform';
    const where = scope === 'platform' ? `Super Admin → Settings → Integrations → ${name}` : `Broker panel → Connectors → ${name}`;
    const body: ApiErrorBody = {
      statusCode: HttpStatus.FAILED_DEPENDENCY,
      code: ErrorCode.INTEGRATION_NOT_CONFIGURED,
      message: customMessage ?? `${name} configured नहीं है। ${where} में credentials जोड़ें।`,
      integration: {
        key,
        name,
        scope,
        settingsPath: def ? settingsPathFor(def) : '/admin/settings/integrations',
        fixBy: scope === 'platform' ? 'SUPER_ADMIN' : 'BROKER_ADMIN',
      },
    };
    super(body, HttpStatus.FAILED_DEPENDENCY);
  }
}

export class IntegrationFailedException extends AppException {
  constructor(key: string, message: string) {
    super(HttpStatus.BAD_GATEWAY, ErrorCode.INTEGRATION_FAILED, `${getIntegration(key)?.name ?? key}: ${message}`);
  }
}

export class PlanLimitException extends AppException {
  constructor(metric: string, limit: number) {
    super(HttpStatus.PAYMENT_REQUIRED, ErrorCode.PLAN_LIMIT_REACHED, `आपके plan की limit (${limit} ${metric}) पूरी हो गई है। Billing में plan upgrade करें।`, { metric, limit });
  }
}

export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTEGRATION_NOT_CONFIGURED: 'INTEGRATION_NOT_CONFIGURED',
  INTEGRATION_FAILED: 'INTEGRATION_FAILED',
  PLAN_LIMIT_REACHED: 'PLAN_LIMIT_REACHED',
  MAINTENANCE: 'MAINTENANCE',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Shape of every error body returned by the API. */
export interface ApiErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: unknown;
  /** Present when code === INTEGRATION_NOT_CONFIGURED */
  integration?: {
    key: string;
    name: string;
    scope: 'platform' | 'organization';
    /** Web route where the missing credential can be added */
    settingsPath: string;
    /** Who can fix it */
    fixBy: 'SUPER_ADMIN' | 'BROKER_ADMIN';
  };
}

export function isApiErrorBody(x: unknown): x is ApiErrorBody {
  return !!x && typeof x === 'object' && 'code' in x && 'message' in x;
}

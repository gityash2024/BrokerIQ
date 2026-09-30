import { PipeTransform, HttpStatus } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ErrorCode } from '@brokeriq/shared';
import { AppException } from '../exceptions';

export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}
  transform(value: unknown): T {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      const first = details[0];
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_FAILED,
        first ? `${first.path || 'input'}: ${first.message}` : 'Invalid input',
        details,
      );
    }
    return result.data;
  }
}

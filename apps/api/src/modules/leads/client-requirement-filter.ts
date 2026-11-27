import { BadRequestException } from '@nestjs/common';
import { clientRequirementFilterSchema } from '@brokeriq/shared';

export function clientRequirementWhere(input: unknown) {
  const parsed = clientRequirementFilterSchema.safeParse(input);
  if (!parsed.success) throw new BadRequestException(parsed.error.issues[0].message);
  const { bedrooms, minBudget, maxBudget } = parsed.data;
  if (bedrooms === undefined && minBudget === undefined && maxBudget === undefined) return undefined;
  // Compare overlapping recorded ranges. A single recorded bound is treated as the recorded budget.
  return {
    ...(bedrooms !== undefined ? { bedrooms: { has: bedrooms } } : {}),
    AND: [
      ...(minBudget !== undefined ? [{ OR: [{ maxBudget: { gte: minBudget } }, { maxBudget: null, minBudget: { gte: minBudget } }] }] : []),
      ...(maxBudget !== undefined ? [{ OR: [{ minBudget: { lte: maxBudget } }, { minBudget: null, maxBudget: { lte: maxBudget } }] }] : []),
    ],
  };
}

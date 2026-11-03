import { BadRequestException } from '@nestjs/common';
import { LeadSource, LeadStage, LeadTemperature } from '@prisma/client';
import { z } from 'zod';

const commaList = (values: string[]) =>
  z
    .string()
    .max(500)
    .refine((value) => !value || value.split(',').every((item) => values.includes(item)), 'Invalid filter value');

const schema = z.object({
  q: z.string().max(200).optional(),
  stage: commaList(Object.values(LeadStage)).optional(),
  source: commaList(Object.values(LeadSource)).optional(),
  assignedToId: z.string().max(100).optional(),
  temperature: z.union([z.nativeEnum(LeadTemperature), z.literal('')]).optional(),
  tag: z.string().max(120).optional(),
  from: z.string().max(50).optional(),
  to: z.string().max(50).optional(),
  dateField: z.enum(['createdAt', 'stageChangedAt']).optional(),
  responseSla: z.literal('eligible').optional(),
  view: z.enum(['', 'all', 'unassigned', 'mine', 'due', 'new', 'stale']).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .default(30)
    .transform((size) => Math.min(100, size)),
  sort: z.enum(['recent', 'created', 'score', 'followup']).optional(),
});

export function parseLeadQuery(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}

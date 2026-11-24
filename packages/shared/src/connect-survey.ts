import { z } from 'zod';

export const connectSurveyFieldSchema = z.object({
  label: z.string().trim().min(2).max(48).regex(/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .()/-]*$/u),
  type: z.enum(['TEXT', 'NUMBER', 'YES_NO']),
  required: z.boolean(),
}).strict();

export type ConnectSurveyField = z.infer<typeof connectSurveyFieldSchema>;
export const connectSurveyFieldTypes: Record<ConnectSurveyField['type'], string> = { TEXT: 'Text', NUMBER: 'Number', YES_NO: 'Yes / No' };
export const connectSurveyKey = (label: string) => label.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
export const connectSurveyFieldsSchema = z.array(connectSurveyFieldSchema).max(12)
  .refine((fields) => new Set(fields.map(({ label }) => connectSurveyKey(label))).size === fields.length, 'Field names must be unique');
export const connectSurveyValuesSchema = z.record(z.string(), z.object({ label: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) }));
export type ConnectSurveyValues = z.infer<typeof connectSurveyValuesSchema>;

export type ConnectSurveySuggestion = {
  field: string;
  label?: string;
  proposed: string | number | boolean | null;
  previous: string | number | boolean | null;
  conflict: boolean;
  applied: boolean;
  required?: boolean;
  confidence: number;
  evidence: string;
};

export const formatConnectSurveyValue = (value: ConnectSurveySuggestion['proposed']) =>
  value === true ? 'Yes' : value === false ? 'No' : value == null ? 'Empty' : String(value);

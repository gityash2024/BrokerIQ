'use client';

import { followUpInputSchema, visitInputSchema } from '@brokeriq/shared';
import { api, ApiError, captureAccountContext } from './api';
import { claimPrivateDraft } from './private-drafts';

const schemas = { '/follow-ups': followUpInputSchema, '/visits': visitInputSchema };
type TaskEndpoint = keyof typeof schemas;
type SavedSubmission = { id: string; payload: ReturnType<(typeof schemas)[TaskEndpoint]['parse']> };

export async function submitTask(endpoint: TaskEndpoint, leadId: string, input?: Record<string, unknown>) {
  const owner = captureAccountContext();
  const name = `task-submission:${endpoint}:${leadId}`;
  const schema = schemas[endpoint];
  const payload = input === undefined ? undefined : schema.parse({ ...input, leadId, clientMutationId: undefined });
  const candidate = payload && { id: crypto.randomUUID(), payload };
  const saved = await claimPrivateDraft<SavedSubmission>(owner, name, candidate);
  if (!saved) throw new Error('इस lead के लिए कोई अधूरी submission नहीं मिली।');
  if (payload && JSON.stringify(saved.payload.payload) !== JSON.stringify(payload)) {
    throw new Error('पहले से सहेजी हुई submission है। उसे Retry saved से पूरा करें।');
  }
  const submission = saved.payload;
  const body = schema.parse({ ...submission.payload, clientMutationId: submission.id });
  if (body.leadId !== leadId) throw new Error('Saved submission का lead मेल नहीं खाता।');

  let result: { id: string };
  try {
    result = await api<{ id: string }>(endpoint, { body, ownerContext: owner });
  } catch (error) {
    // Validation responses are issued before task creation. Keep rejected input separately for recovery.
    if (error instanceof ApiError && (error.status === 400 || error.status === 422)) {
      await saved.settle(`${name}:rejected:${submission.id}`);
    }
    throw error;
  }
  if (!result?.id) throw new Error('Server ने task की पुष्टि नहीं की। Retry saved से दोबारा जाँचें।');
  await saved.settle();
  return result;
}

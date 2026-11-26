import { randomBytes } from 'node:crypto';
import type { SettingsService } from '../settings/settings.service';

type Outcome = { feature: string; provider: string; model: string; started: number; success: boolean; tokens: number };

/** Export only operational metadata to a loopback, self-hosted Langfuse instance. */
export class AiTelemetry {
  private sending = 0;
  constructor(private readonly settings: SettingsService) {}

  record(outcome: Outcome) {
    if (this.sending >= 2) return;
    this.sending++;
    void this.send(outcome)
      .catch(() => undefined)
      .finally(() => {
        this.sending--;
      });
  }

  private async send({ feature, provider, model, started, success, tokens }: Outcome) {
    const keys = await this.settings.resolve('langfuse_local');
    if (!keys?.publicKey || !keys.secretKey) return;
    const timeNs = (ms: number) => String(BigInt(ms) * 1_000_000n);
    const attributes = [
      { key: 'langfuse.observation.type', value: { stringValue: 'generation' } },
      { key: 'langfuse.observation.model.name', value: { stringValue: model } },
      { key: 'gen_ai.provider.name', value: { stringValue: provider } },
      { key: 'brokeriq.ai.total_tokens', value: { intValue: String(tokens) } },
    ];
    const span = {
      traceId: randomBytes(16).toString('hex'),
      spanId: randomBytes(8).toString('hex'),
      name: feature,
      kind: 1,
      startTimeUnixNano: timeNs(started),
      endTimeUnixNano: timeNs(Date.now()),
      attributes,
      status: { code: success ? 1 : 2 },
    };
    const resource = { attributes: [{ key: 'service.name', value: { stringValue: 'brokeriq-api' } }] };
    const response = await fetch('http://127.0.0.1:18093/api/public/otel/v1/traces', {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: 'Basic ' + Buffer.from(keys.publicKey + ':' + keys.secretKey).toString('base64'),
        'Content-Type': 'application/json',
        'x-langfuse-ingestion-version': '4',
      },
      body: JSON.stringify({ resourceSpans: [{ resource, scopeSpans: [{ scope: { name: 'brokeriq.ai' }, spans: [span] }] }] }),
      signal: AbortSignal.timeout(2500),
    });
    await response.body?.cancel();
  }
}

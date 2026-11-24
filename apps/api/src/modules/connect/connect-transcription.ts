import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { z } from 'zod';
import { env } from '../../config/env';
import { IntegrationNotConfiguredException } from '../../common/exceptions';

const run = promisify(execFile);
const result = z.object({
  language: z.string().max(12),
  duration: z.number().nonnegative(),
  segments: z.array(z.object({ start: z.number(), end: z.number(), text: z.string() })).max(8000),
});
const program = [
  'import json,sys',
  'from faster_whisper import WhisperModel',
  'model=WhisperModel(sys.argv[1],device="cpu",compute_type="int8",local_files_only=True)',
  'segments,info=model.transcribe(sys.argv[2],beam_size=3,vad_filter=True)',
  'print(json.dumps({"language":info.language,"duration":info.duration,"segments":[{"start":s.start,"end":s.end,"text":s.text.strip()} for s in segments]},ensure_ascii=False))',
].join('\n');

export async function transcribeConnectRecording(bytes: Buffer, mime: string) {
  const model = env().CONNECT_WHISPER_MODEL;
  if (!model) throw new IntegrationNotConfiguredException('connect_transcription', 'Configure a local Faster Whisper model for BrokerIQ Connect');
  const directory = await mkdtemp(join(tmpdir(), 'biq-connect-audio-'));
  try {
    const extension = mime === 'audio/mp4' ? 'm4a' : mime === 'audio/mpeg' ? 'mp3' : mime === 'audio/aac' ? 'aac' : 'wav';
    const audio = join(directory, 'source.' + extension);
    await writeFile(audio, bytes, { mode: 0o600 });
    const { stdout } = await run(env().CONNECT_WHISPER_PYTHON, ['-c', program, model, audio], { timeout: 8 * 60_000, maxBuffer: 16 * 1024 * 1024 });
    const { language, duration, segments } = result.parse(JSON.parse(stdout));
    return {
      language,
      segments: segments.flatMap(({ start, end, text }) => {
        const from = Math.max(0, start);
        const to = Math.min(duration, end);
        return to > from && text.trim() ? [{ start: from, end: to, text }] : [];
      }),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

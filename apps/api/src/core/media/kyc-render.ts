import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { spawn } from 'node:child_process';

let rendering = 0;
function run(command: string, args: string[], body: Buffer, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    let length = 0,
      settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        child.kill('SIGKILL');
        reject(error);
      } else resolve(Buffer.concat(chunks));
    };
    const timer = setTimeout(() => finish(new ServiceUnavailableException('PDF preview timed out. Retry करें।')), 15000);
    child.on('error', () => finish(new ServiceUnavailableException('Private PDF renderer उपलब्ध नहीं है। Super Admin से संपर्क करें।')));
    child.stdout.on('data', (chunk: Buffer) => {
      length += chunk.length;
      if (length > limit) finish(new BadRequestException('PDF preview बहुत बड़ी है।'));
      else chunks.push(chunk);
    });
    child.stderr.resume(); // Parser diagnostics can contain document text; never log them.
    child.stdin.on('error', () => undefined);
    child.on('close', (code) => finish(code === 0 ? undefined : new BadRequestException('PDF खुल नहीं सकी। Password हटाकर valid PDF upload करें।')));
    child.stdin.end(body);
  });
}

/** Bounded server-side PDF rasterization: original bytes stay private, no disk temp or third-party viewer. */
export async function renderKyc(file: { contentType: string; body: Buffer }, requestedPage?: string) {
  const page = requestedPage === undefined ? 1 : Number(requestedPage);
  if (!Number.isInteger(page) || page < 1 || page > 100) throw new BadRequestException('Invalid preview page');
  if (file.contentType !== 'application/pdf') {
    if (page !== 1) throw new BadRequestException('Image में केवल एक page है।');
    return { contentType: file.contentType, data: file.body.toString('base64'), page: 1, pages: 1 };
  }
  if (rendering >= 2) throw new ServiceUnavailableException('PDF renderer व्यस्त है। थोड़ी देर में retry करें।');
  rendering++;
  try {
    const info = await run('pdfinfo', ['-'], file.body, 65536);
    const pages = Number(/^Pages:\s+(\d+)/m.exec(info.toString())?.[1]);
    if (!pages || pages > 100 || page > pages) throw new BadRequestException('PDF page count invalid है (अधिकतम 100)।');
    const png = await run('pdftoppm', ['-f', String(page), '-l', String(page), '-scale-to', '1800', '-png', '-singlefile', '-'], file.body, 12 * 1024 * 1024);
    return { contentType: 'image/png', data: png.toString('base64'), page, pages };
  } finally {
    rendering--;
  }
}

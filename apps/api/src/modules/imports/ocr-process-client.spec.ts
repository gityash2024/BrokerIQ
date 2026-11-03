import { spawn, type ChildProcess } from 'node:child_process';
import { OcrProcessClient } from './ocr-process-client';

const echo = "process.on('message', m => process.send({id:m.id,text:m.bytes.toString('hex'),confidence:88}));";
function processFor(script: string) {
  return spawn(process.execPath, ['-e', script], { serialization: 'advanced', stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: { PATH: process.env.PATH } });
}
describe('owned OCR process lifecycle (real isolated OS child processes, no OCR/provider acceptance)', () => {
  const clients: OcrProcessClient[] = [];
  const client = (factory = () => processFor(echo), timeout = 2000) => {
    const item = new OcrProcessClient(factory, timeout);
    clients.push(item);
    return item;
  };
  afterEach(async () => {
    await Promise.all(clients.splice(0).map((item) => item.close()));
  });
  it('reuses one process and preserves Buffer payloads through advanced IPC', async () => {
    const factory = jest.fn(() => processFor(echo));
    const item = client(factory);
    expect(await item.recognize(Buffer.from([0, 255, 4]), '/isolated/cache')).toEqual({ text: '00ff04', confidence: 88 });
    expect(await item.recognize(Buffer.from('next'), '/isolated/cache')).toEqual({ text: '6e657874', confidence: 88 });
    expect(factory).toHaveBeenCalledTimes(1);
  });
  it('kills a hung process and waits for its exit before starting the retry process', async () => {
    const children: ChildProcess[] = [];
    const item = client(() => {
      const child = processFor(children.length ? echo : "process.on('message', () => {});");
      children.push(child);
      return child;
    }, 1000);
    await expect(item.recognize(Buffer.from('hung'), '/isolated/cache')).rejects.toThrow('timed out');
    expect(await item.recognize(Buffer.from('retry'), '/isolated/cache')).toEqual({ text: '7265747279', confidence: 88 });
    expect(children).toHaveLength(2);
    expect(children[0].signalCode).toBe('SIGKILL');
  });
  it('rejects unexpected exit and recovers with a fresh process', async () => {
    let count = 0;
    const item = client(() => processFor(count++ ? echo : "process.on('message', () => process.exit(2));"));
    await expect(item.recognize(Buffer.from('fail'), '/isolated/cache')).rejects.toThrow('exited');
    expect((await item.recognize(Buffer.from('ok'), '/isolated/cache')).text).toBe('6f6b');
  });
  it('rejects invalid worker output without returning invented successful OCR', async () => {
    const item = client(() => processFor("process.on('message', m => process.send({id:m.id,text:'bad',confidence:NaN}));"));
    await expect(item.recognize(Buffer.from('invalid'), '/isolated/cache')).rejects.toThrow('could not read');
  });
  it('ignores an unrelated response id and accepts only its own request result', async () => {
    const item = client(() =>
      processFor(
        "process.on('message', m => {process.send({id:'another-job',text:'wrong',confidence:99});setTimeout(()=>process.send({id:m.id,text:'correct',confidence:81}),20)});",
      ),
    );
    expect(await item.recognize(Buffer.from('job'), '/isolated/cache')).toEqual({ text: 'correct', confidence: 81 });
  });
  it('refuses overlapping callers instead of creating another OCR process', async () => {
    const factory = jest.fn(() => processFor("process.on('message', m => setTimeout(()=>process.send({id:m.id,text:'one',confidence:90}),100));"));
    const item = client(factory);
    const first = item.recognize(Buffer.from('first'), '/isolated/cache');
    await expect(item.recognize(Buffer.from('second'), '/isolated/cache')).rejects.toThrow('busy');
    expect((await first).text).toBe('one');
    expect(factory).toHaveBeenCalledTimes(1);
  });
  it('shutdown rejects active work, ends the process and prevents later initialization', async () => {
    let child: ChildProcess | undefined;
    const item = client(() => {
      child = processFor("process.on('message', () => {});");
      return child;
    });
    const result = expect(item.recognize(Buffer.from('active'), '/isolated/cache')).rejects.toThrow('stopped');
    await item.close();
    await result;
    expect(child?.signalCode).toBe('SIGKILL');
    await expect(item.recognize(Buffer.from('late'), '/isolated/cache')).rejects.toThrow('stopping');
  });
});

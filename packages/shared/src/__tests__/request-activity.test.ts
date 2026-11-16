import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequestActivity } from '../request-activity';

test('reports concurrent requests until all have completed, including rejected work', async () => {
  const activity = createRequestActivity();
  const seen: number[] = [];
  const unsubscribe = activity.subscribe(() => seen.push(activity.getSnapshot()));
  let finish!: () => void;
  const first = activity.track(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const second = activity.track(async () => {
    throw new Error('cancelled');
  });
  await assert.rejects(second, /cancelled/);
  assert.equal(activity.getSnapshot(), 1);
  finish();
  await first;
  unsubscribe();
  await activity.track(async () => {});
  assert.deepEqual(seen, [1, 2, 1, 0]);
  assert.equal(activity.getSnapshot(), 0);
});

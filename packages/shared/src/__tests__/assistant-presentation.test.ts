import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { assistantBlocks, assistantDestination, assistantInlineDestination } from '../assistant-presentation';

describe('assistant presentation', () => {
  it('formats the Hindi approval reply, numbered results and the next steps', () => {
    const blocks = assistantBlocks(
      '### Approval\n\nआपके पास **2 listings** pending हैं।\n\n1. **Sector 38**\n2. **Sector 53**\n\n[Moderation queue](/admin/moderation)',
    );
    assert.deepEqual(
      blocks.map((block) => block.kind),
      ['heading', 'paragraph', 'list', 'paragraph'],
    );
    assert.deepEqual(
      blocks[1].lines[0].find((part) => part.kind === 'bold'),
      { kind: 'bold', text: '2 listings' },
    );
    assert.deepEqual(blocks[2], { kind: 'list', start: 1, lines: [[{ kind: 'bold', text: 'Sector 38' }], [{ kind: 'bold', text: 'Sector 53' }]] });
  });

  it('opens known record links on the correct surface and keeps unverified text inert', () => {
    const queue = '/admin/moderation?listing=cuid123';
    assert.equal(assistantDestination(queue), queue);
    assert.equal(assistantDestination(queue, true), 'https://brokeriq.mymultimeds.com' + queue);
    assert.equal(assistantDestination('/property/active-flat'), '/user/property/active-flat');
    assert.equal(assistantDestination('/user/property/active-flat', true), '/property/active-flat');
    assert.equal(assistantDestination('/broker/leads/lead1', true), '/lead/lead1');
    assert.equal(assistantDestination('/user/account/listings/pending-id/edit', true), '/post-property?id=pending-id');
    assert.equal(assistantDestination('/broker/listings/pending-id/edit'), '/broker/listings/pending-id/edit');
    assert.equal(assistantInlineDestination('/user/property/active-flat', ['/property/active-flat'], false), '/user/property/active-flat');
    assert.equal(assistantInlineDestination('/property/made-up', ['/property/active-flat'], false), undefined);
    assert.equal(assistantInlineDestination('/admin/moderation', [], true), '/admin/moderation');
    assert.equal(assistantInlineDestination('/admin/moderation', [], false), undefined);
    for (const unsafe of ['javascript:alert(1)', '//example.invalid', '/property/%2e%2e', '/admin/moderation?listing=one&next=https://other.invalid']) {
      assert.equal(assistantDestination(unsafe), undefined);
    }
  });
});

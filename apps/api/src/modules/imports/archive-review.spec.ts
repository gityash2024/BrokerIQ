import sharp from 'sharp';
import { zipSync, strToU8 } from 'fflate';
import { prepareArchiveReview, archiveEvidence } from './archive-review';

describe('ZIP photo vision with preserved source evidence', () => {
  async function review(vision: jest.Mock, ocrOffline = false) {
    const image = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#456789' } })
      .jpeg()
      .toBuffer();
    const body = Buffer.from(
      zipSync({
        'chat.txt': strToU8('13/11/2026, 10:00 - Broker: photo.jpg (file attached)\n13/11/2026, 10:01 - Broker: again.jpg (file attached)'),
        'photo.jpg': image,
        'again.jpg': image,
      }),
    );
    const storage = { read: jest.fn(async () => ({ body, contentType: 'application/zip' })), putImportAttachment: jest.fn(async () => 'private-photo') };
    const ocr = {
      recognize: jest.fn(async () => {
        if (ocrOffline) throw new Error('OCR process unavailable');
        return { text: 'Original photo OCR', confidence: 50 };
      }),
    };
    const result = await prepareArchiveReview(storage as any, ocr as any, { id: 'batch', mediaRef: 'zip', createdAt: new Date() }, vision);
    return { result, storage, ocr };
  }
  it('calls vision once for identical photos and associates proposals only with the matching original message', async () => {
    const proposal = [{ kind: 'INVENTORY', inventory: { sector: 'Sector 89', purpose: 'SALE', totalSalePrice: 13800000 }, warnings: ['Review photo'] }];
    const vision = jest.fn(async () => proposal);
    const { result, storage, ocr } = await review(vision);
    expect(vision).toHaveBeenCalledTimes(1);
    expect(ocr.recognize).toHaveBeenCalledTimes(1);
    expect(storage.putImportAttachment).toHaveBeenCalledTimes(1);
    expect(result.files).toHaveLength(2);
    const messages = [];
    for await (const message of result.messages) messages.push(message);
    expect(messages).toHaveLength(2);
    for (const message of messages) {
      const evidence = archiveEvidence(message, result.files);
      expect(evidence.attachments).toHaveLength(1);
      expect(evidence.attachments[0].entities).toEqual(proposal);
      expect(evidence.attachments[0].text).toBe('Original photo OCR');
      expect(evidence.identity).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(archiveEvidence({ text: 'Unrelated caption' }, result.files).attachments).toEqual([]);
  });
  it('continues to approved vision and keeps the image when the optional OCR worker is unavailable', async () => {
    const vision = jest.fn(async () => [{ kind: 'UNRELATED', warnings: ['Review original'] }]);
    const { result } = await review(vision, true);
    expect(vision).toHaveBeenCalledTimes(1);
    expect(result.files[0].mediaRef).toBe('private-photo');
    expect(result.files[0].entities).toHaveLength(1);
    expect(result.files[0].warning).toContain('OCR unavailable');
  });
  it('retains original photo and OCR after a vision outage for manual review', async () => {
    const { result } = await review(
      jest.fn(async () => {
        throw new Error('Provider busy');
      }),
    );
    expect(result.files[0].entities).toBeUndefined();
    expect(result.files[0].mediaRef).toBe('private-photo');
    expect(result.files[0].text).toBe('Original photo OCR');
    expect(result.files[0].warning).toContain('manual review');
  });
});

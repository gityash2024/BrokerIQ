import type { LocalStorageService } from '../../core/media/local-storage.service';
import type { CapturedEntity, CapturedMessage } from '@brokeriq/shared';
import sharp from 'sharp';
import { associatedAttachments, attachmentNames, zipMedia, type ArchiveMediaFile } from './archive-media';
import { openCaptureSource, zipMessages, type ArchiveSummary } from './capture-stream';
import { OcrInputError, type OcrService } from './ocr.service';

export type ReviewAttachment = Omit<ArchiveMediaFile, 'body'> & {
  mediaRef?: string;
  text?: string;
  confidence?: number;
  entities?: CapturedEntity[];
};
type Batch = { id: string; mediaRef: string; createdAt: Date };

export async function prepareArchiveReview(
  storage: LocalStorageService,
  ocr: OcrService,
  batch: Batch,
  extractPhoto?: (body: Buffer, contentType: string, text: string) => Promise<CapturedEntity[] | null>,
) {
  const open = async () => (await openCaptureSource(storage, batch.mediaRef)).bytes;
  const archive: ArchiveSummary = { textFiles: 0, attachmentFiles: 0, expandedTextBytes: 0 };
  const referenced = new Set<string>();
  for await (const message of zipMessages(await open(), archive)) {
    if (!message.system) {
      for (const name of attachmentNames(message.text)) {
        referenced.add(name);
        if (referenced.size > 10_000) throw new Error('Too many attachment references. Original ZIP preserved.');
      }
    }
  }

  const files: ReviewAttachment[] = [];
  const byHash = new Map<string, ReviewAttachment>();
  const media = { files: 0, mediaFiles: 0, ignoredFiles: 0, expandedMediaBytes: 0 };
  for await (const { body, ...file } of zipMedia(await open(), media)) {
    if (!referenced.has(file.basename)) continue;
    const attachment: ReviewAttachment = { ...file };
    const previous = file.sha256 ? byHash.get(file.contentType + ':' + file.sha256) : undefined;
    if (previous) {
      files.push({ ...previous, ...file });
      continue;
    }
    if (body && body.length) {
      if (file.contentType.startsWith('image/')) {
        const metadata = await sharp(body, { limitInputPixels: 40_000_000 })
          .metadata()
          .catch(() => null);
        const expectedType = metadata?.format === 'jpeg' ? 'image/jpeg' : `image/${metadata?.format}`;
        if (metadata?.width && metadata.height && metadata.width * metadata.height <= 40_000_000 && expectedType === file.contentType) {
          attachment.mediaRef = await storage.putImportAttachment(body, file.contentType, batch.id, batch.createdAt);
        } else {
          attachment.warning = 'Photo format or dimensions could not be verified. Original kept in ZIP.';
        }
        if (attachment.mediaRef) {
          try {
            const recognized = await ocr.recognize(body);
            attachment.text = recognized.text.trim().slice(0, 4_000);
            attachment.confidence = recognized.confidence;
            if (!attachment.text || recognized.confidence < 70) attachment.warning = 'Photo OCR needs manual verification.';
          } catch (error) {
            if (!(error instanceof OcrInputError)) throw error;
            attachment.warning = 'Photo could not be read automatically. Review the original.';
          }
          if (extractPhoto) {
            try {
              const entities = await extractPhoto(body, file.contentType, attachment.text ?? '');
              if (entities) attachment.entities = entities;
            } catch {
              attachment.warning = 'Photo AI unavailable. Original and OCR retained for manual review.';
            }
          }
        }
      } else {
        attachment.mediaRef = await storage.putImportAttachment(body, 'application/octet-stream', batch.id, batch.createdAt);
      }
    } else if (!attachment.warning) attachment.warning = 'Attachment is empty. Original kept in ZIP.';
    if (file.sha256) byHash.set(file.contentType + ':' + file.sha256, attachment);
    files.push(attachment);
  }

  const messageSummary: ArchiveSummary = { textFiles: 0, attachmentFiles: 0, expandedTextBytes: 0 };
  return { archive, media, files, messages: zipMessages(await open(), messageSummary) };
}

export function archiveEvidence(message: CapturedMessage, files: ReviewAttachment[]) {
  if (message.system) return { attachments: [], warnings: [], identity: '' };
  const { matches, missing, ambiguous } = associatedAttachments(message.text, files);
  return {
    attachments: matches,
    warnings: [
      ...missing.map((name) => `Attachment missing from archive: ${name}`),
      ...ambiguous.map((name) => `Multiple archive files match ${name}. Verify the original ZIP.`),
    ],
    identity: matches
      .map((item) => item.sha256 ?? '')
      .filter(Boolean)
      .join(':'),
  };
}

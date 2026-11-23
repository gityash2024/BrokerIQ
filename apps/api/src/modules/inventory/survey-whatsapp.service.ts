import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { normalizeIndianPhone } from '@brokeriq/shared';
import { JobsService } from '../../core/jobs/jobs.service';
import { LocalStorageService } from '../../core/media/local-storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { env } from '../../config/env';

type SurveyJob = { organizationId: string; messageId: string };
export const surveyIntakeJob = 'inventory.survey-whatsapp';

export function surveyWhatsAppFacts(text: string) {
  const bhk = text.match(/\b([1-9])\s*BHK\b/i);
  const floor = text.match(/\b(GF|FF|SF|TF|[1-9]\d?(?:st|nd|rd|th)\s*floor)\b/i);
  const furnishing = text.match(/\b(semi[- ]furnished|fully[- ]furnished|unfurnished|SFD|FFD)\b/i);
  const rent = text.match(/\b(?:rent|monthly rent)\s*[:=]?\s*₹?\s*(\d[\d,]{1,8})(?:\s*(k)\b)?/i);
  const conflict =
    new Set(Array.from(text.matchAll(/\b([1-9])\s*BHK\b/gi), (match) => match[1])).size > 1 ||
    new Set(Array.from(text.matchAll(/\b(GF|FF|SF|TF|[1-9]\d?(?:st|nd|rd|th)\s*floor)\b/gi), (match) => match[1].toUpperCase())).size > 1 ||
    new Set(Array.from(text.matchAll(/\b(semi[- ]furnished|fully[- ]furnished|unfurnished|SFD|FFD)\b/gi), (match) => match[1].toUpperCase())).size > 1 ||
    new Set(
      Array.from(
        text.matchAll(/\b(?:rent|monthly rent)\s*[:=]?\s*₹?\s*(\d[\d,]{1,8})(?:\s*(k)\b)?/gi),
        (match) => Number(match[1].replace(/,/g, '')) * (match[2] ? 1000 : 1),
      ),
    ).size > 1;
  const rentAmount = rent ? Number(rent[1].replace(/,/g, '')) * (rent[2] ? 1000 : 1) : undefined;
  return {
    conflict,
    ...(bhk && { bhk: Number(bhk[1]), roomKind: 'BHK' }),
    ...(floor && { floor: floor[1].replace(/\s+/g, ' ').toUpperCase() }),
    ...(furnishing && {
      furnishing: /^semi|^sfd$/i.test(furnishing[1]) ? 'SEMI_FURNISHED' : /^fully|^ffd$/i.test(furnishing[1]) ? 'FULLY_FURNISHED' : 'UNFURNISHED',
    }),
    ...(rentAmount && rentAmount >= 1000 && rentAmount <= 10_000_000 && { monthlyRent: rentAmount }),
  };
}

@Injectable()
export class SurveyWhatsAppService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly jobs: JobsService,
    private readonly media: LocalStorageService,
  ) {}

  onModuleInit() {
    this.jobs.register(surveyIntakeJob, (payload: SurveyJob) => this.ingest(payload));
  }

  async ingest({ organizationId, messageId }: SurveyJob) {
    await this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Message" WHERE id = ${messageId} FOR UPDATE`;
        const message = await tx.message.findFirst({
          where: { id: messageId, direction: 'INBOUND', conversation: { organizationId, channel: 'WHATSAPP' } },
          include: { conversation: { select: { contactPhone: true, leadId: true } } },
        });
        if (!message) return;
        const meta = (message.meta ?? {}) as Prisma.JsonObject;
        if (meta.surveyIntake) return;
        const phone = normalizeIndianPhone(message.conversation.contactPhone ?? '');
        if (!phone || message.conversation.leadId) return;
        const text = message.body ?? '';
        const { conflict, ...facts } = surveyWhatsAppFacts(text);
        const photo = message.type === 'IMAGE' && /\b(?:property|house|flat|unit)\s+(?:photos?|pictures?)\b/i.test(text) ? message.mediaUrl : null;
        const relevant = Object.keys(facts).length > 0 || photo || /\b(?:rented out|available from|property details|sector\s*\d+)\b/i.test(text);
        if (!relevant) return;

        const phoneValues = [phone, phone.slice(-10), phone.slice(1)];
        const where = {
          organizationId,
          deletedAt: null,
          sourceType: 'SURVEY',
          status: 'DRAFT',
          OR: [{ ownerPhone: { in: phoneValues } }, { contacts: { some: { phone: { in: phoneValues } } } }],
        } satisfies Prisma.InventoryItemWhereInput;
        // Serialize verified updates to a single phone, including two events in one provider delivery.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`survey-whatsapp:${organizationId}:${phone}`}))`;
        const matches = await tx.inventoryItem.findMany({ where, select: { id: true }, take: 2 });
        let state = matches.length ? 'REVIEW' : 'NOTES';
        let inventoryId: string | undefined;
        if (matches.length === 1 && !conflict) {
          inventoryId = matches[0].id;
          await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${inventoryId} FOR UPDATE`;
          const item = await tx.inventoryItem.findFirst({ where: { ...where, id: inventoryId } });
          const same = (key: string, current: unknown, proposed: unknown) => {
            if (key === 'floor') {
              const codes: Record<string, string> = { GF: '0', FF: '1', SF: '2', TF: 'TOP', 'GROUND FLOOR': '0', 'TOP FLOOR': 'TOP' };
              const label = (value: unknown) => {
                const normalized = String(value).trim().toUpperCase();
                return codes[normalized] ?? normalized.match(/^(\d+)(?:ST|ND|RD|TH)?(?: FLOOR)?$/)?.[1] ?? normalized;
              };
              return label(current) === label(proposed);
            }
            return String(current) === String(proposed);
          };
          if (
            item &&
            !Object.entries(facts).some(([key, value]) => {
              const current = item[key as keyof typeof item];
              return current != null && current !== '' && !same(key, current, value);
            })
          ) {
            const updates = Object.fromEntries(
              Object.entries(facts).filter(([key]) => item[key as keyof typeof item] == null || item[key as keyof typeof item] === ''),
            );
            const photoUrl = photo && item.photoUrls.length < 50 ? await this.copyPhoto(photo, organizationId, messageId) : null;
            if (Object.keys(updates).length || photoUrl) {
              await tx.inventoryItem.update({
                where: { id: item.id },
                data: {
                  ...updates,
                  ...(typeof updates.monthlyRent === 'number' && { rent: updates.monthlyRent, price: updates.monthlyRent }),
                  ...(photoUrl && !item.photoUrls.includes(photoUrl) && { photoUrls: { push: photoUrl } }),
                  revision: { increment: 1 },
                },
              });
              state = 'MATCHED';
            }
          }
        }
        await tx.message.update({ where: { id: messageId }, data: { meta: { ...meta, surveyIntake: { state, ...(inventoryId && { inventoryId }) } } } });
      },
      { timeout: 20_000 },
    );
  }

  private async copyPhoto(value: string, organizationId: string, messageId: string) {
    if (!this.media.enabled) return null;
    const url = new URL(value);
    if (url.origin !== new URL(env().PUBLIC_API_URL).origin) return null;
    const parts = url.pathname.match(/^\/api\/media\/f\/(scan\/([A-Za-z0-9_-]+)\/(\d{6})\/[A-Za-z0-9]{20})$/);
    if (!parts || parts[2] !== organizationId) return null;
    const photo = await this.media.read(parts[1]);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.contentType)) return null;
    const name = createHash('sha256').update(messageId).digest('hex').slice(0, 20);
    const key = `listing/${organizationId}/${parts[3]}/${name}`;
    await this.media.store(key, photo.contentType, photo.body);
    return `${env().PUBLIC_API_URL.replace(/\/$/, '')}/api/media/f/${key}`;
  }

  async notes(organizationId: string) {
    const rows = await this.db.message.findMany({
      where: {
        direction: 'INBOUND',
        conversation: { organizationId, channel: 'WHATSAPP' },
        OR: ['REVIEW', 'NOTES'].map((state) => ({ meta: { path: ['surveyIntake', 'state'], equals: state } })),
      },
      select: { id: true, body: true, createdAt: true, conversationId: true, conversation: { select: { contactName: true, contactPhone: true } }, meta: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    return rows.map(({ meta, ...row }) => ({ ...row, state: ((meta as Prisma.JsonObject)?.surveyIntake as Prisma.JsonObject)?.state }));
  }
}

'use client';
import Link from 'next/link';
import { Building2, FileCheck2, MapPin, Phone, MessageCircle, Navigation, Pencil, Share2, Archive, ShieldCheck } from 'lucide-react';
import {
  inventoryFactGroups,
  inventoryPrice,
  inventoryTitle,
  inventoryNavigation,
  inventoryPossessionLabel,
  readableValue,
  isPendingSurvey,
  type LedgerItem,
} from '@brokeriq/shared';
import { Button } from '@/components/ui/button';
import { PrivateSource } from './private-source';
import { PropertyMedia } from './property-media';
export function InventoryDetails({
  item,
  onEdit,
  onPublish,
  sourceHref,
  onMessage,
  onArchive,
  onRestore,
  onUploadPhoto,
  onSetAgentCoverPhoto,
}: {
  sourceHref?: string | null;
  onMessage?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onUploadPhoto?: (url: string) => Promise<void>;
  onSetAgentCoverPhoto?: (url: string | null) => Promise<void>;
  item: LedgerItem;
  onEdit?: () => void;
  onPublish?: () => void;
}) {
  const navigation = inventoryNavigation(item);
  const survey = isPendingSurvey(item);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="card relative overflow-hidden p-4">
          <Building2 className="absolute -right-5 -top-4 size-36 text-brand-500/5" aria-hidden />
          {(survey || item.availability === 'AVAILABLE') && <p className="text-sm font-semibold text-brand-600">{inventoryPossessionLabel(item)}</p>}
          {!survey && <h2 className="mt-1 font-display text-2xl font-bold text-fg">{inventoryPrice(item)}</h2>}
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <MapPin className="size-4 shrink-0" />
            {item.sector || 'Locality not recorded'}
          </p>
          <p className="mt-2 text-sm text-muted">{inventoryTitle(item)}</p>
          <a href="#property-navigation" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-600">
            <Navigation className="size-4" /> Navigation
          </a>
        </section>
        <section id="property-navigation" aria-labelledby="navigation-heading" className="scroll-mt-24 rounded-2xl border border-line bg-surface p-4">
          <h3 id="navigation-heading" className="mb-2 font-semibold">
            Navigation
          </h3>
          <div className="flex flex-wrap gap-2">
            {navigation.route && (
              <Button href={navigation.route} external>
                <Navigation className="size-4" /> {navigation.exact ? 'Navigate to property' : 'Directions from recorded address'}
              </Button>
            )}
            {navigation.sectorMap && (
              <Button href={navigation.sectorMap} variant="secondary" external>
                <MapPin className="size-4" /> ABC Buildcon sector map
              </Button>
            )}
          </div>
          {!navigation.route && <p className="mt-2 text-sm text-muted">Add a Maps link or property address for door-to-door directions.</p>}
        </section>
      </div>
      <div className="flex flex-wrap gap-2">
        <span
          className={`rounded-lg px-3 py-2 text-xs font-semibold ${item.availability === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}
        >
          {item.availability === 'UNKNOWN' ? 'Availability needs confirmation' : readableValue(item.availability ?? 'UNKNOWN')}
        </span>
        <span className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">{readableValue(item.verificationStatus ?? 'NEEDS_REVIEW')}</span>
        <span className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          {readableValue(item.sourceType)}
          {item.pageNo ? ` · Page ${item.pageNo}` : ''}
        </span>
        {item.assignedTo && (
          <span className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">
            <span className="text-brand-600">Assignee:</span>
            <span className="font-semibold">{item.assignedTo.name}</span>
          </span>
        )}
      </div>
      {item.deletedAt ? (
        <div className="rounded-xl border border-line p-4 text-sm">
          Archived property · retained privately. {onRestore && <Button onClick={onRestore}>Restore private property</Button>}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {
            <Button disabled={!onEdit} title={!onEdit ? 'This action requires permission from your Broker Admin' : undefined} onClick={onEdit} size="sm">
              <Pencil className="size-4" /> Edit property
            </Button>
          }
          {
            <Button
              variant="secondary"
              size="sm"
              disabled={!onPublish}
              title={!onPublish ? 'This action requires permission from your Broker Admin' : undefined}
              onClick={onPublish}
            >
              <FileCheck2 className="size-4" /> Publish / review property
            </Button>
          }
          {
            <Button
              variant="secondary"
              size="sm"
              disabled={!onMessage}
              title={!onMessage ? 'This action requires permission from your Broker Admin' : undefined}
              onClick={onMessage}
            >
              <Share2 className="size-4" /> Share property
            </Button>
          }
          {
            <Button
              variant="dangerOutline"
              size="sm"
              disabled={!onArchive}
              title={!onArchive ? 'This action requires permission from your Broker Admin' : undefined}
              onClick={onArchive}
            >
              <Archive className="size-4" /> Archive property
            </Button>
          }
        </div>
      )}
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid gap-3 md:grid-cols-2">
          {inventoryFactGroups(item).map((group) => (
            <section key={group.title} className="min-w-0 rounded-2xl border border-line p-4">
              <h3 className="mb-3 font-display text-base font-bold">{group.title}</h3>
              <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {group.facts.map((fact) => (
                  <div key={fact.label} className="min-w-0">
                    <dt className="text-xs text-muted">{fact.label}</dt>
                    <dd className="mt-1 break-words text-sm font-semibold">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          {!!item.amenities?.length && (
            <section className="rounded-2xl border border-line p-4 md:col-span-2">
              <h3 className="mb-3 font-bold">Amenities</h3>
              <div className="flex flex-wrap gap-2">
                {item.amenities.map((value) => (
                  <span key={value} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
                    {readableValue(value)}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
        <aside className="grid min-w-0 gap-3 md:grid-cols-2 lg:grid-cols-1">
          <section className="min-w-0 rounded-2xl border border-line p-4">
            <h3 className="mb-3 flex items-center gap-2 font-bold">
              <Phone className="size-4 text-brand-600" />
              Contacts
            </h3>
            <div className="grid gap-2">
              {(item.contacts.length ? item.contacts : item.ownerPhone ? [{ name: item.ownerName, phone: item.ownerPhone, role: 'UNKNOWN' as const }] : []).map(
                (contact, i) => (
                  <div key={i} className="rounded-xl border border-line bg-surface-2 p-3">
                    <p className="font-semibold">{contact.name || 'Name not recorded'}</p>
                    <p className="mt-1 text-xs text-muted">{readableValue(contact.role)}</p>
                    {contact.phone && (
                      <>
                        <p className="mt-3 text-sm">{contact.phone}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <a
                            className="action-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                            href={`tel:${contact.phone}`}
                          >
                            <Phone className="size-3.5" />
                            Call
                          </a>
                          <a
                            className="action-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                            href={`https://wa.me/91${contact.phone.replace(/\D/g, '').slice(-10)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircle className="size-3.5" />
                            WhatsApp
                          </a>
                        </div>
                      </>
                    )}
                    {contact.note && <p className="mt-3 text-xs text-muted">{contact.note}</p>}
                  </div>
                ),
              )}
            </div>
            {!item.contacts.length && !item.ownerPhone && <p className="text-sm text-muted">No contact has been recorded.</p>}
          </section>
          {(!item.deletedAt || !!item.photoUrls?.length || !!item.videoUrls?.length) && (
            <div className="min-w-0 space-y-3 rounded-2xl border border-line p-4">
              {item.agentCoverPhotoUrl && !item.photoUrls?.length ? (
                <section aria-label="Property cover photo" className="space-y-3">
                  <h3 className="font-semibold">Property cover photo</h3>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.agentCoverPhotoUrl} alt="Property cover photo" referrerPolicy="no-referrer" className="w-full rounded-xl object-contain" />
                </section>
              ) : (
                (!item.deletedAt || !!item.photoUrls?.length) && (
                  <PropertyMedia
                    urls={item.photoUrls ?? []}
                    camera={survey}
                    disabled={!!item.deletedAt || !onUploadPhoto}
                    onAdd={(url) => onUploadPhoto?.(url)}
                    agentCoverPhotoUrl={item.agentCoverPhotoUrl}
                    onSetAgentCoverPhoto={onSetAgentCoverPhoto}
                  />
                )
              )}
              {!!item.videoUrls?.length && <PropertyMedia video urls={item.videoUrls} disabled onAdd={() => undefined} />}
            </div>
          )}
        </aside>
      </div>
      {!!item.notes && (
        <section className="rounded-2xl bg-surface-2 p-5">
          <h3 className="mb-3 font-bold">Internal notes</h3>
          <p className="whitespace-pre-wrap text-sm leading-6 text-muted">{item.notes}</p>
        </section>
      )}
      {!!item.videoUrls?.length && (
        <section className="flex flex-wrap gap-3">
          {item.videoUrls.map((url, index) => (
            <Button key={url} href={url} external variant="secondary">
              Property video {index + 1}
            </Button>
          ))}
        </section>
      )}
      {item.sourceEntry && (
        <section className="rounded-2xl border border-line p-5">
          <h3 className="mb-3 flex items-center gap-2 font-bold">
            <FileCheck2 className="size-5 text-brand-600" />
            Original source & audit
          </h3>
          {item.sourceEntry.batch?.id && (item.pageNo || item.sourceEntry.batch.sourceType === 'IMAGE') && (
            <PrivateSource path={`/imports/${item.sourceEntry.batch.id}/source?${item.pageNo ? `pageNo=${item.pageNo}&` : ''}entryId=${item.sourceEntry.id}`} />
          )}
          {item.sourceEntry.rawText !== item.notes && <p className="my-4 whitespace-pre-wrap text-xs leading-6 text-muted">{item.sourceEntry.rawText}</p>}
          {item.sourceEntry.batch?.id && sourceHref !== null && (
            <Link
              href={sourceHref ?? `/broker/imports/${item.sourceEntry.batch.id}`}
              className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-600"
            >
              Open source review →
            </Link>
          )}
        </section>
      )}
      <footer className="flex items-start gap-3 rounded-xl bg-brand-500/5 p-4 text-xs leading-5 text-muted">
        <ShieldCheck className="size-5 shrink-0 text-brand-600" />
        <p>
          Revision {item.revision} · Updated {new Date(item.updatedAt).toLocaleString('en-IN')}. Private contacts, source images and notes stay within your
          authorized workspace. Public publishing requires a separate reviewed preview.
        </p>
      </footer>
    </div>
  );
}

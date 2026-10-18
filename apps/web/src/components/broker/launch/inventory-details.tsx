'use client';
import Link from 'next/link';
import { Building2, FileCheck2, MapPin, Phone, MessageCircle, ShieldCheck } from 'lucide-react';
import { inventoryFactGroups, inventoryPrice, inventoryTitle, readableValue, type LedgerItem } from '@brokeriq/shared';
import { Button } from '@/components/ui/button';
import { PrivateSource } from './private-source';
export function InventoryDetails({ item, onEdit, onPublish }: { item: LedgerItem; onEdit: () => void; onPublish: () => void }) {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-indigo-800 to-brand-600 p-6 text-white">
        <Building2 className="absolute -right-5 -top-4 size-44 text-white/5" aria-hidden />
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-200">Private property record</p>
        <h2 className="mt-3 font-display text-3xl font-extrabold">{inventoryPrice(item)}</h2>
        <p className="mt-3 flex items-center gap-2 text-sm text-indigo-100">
          <MapPin className="size-4 shrink-0" />
          {item.sector || 'Locality not recorded'}
        </p>
        <p className="mt-2 text-sm text-indigo-100">{inventoryTitle(item)}</p>
      </section>
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
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button onClick={onEdit}>Edit property</Button>
        <Button variant="secondary" onClick={onPublish}>
          Publish / review rental
        </Button>
      </div>
      {!!item.photoUrls?.length && (
        <section>
          <h3 className="mb-3 font-bold">Property photographs</h3>
          <div className="grid grid-cols-2 gap-3">
            {item.photoUrls.map((url, index) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={`Property photograph ${index + 1}`} className="aspect-[4/3] w-full rounded-2xl object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        </section>
      )}
      {inventoryFactGroups(item).map((group) => (
        <section key={group.title} className="rounded-2xl border border-line p-5">
          <h3 className="mb-4 font-display text-lg font-bold">{group.title}</h3>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
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
        <section>
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
      <section>
        <h3 className="mb-3 flex items-center gap-2 font-bold">
          <Phone className="size-4 text-brand-600" />
          Contacts
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {(item.contacts.length ? item.contacts : item.ownerPhone ? [{ name: item.ownerName, phone: item.ownerPhone, role: 'UNKNOWN' as const }] : []).map(
            (contact, i) => (
              <div key={i} className="rounded-2xl border border-line bg-surface-2 p-4">
                <p className="font-semibold">{contact.name || 'Name not recorded'}</p>
                <p className="mt-1 text-xs text-muted">{readableValue(contact.role)}</p>
                {contact.phone && (
                  <>
                    <p className="mt-3 text-sm">{contact.phone}</p>
                    <div className="mt-3 flex gap-3">
                      <a
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-xs font-semibold"
                        href={`tel:${contact.phone}`}
                      >
                        <Phone className="size-3.5" />
                        Call
                      </a>
                      <a
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-xs font-semibold"
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
          {item.sourceEntry.batch?.id && (
            <Link href={`/broker/imports/${item.sourceEntry.batch.id}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-600">
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

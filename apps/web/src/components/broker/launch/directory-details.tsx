'use client';
import { Building2, MapPin, ShieldCheck, ExternalLink, ImageOff } from 'lucide-react';
import { directoryProfile, type DirectoryRecord } from '@brokeriq/shared';
export function DirectoryDetails({ record }: { record: DirectoryRecord }) {
  const profile = directoryProfile(record);
  const facts = [
    ['Developer / promoter', record.builderName],
    ['Sector / locality', record.sector],
    ['Address', record.address],
    ['City', record.city ?? 'Gurugram'],
    ['Source category', record.category],
    ['Registration / licence', record.registrationNumber],
    ['Registry status', record.registrationStatus],
    ['Registration up to · Source value', record.registrationUntil],
    ['Category evidence', record.categoryEvidence],
    ...profile.facts.map((fact) => [fact.label, fact.value]),
  ].filter(([, value]) => value != null && value !== '');
  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 to-brand-600 p-6 text-white">
        <Building2 className="absolute -right-5 top-0 size-40 text-white/5" aria-hidden />
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-200">Project intelligence · {record.provider}</p>
        <h2 className="mt-3 font-display text-2xl font-bold">{record.name.trim()}</h2>
        <p className="mt-3 text-sm text-indigo-100">{record.builderName || 'Developer not recorded by source'}</p>
        <p className="mt-2 flex items-center gap-2 text-sm text-indigo-100">
          <MapPin className="size-4 shrink-0" />
          {record.address || record.sector || 'Address not recorded'}
        </p>
      </header>
      {!!profile.photos.length ? (
        <section>
          <h3 className="mb-3 font-bold">Source-verified project images</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {profile.photos.map((photo) => (
              <figure key={photo.url}>
                <a href={photo.sourceUrl} target="_blank" rel="noreferrer">
                  <img src={photo.url} alt={photo.caption} className="aspect-[4/3] w-full rounded-2xl object-cover" loading="lazy" />
                </a>
                <figcaption className="mt-2 text-[11px] leading-5 text-muted">
                  {photo.caption}. {photo.author} ·{' '}
                  <a href={photo.licenseUrl} target="_blank" rel="noreferrer" className="underline">
                    {photo.license}
                  </a>
                  {photo.capturedAt ? ` · ${photo.capturedAt}` : ''}. Image date and current site condition may differ.
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-surface-2 p-3 text-xs text-muted">
          <ImageOff className="size-4 shrink-0" />
          No verified project photograph in the available sources.
        </p>
      )}
      <section className="rounded-2xl border border-line p-5">
        <h3 className="mb-4 text-lg font-bold">Project facts</h3>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {facts.map(([label, value], index) => (
            <div key={index} className="min-w-0">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="mt-1 break-words text-sm font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      {profile.tables.map((table) => (
        <details key={table.key} className="rounded-2xl border border-line p-5">
          <summary className="cursor-pointer font-bold">
            {table.title}
            <span className="ml-2 text-xs font-normal text-muted">{table.rows.length} source rows</span>
          </summary>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-xs">
              <caption className="sr-only">{table.title}</caption>
              <tbody className="divide-y divide-line">
                {table.rows.map((row, index) => (
                  <tr key={index}>
                    {row.map((value, column) => (
                      <td key={column} className="max-w-sm px-3 py-3 align-top leading-5 first:pl-0">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
      <section className="rounded-2xl border border-line p-5">
        <h3 className="mb-3 font-bold">Location & coverage</h3>
        {record.latitude != null && record.longitude != null ? (
          <>
            <p className="text-sm">
              {record.latitude.toFixed(6)}, {record.longitude.toFixed(6)}
            </p>
            <p className="my-2 text-xs leading-5 text-muted">
              {record.coordinateSource?.replaceAll('_', ' ')}. Source-derived point; it may represent a colony or building centre rather than its entrance.
            </p>
            <a
              href={`https://www.openstreetmap.org/?mlat=${record.latitude}&mlon=${record.longitude}#map=16/${record.latitude}/${record.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-600"
            >
              Open location <ExternalLink className="size-4" />
            </a>
          </>
        ) : (
          <p className="text-sm text-muted">Coordinates are not available in this source. The record remains searchable in List.</p>
        )}
      </section>
      <section className="rounded-2xl bg-surface-2 p-5">
        <h3 className="flex items-center gap-2 font-bold">
          <ShieldCheck className="size-5 text-brand-600" />
          Source & provenance
        </h3>
        <p className="mt-3 text-xs leading-6 text-muted">
          {profile.note} Different registrations and phases remain separate. Planned dates, specifications and approvals are historical source statements; they
          do not confirm current possession, approval or unit availability.
        </p>
        <div className="my-3 flex flex-wrap gap-4">
          {profile.sourceUrl && (
            <a href={profile.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-600">
              Official record ↗
            </a>
          )}
          {profile.enrichmentUrl && (
            <a href={profile.enrichmentUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-600">
              Detailed source form ↗
            </a>
          )}
        </div>
        <p className="text-xs leading-5 text-muted">
          {record.provider} · {record.externalId} · Retrieved {new Date(record.sourceFetchedAt).toLocaleString('en-IN')}
          {profile.enrichedAt ? ` · Details fetched ${new Date(profile.enrichedAt).toLocaleDateString('en-IN')}` : ''}
        </p>
        {profile.attribution && <p className="mt-2 text-xs text-muted">{profile.attribution}</p>}
        <p className="mt-3 text-xs font-semibold">Directory information does not add a property to your firm’s private inventory.</p>
      </section>
    </div>
  );
}

'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Calendar,
  ChevronRight,
  Compass,
  Eye,
  Flag,
  Layers,
  MapPin,
  Pencil,
  Share2,
  Sofa,
  Sparkles,
} from 'lucide-react';
import {
  FACING_LABELS,
  FURNISHING_LABELS,
  POSSESSION_LABELS,
  PROPERTY_TYPE_LABELS,
  brokerageText,
  formatINR,
  formatPriceShort,
  timeAgo,
} from '@brokeriq/shared';
import { api } from '@/lib/api';
import { formatDate, SITE_URL } from '@/lib/utils';
import { Badge } from '../ui/misc';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Select, Textarea } from '../ui/field';
import { Gallery } from './gallery';
import { CommuteCard, MoveInCard, PanoramaButton, ResidentReviews, VideoTour } from './property-extras';
import { MoveInServices } from './services';
import { ContactCard } from './contact-card';
import { EmiCalculator } from './emi';
import { ListingCard } from './listing-card';
import { SaveButton } from './save-button';
import { FairRentCard } from './fair-rent';
import { Map } from './map';

function toPascal(s?: string | null) {
  return (s ?? '')
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

export function PropertyView({ initial, similar, amenities }: { initial: any; similar: any[]; amenities: any[] }) {
  const { data: l } = useQuery({
    queryKey: ['listing', initial.slug],
    queryFn: () => api<any>(`/listings/${initial.slug}`),
    initialData: initial,
    staleTime: 0,
  });
  const [expanded, setExpanded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const photos = (l.media ?? []).filter((m: any) => m.kind === 'PHOTO');
  const area = l.superArea ?? l.builtUpArea ?? l.carpetArea ?? l.plotArea;
  const diff = l.pricePerSqft && l.localityAvgPsf ? Math.round(((l.pricePerSqft - l.localityAvgPsf) / l.localityAvgPsf) * 100) : null;
  const amenityMap = Object.fromEntries(amenities.map((a) => [a.key, a]));

  const facts: [React.ReactNode, string, string | number | null | undefined][] = [
    [<Icons.BedDouble key="b" />, 'Bedrooms', l.bedrooms != null ? `${l.bedrooms} BHK` : null],
    [<Icons.Bath key="ba" />, 'Bathrooms', l.bathrooms],
    [<Icons.Maximize2 key="a" />, l.superArea ? 'Super area' : l.plotArea ? 'Plot area' : 'Area', area ? `${formatINR(area, false)} sq.ft` : null],
    [<Icons.Ruler key="c" />, 'Carpet area', l.carpetArea && l.superArea ? `${formatINR(l.carpetArea, false)} sq.ft` : null],
    [<Layers key="f" />, 'Floor', l.floor != null ? `${l.floor}${l.totalFloors ? ` of ${l.totalFloors}` : ''}` : null],
    [<Sofa key="fu" />, 'Furnishing', l.furnishing ? FURNISHING_LABELS[l.furnishing as keyof typeof FURNISHING_LABELS] : null],
    [<Compass key="fa" />, 'Facing', l.facing ? FACING_LABELS[l.facing as keyof typeof FACING_LABELS] : null],
    [<Calendar key="p" />, 'Possession', l.possession ? POSSESSION_LABELS[l.possession as keyof typeof POSSESSION_LABELS] : null],
    [<Icons.Car key="pk" />, 'Parking', l.parking != null ? `${l.parking}` : null],
    [<Icons.Hourglass key="ag" />, 'Age', l.ageYears != null ? `${l.ageYears} yrs` : null],
    [<Icons.Wallet key="m" />, 'Maintenance', l.maintenance ? `${formatINR(l.maintenance)}/mo` : null],
    [<Icons.ShieldCheck key="d" />, 'Deposit', l.securityDeposit ? formatPriceShort(l.securityDeposit) : null],
    [<Icons.HandCoins key="br" />, 'Brokerage', brokerageText(l.brokerageType, l.brokerageAmount, l.price)],
    [<Icons.CalendarCheck key="av" />, 'Available from', l.availableFrom ? formatDate(l.availableFrom) : null],
  ];

  const share = async () => {
    const url = `${SITE_URL}/property/${l.slug}`;
    if (navigator.share) await navigator.share({ title: l.title, url }).catch(() => undefined);
    else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copy हो गया');
    }
  };

  return (
    <div className="container-x py-6">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted">
        <Link href="/" className="hover:text-fg">
          Home
        </Link>
        <ChevronRight className="size-3" />
        <Link href={l.category === 'COMMERCIAL' ? '/commercial' : '/rent'} className="hover:text-fg">
          Rent
        </Link>
        <ChevronRight className="size-3" />
        <Link href={`/locality/${l.locality.slug}`} className="hover:text-fg">
          {l.locality.name}
        </Link>
        <ChevronRight className="size-3" />
        <span className="truncate text-fg">{l.title}</span>
      </nav>

      {l.canManage && l.status !== 'ACTIVE' && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <span>
            Status: <b>{l.status.replace('_', ' ')}</b>
            {l.rejectionReason ? ` — ${l.rejectionReason}` : ''}
          </span>
          <Button size="sm" variant="secondary" href={l.organization ? `/broker/listings/${l.id}/edit` : `/account/listings/${l.id}/edit`}>
            <Pencil className="size-4" /> Edit
          </Button>
        </div>
      )}

      <Gallery photos={photos} title={l.title} />
      {(l.media ?? []).some((m: any) => m.kind === 'PANORAMA') && (
        <div className="mt-3 flex justify-end">
          <PanoramaButton urls={(l.media ?? []).filter((m: any) => m.kind === 'PANORAMA').map((m: any) => m.url)} />
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{PROPERTY_TYPE_LABELS[l.propertyType as keyof typeof PROPERTY_TYPE_LABELS]}</Badge>
              <Badge tone={l.purpose === 'RENT' ? 'info' : 'success'}>For {l.purpose === 'RENT' ? 'rent' : 'sale'}</Badge>
              {l.isVerified && (
                <Badge tone="success">
                  <BadgeCheck className="size-3.5" /> Verified
                </Badge>
              )}
              {l.isFeatured && (
                <Badge tone="warning">
                  <Sparkles className="size-3.5" /> Featured
                </Badge>
              )}
              {l.visitVerifiedAt && (
                <Badge tone="success">
                  <BadgeCheck className="size-3.5" /> Visit verified
                </Badge>
              )}
              {l.tokenReceivedAt && <Badge tone="warning">Token मिल चुका</Badge>}
              {l.reraNumber && <Badge>RERA: {l.reraNumber}</Badge>}
            </div>
            <h1 className="mt-3 font-display text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl">{l.title}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-muted">
              <MapPin className="size-4" />
              {[l.societyName, l.address, l.locality.name, 'Gurgaon'].filter(Boolean).join(', ')}
            </p>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-display text-4xl font-extrabold tracking-tight">
                  {formatPriceShort(l.price)}
                  {l.purpose === 'RENT' && <span className="text-lg font-semibold text-muted">/month</span>}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
                  {l.pricePerSqft && l.purpose === 'SALE' && <span>{formatINR(l.pricePerSqft)}/sq.ft</span>}
                  {l.priceNegotiable && <Badge tone="info">Negotiable</Badge>}
                  {diff != null && (
                    <span className={`inline-flex items-center gap-0.5 font-semibold ${diff <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {diff <= 0 ? <ArrowDownRight className="size-4" /> : <ArrowUpRight className="size-4" />}
                      {Math.abs(diff)}% {diff <= 0 ? 'below' : 'above'} {l.locality.name} avg ({formatINR(l.localityAvgPsf)}/sq.ft)
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SaveButton listingId={l.id} withLabel className="bg-surface-2 shadow-none" />
                <Button variant="secondary" size="sm" onClick={share}>
                  <Share2 className="size-4" /> Share
                </Button>
              </div>
            </div>
          </div>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {facts
              .filter(([, , v]) => v != null && v !== '')
              .map(([icon, label, value]) => (
                <div key={label} className="card flex items-center gap-3 p-3.5 transition hover:border-brand-300">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 [&_svg]:size-5">
                    {icon}
                  </span>
                  <div>
                    <p className="text-xs text-muted">{label}</p>
                    <p className="font-semibold">{value}</p>
                  </div>
                </div>
              ))}
          </section>

          {l.description && (
            <section>
              <h2 className="font-display text-xl font-bold">About this property</h2>
              <p className={`mt-3 leading-7 whitespace-pre-line text-muted ${expanded ? '' : 'line-clamp-6'}`}>{l.description}</p>
              {l.description.length > 400 && (
                <button className="mt-2 text-sm font-semibold text-brand-600" onClick={() => setExpanded(!expanded)}>
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </section>
          )}

          {l.amenities?.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold">Amenities</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {l.amenities.map((k: string) => {
                  const a = amenityMap[k];
                  const Icon = (Icons as any)[toPascal(a?.icon)] ?? Icons.Check;
                  return (
                    <div key={k} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
                      <Icon className="size-4 text-brand-600" /> {a?.label ?? k}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {l.latitude && l.longitude && (
            <section>
              <div className="flex items-end justify-between">
                <h2 className="font-display text-xl font-bold">Location</h2>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-brand-600 hover:underline"
                >
                  Google Maps में खोलें →
                </a>
              </div>
              <div className="card mt-4 h-80 overflow-hidden">
                <Map
                  points={[{ id: l.id, lat: l.latitude, lng: l.longitude, price: l.price }]}
                  center={[l.latitude, l.longitude]}
                  zoom={15}
                  fit={false}
                  radius={600}
                  scrollWheelZoom={false}
                />
              </div>
              <Link href={`/locality/${l.locality.slug}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
                {l.locality.name} का पूरा guide देखें <ChevronRight className="size-4" />
              </Link>
            </section>
          )}

          {l.floorPlanUrl && (
            <section>
              <h2 className="font-display text-xl font-bold">Floor plan</h2>
              {}
              <img src={l.floorPlanUrl} alt="Floor plan" className="card mt-4 w-full bg-white p-4" />
            </section>
          )}

          {l.videoUrl && (
            <section>
              <h2 className="font-display text-xl font-bold">Video tour</h2>
              <VideoTour url={l.videoUrl} />
            </section>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <MoveInCard l={l} />
            <CommuteCard l={l} />
          </div>

          {(l.propertyType === 'PG' || l.preferredTenants?.length > 0) && (
            <section className="card space-y-3 p-5 text-sm">
              <h2 className="font-display text-lg font-bold">{l.propertyType === 'PG' ? 'PG details' : 'किसके लिए'}</h2>
              <div className="flex flex-wrap gap-2">
                {l.pgGender && <Badge tone="brand">{({ FEMALE: 'Girls', MALE: 'Boys', ANY: 'Co-ed' } as Record<string, string>)[l.pgGender]}</Badge>}
                {l.pgFood && (
                  <Badge tone="success">
                    {({ VEG: 'Veg food', NONVEG: 'Non-veg food', BOTH: 'Veg + non-veg', NONE: 'Food शामिल नहीं' } as Record<string, string>)[l.pgFood]}
                  </Badge>
                )}
                {(l.pgSharing ?? []).map((x: string) => (
                  <Badge key={x}>
                    {({ SINGLE: 'Single room', DOUBLE: 'Double sharing', TRIPLE: 'Triple sharing', DORM: 'Dormitory' } as Record<string, string>)[x] ?? x}
                  </Badge>
                ))}
                {(l.preferredTenants ?? []).map((x: string) => (
                  <Badge key={x}>{x}</Badge>
                ))}
              </div>
              {l.pgRules?.length > 0 && <p className="text-muted">Rules: {l.pgRules.join(' · ')}</p>}
            </section>
          )}

          <ResidentReviews localitySlug={l.locality.slug} society={l.societyName} />

          <MoveInServices localityId={l.localityId} listingId={l.id} />

          {l.purpose === 'SALE' && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold">EMI calculator</h2>
              <EmiCalculator price={l.price} />
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-xs text-subtle">
            <span className="flex items-center gap-3">
              <span>Ref #{l.refNo}</span>
              <span className="flex items-center gap-1">
                <Eye className="size-3.5" /> {l.views} views
              </span>
              <span>Posted {timeAgo(l.publishedAt ?? l.createdAt)}</span>
            </span>
            {!l.canManage && (
              <button onClick={() => setReportOpen(true)} className="flex items-center gap-1 hover:text-rose-600">
                <Flag className="size-3.5" /> Report this listing
              </button>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ContactCard listing={l} />
          <FairRentCard listing={l} />
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-extrabold">Similar properties</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {similar.slice(0, 8).map((s) => (
              <ListingCard key={s.id} l={s} />
            ))}
          </div>
        </section>
      )}
      {!l.canManage && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-line bg-surface/95 p-3 backdrop-blur-xl lg:hidden">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-tight font-extrabold">
              {formatPriceShort(l.price)}
              {l.purpose === 'RENT' ? '/mo' : ''}
            </p>
            <p className="truncate text-xs text-muted">{l.locality.name}</p>
          </div>
          <Button size="md" onClick={() => document.getElementById('enquiry')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            Contact
          </Button>
        </div>
      )}
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} listingId={l.id} />
    </div>
  );
}

function ReportDialog({ open, onOpenChange, listingId }: { open: boolean; onOpenChange: (v: boolean) => void; listingId: string }) {
  const [reason, setReason] = useState('FAKE');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      await api(`/listings/${listingId}/report`, { method: 'POST', body: { reason, details } });
      toast.success('Report भेज दी गई — हमारी team जाँच करेगी');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Listing report करें"
      footer={
        <Button variant="danger" onClick={submit} loading={loading}>
          Submit report
        </Button>
      }
    >
      <div className="space-y-3">
        <Select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="FAKE">Fake / misleading listing</option>
          <option value="WRONG_PRICE">गलत price</option>
          <option value="ALREADY_SOLD">पहले ही sold / rented</option>
          <option value="BROKER_AS_OWNER">Broker ने owner बनकर post किया</option>
          <option value="SPAM">Spam</option>
          <option value="OTHER">Other</option>
        </Select>
        <Textarea placeholder="कुछ details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
      </div>
    </Dialog>
  );
}

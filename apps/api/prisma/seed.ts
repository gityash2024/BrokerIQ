/**
 * Idempotent seed — only real master data (no demo users/listings/leads).
 * Safe to run on every deploy: existing rows edited by the Super Admin are never overwritten.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { GROWTH_FEATURES, featureDefault, slugify } from '@brokeriq/shared';
import { GURGAON_LOCALITIES, AMENITIES } from './data/gurgaon';
import { DEFAULT_TEMPLATES } from '../src/core/mail/default-templates';
import { DRAFT_MARKER, PRIVACY_HTML, TERMS_HTML } from './legal-pages';

const prisma = new PrismaClient();

const PLANS = [
  {
    code: 'FREE',
    name: 'Free',
    description: 'अकेले broker के लिए शुरुआत — सब basic CRM features।',
    priceMonthly: 0,
    priceYearly: 0,
    limits: { agents: 1, activeListings: 10, leadsPerMonth: 100, aiCredits: 20, automations: 1, connectors: 1 },
    features: ['Unified lead inbox', 'Pipeline & follow-ups', 'Public microsite', '10 live listings', 'Email lead parser (1 portal inbox)'],
    sortOrder: 0,
    trialDays: 0,
  },
  {
    code: 'STARTER',
    name: 'Starter',
    description: 'छोटी team के लिए lead automation।',
    priceMonthly: 999,
    priceYearly: 9990,
    limits: { agents: 3, activeListings: 50, leadsPerMonth: 1000, aiCredits: 200, automations: 5, connectors: 3 },
    features: ['Everything in Free', '3 team members', 'WhatsApp auto-replies', '5 automations', 'AI listing scanner'],
    sortOrder: 1,
    trialDays: 14,
  },
  {
    code: 'PRO',
    name: 'Pro',
    description: 'बढ़ती brokerage के लिए पूरा automation और analytics।',
    priceMonthly: 2499,
    priceYearly: 24990,
    limits: { agents: 10, activeListings: 300, leadsPerMonth: 100000, aiCredits: 1000, automations: 20, connectors: 10 },
    features: ['Everything in Starter', '10 team members', 'Unlimited leads', 'Round-robin assignment', 'Advanced analytics', 'Verified badge priority'],
    sortOrder: 2,
    trialDays: 14,
    isPopular: true,
  },
  {
    code: 'BUSINESS',
    name: 'Business',
    description: 'बड़ी agencies और channel partners के लिए।',
    priceMonthly: 5999,
    priceYearly: 59990,
    limits: { agents: 30, activeListings: 2000, leadsPerMonth: 1000000, aiCredits: 5000, automations: 100, connectors: 20 },
    features: ['Everything in Pro', '30 team members', 'Featured broker placement', 'Priority support'],
    sortOrder: 3,
    trialDays: 14,
  },
];

const FLAGS = [
  { key: 'ai_scanner', description: 'AI listing-book scanner' },
  { key: 'ai_assist', description: 'AI lead summary, reply suggestions, description writer' },
  { key: 'whatsapp_automation', description: 'Automatic WhatsApp messages from automation rules' },
  { key: 'broker_microsites', description: 'Public broker microsites' },
  { key: 'reviews', description: 'Broker reviews & ratings' },
  { key: 'projects', description: 'New projects section' },
  { key: 'boosts', description: 'Paid listing boosts' },
  { key: 'chat', description: 'In-app chat between users and brokers' },
  ...GROWTH_FEATURES.map((f) => ({ key: f.key, description: `${f.name} — ${f.description}`, enabled: featureDefault(f.key) })),
];

const HOMEPAGE = [
  {
    type: 'HERO',
    title: 'Gurgaon में rent पर अपना अगला घर ढूँढिए',
    subtitle: 'Verified furnished flats, builder floors, PG और offices — भरोसेमंद local brokers के साथ।',
    config: { tabs: ['SALE', 'RENT', 'COMMERCIAL', 'PLOT', 'PROJECTS'], backgroundUrl: '', stats: true },
  },
  { type: 'LOCALITIES', title: 'Gurgaon के popular इलाके', subtitle: 'औसत किराया, connectivity और live rentals', config: { limit: 12, popularOnly: true } },
  { type: 'FEATURED_LISTINGS', title: 'Handpicked rentals', subtitle: 'Verified और featured rent listings', config: { limit: 8 } },
  { type: 'MAP_EXPLORER', title: 'Map पर Gurgaon explore करें', subtitle: 'हर sector की live listings एक नज़र में', config: {} },
  { type: 'FEATURED_PROJECTS', title: 'New projects', subtitle: 'RERA registered launches', isActive: false, config: { limit: 6 } },
  { type: 'TOP_BROKERS', title: 'Gurgaon के top brokers', subtitle: 'Verified, highly rated local experts', config: { limit: 8 } },
  { type: 'TOOLS', title: 'Smart rent tools', subtitle: 'Rent budget, move-in cost और flatmates के साथ rent split', config: {} },
  {
    type: 'WHY_US',
    title: 'BrokerIQ क्यों?',
    subtitle: 'Gurgaon के लिए बना, Gurgaon वालों के लिए',
    config: {
      items: [
        { icon: 'shield-check', title: 'Verified listings', text: 'हर listing moderation से गुज़रती है और verified brokers को badge मिलता है।' },
        { icon: 'map-pinned', title: 'Hyper-local', text: 'हर sector, society और corridor की सटीक जानकारी।' },
        { icon: 'messages-square', title: 'सीधा संपर्क', text: 'Owner या broker से सीधे WhatsApp, call या chat।' },
        { icon: 'sparkles', title: 'Smart tools', text: 'Rent budget, move-in cost और saved-search alerts।' },
      ],
    },
  },
  {
    type: 'APP_DOWNLOAD',
    title: 'BrokerIQ app पर पाइए instant alerts',
    subtitle: 'नई listings, price drops और broker replies — सीधे आपके phone पर',
    config: {},
  },
  { type: 'BLOG', title: 'Renting guides & news', subtitle: 'Gurgaon में rent पर घर लेने की ताज़ा जानकारी', config: { limit: 3 } },
  {
    type: 'CTA_BANNER',
    title: 'क्या आप broker हैं?',
    subtitle: 'Housing, 99acres, MagicBricks, Facebook की सारी leads एक app में — WhatsApp automation के साथ। Free शुरू करें।',
    config: { ctaLabel: 'Broker account बनाएँ', ctaLink: '/for-brokers' },
  },
  { type: 'TESTIMONIALS', title: 'हमारे users क्या कहते हैं', subtitle: '', isActive: false, config: { items: [] } },
];

const FAQS = [
  {
    category: 'general',
    question: 'क्या BrokerIQ पर property search करना free है?',
    answer: 'हाँ, property खोजना, save करना और brokers/owners से संपर्क करना पूरी तरह free है।',
  },
  {
    category: 'general',
    question: 'Owner के तौर पर property कैसे post करें?',
    answer: 'Login करके "Post Property" पर जाइए, 4 आसान steps में details और photos डालिए। Moderation के बाद listing live हो जाती है।',
  },
  {
    category: 'general',
    question: 'Verified badge का क्या मतलब है?',
    answer: 'Verified brokers ने अपना RERA / ID documents जमा किए हैं जिन्हें हमारी team ने जाँचा है।',
  },
  {
    category: 'brokers',
    question: 'Housing.com और 99acres की leads BrokerIQ में कैसे आएँगी?',
    answer:
      'Broker panel → Connectors में वह email inbox जोड़िए जिस पर portal की lead emails आती हैं। BrokerIQ हर 2 मिनट में नई lead emails पढ़कर leads बना देता है।',
  },
  {
    category: 'brokers',
    question: 'क्या WhatsApp पर automatic messages जा सकते हैं?',
    answer: 'हाँ — Connectors में अपना WhatsApp Business (Cloud API) number जोड़िए और Automations में नियम बनाइए, जैसे नई lead आते ही welcome message।',
  },
];

const PAGES = [
  {
    slug: 'about',
    title: 'About BrokerIQ',
    content: '<h2>BrokerIQ</h2><p>BrokerIQ Gurgaon के लिए बना property marketplace और broker CRM है। (Super Admin → CMS → Pages से यह content edit करें।)</p>',
    isPublished: true,
  },
  { slug: 'terms', title: 'Terms of Use', content: TERMS_HTML, isPublished: true },
  { slug: 'privacy', title: 'Privacy Policy', content: PRIVACY_HTML, isPublished: true },
];

async function main() {
  // Localities
  let i = 0;
  for (const l of GURGAON_LOCALITIES) {
    const slug = slugify(`${l.name} gurgaon`);
    await prisma.locality.upsert({
      where: { slug },
      create: { name: l.name, slug, zone: l.zone, latitude: l.lat, longitude: l.lng, isPopular: !!l.popular, highlights: l.highlights ?? [], sortOrder: i++ },
      update: {},
    });
  }
  // Amenities
  for (const [idx, a] of AMENITIES.entries()) {
    await prisma.amenity.upsert({ where: { key: a.key }, create: { ...a, sortOrder: idx }, update: {} });
  }
  // Plans
  for (const p of PLANS) {
    await prisma.plan.upsert({ where: { code: p.code }, create: { ...p, limits: p.limits as Prisma.InputJsonValue }, update: {} });
  }
  // Feature flags
  for (const f of FLAGS)
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      create: { key: f.key, description: f.description, enabled: 'enabled' in f ? f.enabled : true },
      update: {},
    });
  // Templates
  for (const t of DEFAULT_TEMPLATES) {
    await prisma.template.upsert({
      where: { key: t.key },
      create: { key: t.key, channel: t.channel, name: t.name, subject: t.subject, body: t.body },
      update: {},
    });
  }
  // Homepage sections (only when empty so admin ordering is preserved)
  // Rental pivot: refresh sections that still carry the original (sale-oriented) default copy.
  const RENTAL_COPY: [string, string | null, Record<string, unknown>][] = [
    [
      'Gurgaon में अपना अगला घर ढूँढिए',
      null,
      {
        title: 'Gurgaon में rent पर अपना अगला घर ढूँढिए',
        subtitle: 'Verified furnished flats, builder floors, PG और offices — भरोसेमंद local brokers के साथ।',
      },
    ],
    ['Handpicked properties', null, { title: 'Handpicked rentals', subtitle: 'Verified और featured rent listings' }],
    ['Smart property tools', null, { title: 'Smart rent tools', subtitle: 'Rent budget, move-in cost और flatmates के साथ rent split' }],
    ['Property guides & news', null, { title: 'Renting guides & news', subtitle: 'Gurgaon में rent पर घर लेने की ताज़ा जानकारी' }],
    ['New projects', 'RERA registered launches', { isActive: false }],
  ];
  for (const [title, subtitle, data] of RENTAL_COPY) {
    await prisma.homepageSection.updateMany({ where: { title, ...(subtitle ? { subtitle } : {}) }, data });
  }
  await prisma.homepageSection.updateMany({
    where: { type: 'LOCALITIES', subtitle: 'Price trends, connectivity और live listings' },
    data: { subtitle: 'औसत किराया, connectivity और live rentals' },
  });
  for (const why of await prisma.homepageSection.findMany({ where: { type: 'WHY_US' } })) {
    const cfg = (why.config ?? {}) as { items?: { text?: string }[] };
    if (!cfg.items?.some((i) => i.text === 'EMI, stamp duty, price trends और saved-search alerts।')) continue;
    const items = cfg.items.map((i) =>
      i.text === 'EMI, stamp duty, price trends और saved-search alerts।' ? { ...i, text: 'Rent budget, move-in cost और saved-search alerts।' } : i,
    );
    await prisma.homepageSection.update({ where: { id: why.id }, data: { config: { ...cfg, items } as Prisma.InputJsonValue } });
  }

  if ((await prisma.homepageSection.count()) === 0) {
    await prisma.homepageSection.createMany({
      data: HOMEPAGE.map((s, idx) => ({
        type: s.type,
        title: s.title,
        subtitle: s.subtitle,
        isActive: s.isActive ?? true,
        sortOrder: idx,
        config: s.config as Prisma.InputJsonValue,
      })),
    });
  }
  if ((await prisma.faq.count()) === 0) await prisma.faq.createMany({ data: FAQS.map((f, idx) => ({ ...f, sortOrder: idx })) });
  for (const p of PAGES) {
    const existing = await prisma.page.findUnique({ where: { slug: p.slug }, select: { content: true } });
    if (!existing) await prisma.page.create({ data: p });
    // Replace only the old placeholder — admin-edited pages are left alone.
    else if (existing.content.includes(DRAFT_MARKER))
      await prisma.page.update({ where: { slug: p.slug }, data: { content: p.content, isPublished: p.isPublished } });
  }

  // Super admin from env
  const email = process.env.SUPER_ADMIN_EMAIL?.toLowerCase();
  if (email) {
    const pwd = process.env.SUPER_ADMIN_PASSWORD;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email,
          name: process.env.SUPER_ADMIN_NAME ?? 'Super Admin',
          role: 'SUPER_ADMIN',
          emailVerified: true,
          passwordHash: pwd ? await bcrypt.hash(pwd, 12) : null,
        },
      });
    }
  }
  console.log(`Seed complete: ${GURGAON_LOCALITIES.length} localities, ${AMENITIES.length} amenities, ${PLANS.length} plans.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

'use client';
import Link from 'next/link';
import LegacyInbox from '@/components/legacy/inbox-page';
export default function InboxPage(){return <><div className="mb-5 flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3"><p className="text-sm">WhatsApp conversations and capture review</p><Link href="/broker/imports" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Import message / screenshot →</Link></div><LegacyInbox/></>;}

'use client';
import { PageHeader } from '@/components/panel/shell';
import { Agreements } from '@/components/site/agreements';

export default function Page() {
  return (
    <>
      <PageHeader title="Rent agreement" subtitle="11 महीने का draft agreement PDF — e-stamp और police verification के steps के साथ" />
      <Agreements />
    </>
  );
}

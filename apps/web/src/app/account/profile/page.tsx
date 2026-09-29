'use client';
import { PageHeader } from '@/components/panel/shell';
import { ProfileForm } from '@/components/panel/profile-form';
import { TenantVerifyCard } from '@/components/site/tenant-verify';
export default function Page() {
  return (
    <>
      <PageHeader title="Profile & KYC" />
      <ProfileForm />
      <TenantVerifyCard />
    </>
  );
}

'use client';

import { hasDelegatedAccess, moduleAllowed } from '@brokeriq/shared';
import { Camera, FileArchive, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { SurveyPhoneAction } from './survey-phone-action';
import { SurveyPhotoAction } from './survey-photo-action';

export function InventoryEntryActions({ createHref, survey = false, sector, customFolderId }: { createHref: string; survey?: boolean; sector?: string; customFolderId?: string }) {
  const { user } = useAuth();
  const { modules, flags } = useConfig();
  const cutover = flags.connect_whatsapp_cutover === true;
  const role = user?.role === 'SUB_BROKER_ADMIN' ? 'BROKER_ADMIN' : (user?.role ?? '');
  const canCreate = !!user && hasDelegatedAccess(user, 'inventory', 'create');
  const canImport = canCreate && moduleAllowed(modules, 'inbox', role) && hasDelegatedAccess(user, 'inbox', 'view', 'create');
  return (
    <div className="flex flex-wrap gap-2" aria-label="Inventory entry actions">
      <Button href={createHref} disabled={!canCreate} title={!canCreate ? 'Ask your Broker Admin for inventory create access' : undefined}>
        <Plus className="size-4" /> {survey ? 'Add survey property' : 'Add property'}
      </Button>
      <Button
        href={survey ? '/broker/scanner?target=SURVEY' + (sector ? '&sector=' + encodeURIComponent(sector) : '') + (customFolderId ? '&customFolderId=' + encodeURIComponent(customFolderId) : '') : '/broker/scanner?target=INVENTORY'}
        variant="secondary"
        disabled={!canImport}
        title={!canImport ? 'Inventory create and capture access required' : undefined}
      >
        <Camera className="size-4" /> {survey ? 'Scan survey register' : 'Scan property'}
      </Button>
      {survey && <SurveyPhotoAction allowed={canCreate} sector={sector} customFolderId={customFolderId} />}
      {survey && <SurveyPhoneAction allowed={canCreate} sector={sector} customFolderId={customFolderId} />}
      {!survey && (
        <Button
          href={cutover ? '/broker/inventory/pdf' : '/broker/imports?target=INVENTORY'}
          variant="secondary"
          disabled={cutover ? !hasDelegatedAccess(user, 'inventory', 'view') : !canImport}
          title={!canImport ? 'Inventory create and capture access required' : undefined}
        >
          <FileArchive className="size-4" /> {cutover ? "PDF Inventory" : "WhatsApp import"}
        </Button>
      )}
      {!canImport && <p className="basis-full text-xs text-muted">Ask your Broker Admin for inventory create and capture access to use these actions.</p>}
    </div>
  );
}

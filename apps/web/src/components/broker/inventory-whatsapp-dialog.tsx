'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Copy, Send, Check, User, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatINR, normalizeIndianPhone, floorLabel, propertyPhotoDraft } from '@brokeriq/shared';
import { cn } from '@/lib/utils';
import { captureAccountContext, assertAccountContext, errorMessage } from '@/lib/api';
import { openLeadInbox } from '@/lib/inbox-composer';
import { LeadPicker } from './lead-picker';
import { useAuth } from '@/lib/auth';
import type { LeadInboxChannel } from '@brokeriq/shared';

export interface InventoryItemForWhatsApp {
  id: string;
  photoUrls?: string[];
  sector?: string | null;
  houseNo?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  bhk?: number | null;
  roomKind?: string | null;
  floor?: string | null;
  furnishing?: string | null;
  rent?: number | null;
  purpose?: string | null;
  monthlyRent?: number | null;
  totalSalePrice?: number | null;
  tenantPreference?: string | null;
  notes?: string | null;
}

interface InventoryWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItemForWhatsApp | null;
  brokerName?: string;
  brokerFirm?: string;
}

export function InventoryWhatsAppDialog({ open, onOpenChange, item, brokerName = 'Broker', brokerFirm = '' }: InventoryWhatsAppDialogProps) {
  const { user } = useAuth();
  const crmAllowed = user?.role === 'BROKER_ADMIN' || user?.role === 'BROKER_AGENT';
  const owner = useRef(captureAccountContext());
  const [templateType, setTemplateType] = useState<'owner' | 'client'>('owner');
  const [customText, setCustomText] = useState('');
  const [includePhotos, setIncludePhotos] = useState(false);
  const [copied, setCopied] = useState(false);
  const [client, setClient] = useState<{ id: string; name?: string | null; phone: string } | null>(null);
  const [channel, setChannel] = useState<LeadInboxChannel>('WHATSAPP');
  useEffect(() => {
    if (open) owner.current = captureAccountContext();
  }, [open]);

  const generateMessage = useCallback(
    (type: 'owner' | 'client') => {
      if (!item) return '';
      const owner = item.ownerName && item.ownerName !== 'Owner' ? item.ownerName : "Sir/Ma'am";
      const bhkStr = item.bhk ? `${item.bhk} ${item.roomKind || 'rooms'}` : '';
      const floorStr = item.floor ? floorLabel(item.floor) : '';
      const configStr = [bhkStr, floorStr].filter(Boolean).join(' ');
      const price = item.purpose === 'SALE' ? item.totalSalePrice : item.purpose === 'RENT' ? (item.monthlyRent ?? item.rent) : null;
      const priceStr = price != null ? formatINR(price) : 'Price not recorded';
      const transaction = item.purpose === 'SALE' ? 'Sale' : item.purpose === 'RENT' ? 'Rent' : 'Transaction not recorded';
      const identity = [brokerName, brokerFirm].filter(Boolean).join(' · ');
      const houseStr = item.houseNo && item.houseNo !== '--' ? `House No. ${item.houseNo}` : 'Property';
      const furnStr = item.furnishing ? item.furnishing.replace(/_/g, ' ').toLowerCase() : 'standard';

      if (type === 'owner') {
        return `Namaste ${owner}, I am ${identity}. Regarding your property in ${item.sector || 'locality not recorded'} ${houseStr} (${configStr}, ${transaction}: ${priceStr}), is it currently available for deal/visit? Please let me know suitable time for client site visit.`;
      } else {
        return (
          `🏠 *Property in ${item.sector || 'locality not recorded'}*\n` +
          `• Unit: ${houseStr}\n` +
          (configStr ? `• Configuration: ${configStr}\n` : '') +
          (item.furnishing ? `• Furnishing: ${furnStr}\n` : '') +
          `• ${transaction}: ${priceStr}\n` +
          (item.tenantPreference ? `• Suitable for: ${item.tenantPreference}\n` : '') +
          `• Contact: ${identity}\n\n` +
          `Interested in scheduling a site visit? Reply to this message or call directly.`
        );
      }
    },
    [item, brokerName, brokerFirm],
  );

  useEffect(() => {
    if (item) {
      setCustomText(generateMessage(templateType));
      setCopied(false);
      setIncludePhotos(false);
      setClient(null);
    }
  }, [item, templateType, generateMessage]);

  if (!item) return null;

  const handleSend = async () => {
    try {
      assertAccountContext(owner.current);
      if (templateType === 'client') {
        if (!crmAllowed || !client) return toast.error('Choose an authorized CRM lead first.');
        await openLeadInbox(client.id, includePhotos ? propertyPhotoDraft(customText, item.photoUrls) : customText, channel);
        return;
      }
      const text = encodeURIComponent(customText);
      let targetUrl = '';

      if (templateType === 'owner') {
        const cleanPhone = normalizeIndianPhone(item.ownerPhone || '')?.replace(/\D/g, '') || '';
        if (!cleanPhone || cleanPhone.length < 10) {
          toast.error('Owner ka valid phone number available nahi hai.');
          return;
        }
        targetUrl = `https://wa.me/${cleanPhone}?text=${text}`;
      }

      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      toast.success('Owner WhatsApp opened with an editable message.');
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const handleCopy = async () => {
    try {
      assertAccountContext(owner.current);
      await navigator.clipboard.writeText(customText);
      assertAccountContext(owner.current);
      setCopied(true);
      toast.success('Message text copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Prepare property message"
      description={[item.sector || 'Locality not recorded', item.houseNo && item.houseNo !== '--' ? `House ${item.houseNo}` : ''].filter(Boolean).join(' · ')}
      size="md"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            {copied ? 'Copied' : 'Copy Text'}
          </Button>
          <Button variant="whatsapp" size="sm" disabled={templateType === 'client' && (!crmAllowed || !client)} onClick={handleSend}>
            <Send className="size-4" /> {templateType === 'client' ? `Open ${channel === 'EMAIL' ? 'Email' : channel} Inbox` : 'Open owner WhatsApp'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Template Switcher */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => setTemplateType('owner')}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition',
              templateType === 'owner' ? 'bg-surface shadow text-brand-600' : 'text-muted hover:text-fg',
            )}
          >
            <User className="size-3.5" /> Owner Availability Check
          </button>
          <button
            type="button"
            onClick={() => setTemplateType('client')}
            disabled={!crmAllowed}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition',
              templateType === 'client' ? 'bg-surface shadow text-brand-600' : 'text-muted hover:text-fg',
            )}
          >
            <Share2 className="size-3.5" /> Client Sharing Pitch
          </button>
        </div>

        {/* Client messages retain the authorized lead/channel trail in internal Inbox. */}
        {templateType === 'client' && (
          <div className="space-y-3">
            <p className="text-xs text-muted">Choose a CRM lead. Review the message in Inbox before sending.</p>
            <LeadPicker value={client} onChange={setClient} />
            {!!item.photoUrls?.length && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includePhotos} onChange={(event) => setIncludePhotos(event.target.checked)} />
                Include property photo links
              </label>
            )}
            <div className="flex gap-2">
              {(['WHATSAPP', 'SMS', 'EMAIL'] as const).map((value) => (
                <Button key={value} size="sm" variant={channel === value ? 'primary' : 'secondary'} onClick={() => setChannel(value)}>
                  {value === 'EMAIL' ? 'Email' : value}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Message preview and editor */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">{templateType === 'owner' ? 'Message to Owner' : 'Message to Client'}</span>
            <span className="text-[11px] text-subtle">Editable text</span>
          </div>
          <textarea
            rows={6}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            className="w-full resize-none rounded-2xl border border-line bg-surface p-3 text-sm leading-relaxed outline-none focus:border-brand-500 font-mono text-xs"
          />
        </div>

        {/* Property Highlights */}
        <div className="rounded-xl bg-surface-2 p-3 text-xs text-muted space-y-1">
          <div className="flex justify-between">
            <span>Owner Phone:</span>
            <span className="font-semibold text-fg">{item.ownerPhone || 'Not available'}</span>
          </div>
          <div className="flex justify-between">
            <span>Price / Demand:</span>
            <span className="font-semibold text-fg">
              {item.purpose === 'SALE' && item.totalSalePrice != null
                ? formatINR(item.totalSalePrice)
                : item.purpose === 'RENT' && (item.monthlyRent ?? item.rent) != null
                  ? formatINR((item.monthlyRent ?? item.rent)!)
                  : 'Not specified'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Broker Firm:</span>
            <span className="font-semibold text-fg">{brokerFirm}</span>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

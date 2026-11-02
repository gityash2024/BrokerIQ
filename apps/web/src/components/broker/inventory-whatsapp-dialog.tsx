'use client';
import { useState, useEffect, useCallback } from 'react';
import { Copy, Send, Check, User, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatINR, normalizeIndianPhone, floorLabel } from '@brokeriq/shared';
import { cn } from '@/lib/utils';

export interface InventoryItemForWhatsApp {
  id: string;
  sector?: string | null;
  houseNo?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  bhk?: number | null;
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
  const [templateType, setTemplateType] = useState<'owner' | 'client'>('owner');
  const [customText, setCustomText] = useState('');
  const [copied, setCopied] = useState(false);
  const [clientPhone, setClientPhone] = useState('');

  const generateMessage = useCallback(
    (type: 'owner' | 'client') => {
      if (!item) return '';
      const owner = item.ownerName && item.ownerName !== 'Owner' ? item.ownerName : "Sir/Ma'am";
      const bhkStr = item.bhk ? `${item.bhk} BHK` : '';
      const floorStr = item.floor ? floorLabel(item.floor) : '';
      const configStr = [bhkStr, floorStr].filter(Boolean).join(' ');
      const price = item.purpose === 'SALE' ? item.totalSalePrice : item.purpose === 'RENT' ? (item.monthlyRent ?? item.rent) : null;
      const priceStr = price != null ? formatINR(price) : 'Price not recorded';
      const transaction = item.purpose === 'SALE' ? 'Sale' : item.purpose === 'RENT' ? 'Rent' : 'Transaction not recorded';
      const identity = [brokerName, brokerFirm].filter(Boolean).join(' · ');
      const houseStr = item.houseNo && item.houseNo !== '--' ? `House No. ${item.houseNo}` : 'Property';
      const furnStr = item.furnishing ? item.furnishing.replace(/_/g, ' ').toLowerCase() : 'standard';

      if (type === 'owner') {
        return `Namaste ${owner}, I am ${identity}. Regarding your property in ${item.sector} ${houseStr} (${configStr}, ${transaction}: ${priceStr}), is it currently available for deal/visit? Please let me know suitable time for client site visit.`;
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
      setClientPhone('');
    }
  }, [item, templateType, generateMessage]);

  if (!item) return null;

  const handleSend = () => {
    const text = encodeURIComponent(customText);
    let targetUrl = '';

    if (templateType === 'owner') {
      const cleanPhone = normalizeIndianPhone(item.ownerPhone || '')?.replace(/\D/g, '') || '';
      if (!cleanPhone || cleanPhone.length < 10) {
        toast.error('Owner ka valid phone number available nahi hai.');
        return;
      }
      targetUrl = `https://wa.me/${cleanPhone}?text=${text}`;
    } else {
      const cleanClient = normalizeIndianPhone(clientPhone)?.replace(/\D/g, '') || '';
      if (cleanClient && cleanClient.length >= 10) {
        targetUrl = `https://wa.me/${cleanClient}?text=${text}`;
      } else if (clientPhone.trim()) {
        toast.error('Enter a valid Indian client phone number.');
        return;
      } else {
        // Generic WhatsApp share (opens WhatsApp contact selector)
        targetUrl = `https://api.whatsapp.com/send?text=${text}`;
      }
    }

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    toast.success('WhatsApp opened with pre-filled message! 🚀');
    onOpenChange(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(customText);
    setCopied(true);
    toast.success('Message text copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Dynamic WhatsApp Message"
      description={`${item.sector} ${item.houseNo !== '--' ? `• House ${item.houseNo}` : ''}`}
      size="md"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            {copied ? 'Copied' : 'Copy Text'}
          </Button>
          <Button variant="whatsapp" size="sm" onClick={handleSend}>
            <Send className="size-4" /> Send on WhatsApp
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
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition',
              templateType === 'client' ? 'bg-surface shadow text-brand-600' : 'text-muted hover:text-fg',
            )}
          >
            <Share2 className="size-3.5" /> Client Sharing Pitch
          </button>
        </div>

        {/* Client phone number input when Client Pitch is selected */}
        {templateType === 'client' && (
          <div>
            <label className="text-xs font-medium text-muted">Client Phone (Optional - direct send):</label>
            <input
              type="tel"
              placeholder="e.g. 9811223344 (Leave blank to pick in WhatsApp)"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
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
            <span className="font-semibold text-fg">{item.rent ? formatINR(item.rent) : 'Not specified'}</span>
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

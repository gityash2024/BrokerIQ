'use client';
import { useState } from 'react';
import { brokerRequirementSchema, offeredRequirement, type BrokerRequirementInput } from '@brokeriq/shared';
import { RequirementForm } from './requirement-form';
import { PropertyForm } from './property-form';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { errorMessage } from '@/lib/api';

export function RequirementRecordForm({
  initial = {},
  onSave,
  onDirty,
}: {
  initial?: Partial<BrokerRequirementInput> & { revision?: number };
  onSave: (value: BrokerRequirementInput) => Promise<void>;
  onDirty?: () => void;
}) {
  const [intent, setIntent] = useState(initial.intent || 'DEMAND');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = (value: BrokerRequirementInput) => onSave({ ...value, ...(initial.revision ? { expectedRevision: initial.revision } : {}) });
  return (
    <div className="space-y-5">
      <Field label="Record type">
        <Select
          value={intent}
          onChange={(e) => {
            setIntent(e.target.value as typeof intent);
            onDirty?.();
          }}
        >
          <option value="DEMAND">Customer requirement</option>
          <option value="OFFER">Available property offer</option>
          <option value="UNKNOWN">Unclear · review required</option>
        </Select>
      </Field>
      <p className="text-sm text-muted">
        Imports और available-property offers यहाँ स्वतंत्र records रहते हैं। Inventory केवल अलग reviewed conversion से बनेगी।
      </p>
      {intent === 'DEMAND' ? (
        <RequirementForm key="demand" initial={{ ...initial, intent: 'DEMAND', offerDetails: null }} onDirty={onDirty} onSave={save} />
      ) : intent === 'OFFER' ? (
        <PropertyForm
          key="offer"
          initial={initial.offerDetails || { notes: initial.notes, ownerName: initial.contactName, ownerPhone: initial.contactPhone }}
          onDirty={onDirty}
          label="Save property offer"
          onSave={(input) => save({ ...offeredRequirement(input), leadId: initial.leadId })}
        />
      ) : (
        <form
          className="space-y-4"
          onChange={onDirty}
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setBusy(true);
            setError('');
            try {
              await save(brokerRequirementSchema.parse({ intent: 'UNKNOWN', title: data.get('title'), notes: data.get('notes') }));
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Title">
            <Input name="title" defaultValue={initial.title || ''} maxLength={200} />
          </Field>
          <Field label="Original details / notes">
            <Textarea name="notes" defaultValue={initial.notes || ''} maxLength={20000} rows={8} />
          </Field>
          {error && <p role="alert">{error}</p>}
          <Button loading={busy}>Save for review</Button>
        </form>
      )}
    </div>
  );
}

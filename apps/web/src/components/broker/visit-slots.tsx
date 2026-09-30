'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { patch, useApiMutation } from '@/lib/hooks';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Chip, Field, Input, Select } from '../ui/field';
import { useFlag } from '@/lib/config';

const DAYS = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];

/** Hidden while Super Admin has "slot_booking" switched off. */
export function VisitSlotsButton(props: Record<string, never>) {
  return useFlag('slot_booking') ? <VisitSlotsButtonInner {...props} /> : null;
}

/** Weekly slots tenants can self-book from broker listings. */
function VisitSlotsButtonInner() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['visit-slots'], queryFn: () => api<any>('/broker/visit-slots'), enabled: open });
  const [f, setF] = useState<any>(null);
  useEffect(() => {
    if (q.data) setF(q.data);
  }, [q.data]);
  const save = useApiMutation(() => patch('/broker/visit-slots', { ...f, slotMinutes: Number(f.slotMinutes), maxPerSlot: Number(f.maxPerSlot) }), {
    success: 'Visit slots saved',
    invalidate: [['visit-slots']],
    onSuccess: () => setOpen(false),
  });
  if (user?.role !== 'BROKER_ADMIN') return null;
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Clock className="size-4" /> Booking slots
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Online visit booking"
        description="Tenants आपकी listings पर इन समयों में खुद visit book कर सकते हैं — हर booking lead और site visit बनती है।"
        footer={
          <Button onClick={() => save.mutate(undefined)} loading={save.isPending} disabled={!f?.days?.length}>
            Save
          </Button>
        }
      >
        {f && (
          <div className="space-y-4">
            <Field label="दिन">
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d, i) => (
                  <Chip
                    key={d}
                    active={f.days.includes(i)}
                    onClick={() => setF({ ...f, days: f.days.includes(i) ? f.days.filter((x: number) => x !== i) : [...f.days, i].sort() })}
                  >
                    {d}
                  </Chip>
                ))}
              </div>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Start">
                <Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
              </Field>
              <Field label="End">
                <Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
              </Field>
              <Field label="हर slot">
                <Select value={String(f.slotMinutes)} onChange={(e) => setF({ ...f, slotMinutes: e.target.value })}>
                  {[30, 45, 60, 90, 120].map((m) => (
                    <option key={m} value={m}>
                      {m} मिनट
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="एक slot में कितनी visits">
                <Input type="number" min={1} max={10} value={f.maxPerSlot} onChange={(e) => setF({ ...f, maxPerSlot: e.target.value })} />
              </Field>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

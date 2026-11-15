import { useState } from 'react';
import { View } from 'react-native';
import { patch } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import {
  MAX_VISIT_PROPERTIES,
  visitInventoryTitle,
  visitPropertyStops,
  visitShortlistStops,
  visitShortlistedIds,
  type LedgerItem,
  type VisitPropertySelection,
  type VisitPropertySnapshot,
} from '@brokeriq/shared';
import { Button, Card, PressableScale, Row, Txt } from '@/ui';
import { VisitPropertyPicker } from './visit-property-picker';

export function VisitProperties({ items, onChange }: { items: LedgerItem[]; onChange: (items: LedgerItem[]) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt v="label">
        Properties · {items.length}/{MAX_VISIT_PROPERTIES}
      </Txt>
      {items.map((item, index) => (
        <Row key={item.id} gap={8}>
          <Txt style={{ flex: 1 }}>
            {index + 1}. {visitInventoryTitle(item)}
          </Txt>
          <Button size="sm" title="Remove" variant="ghost" onPress={() => onChange(items.filter((entry) => entry.id !== item.id))} />
        </Row>
      ))}
      {items.length < MAX_VISIT_PROPERTIES && (
        <VisitPropertyPicker
          open
          excluded={items.map((item) => item.id)}
          value={null}
          onChange={(item) => {
            if (item && !items.some((entry) => entry.id === item.id)) onChange([...items, item]);
          }}
        />
      )}
    </View>
  );
}

export function VisitItinerary({ snapshot, remainingOnly }: { snapshot?: VisitPropertySnapshot | null; remainingOnly?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const selected = remainingOnly ? visitShortlistedIds(snapshot) : [];
  const stops = (selected.length ? visitShortlistStops(snapshot) : visitPropertyStops(snapshot)).filter(({ id }) => !selected.includes(id));
  if (!stops.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <Button
        title={expanded ? 'Hide properties' : `Show ${stops.length} properties`}
        size="sm"
        variant="secondary"
        onPress={() => setExpanded((value) => !value)}
      />
      {expanded &&
        stops.map((stop, index) => (
          <View key={stop.id}>
            <Txt>
              {index + 1}. {stop.title}
            </Txt>
            {!!stop.address && stop.address !== stop.title && (
              <Txt v="caption" color="muted">
                {stop.address}
              </Txt>
            )}
          </View>
        ))}
    </View>
  );
}

export function VisitShortlist({ visits, canEdit, onChange }: { visits: VisitPropertySelection[]; canEdit: boolean; onChange: () => void }) {
  const completed = visits.filter((visit) => visit.status === 'COMPLETED' && visitShortlistStops(visit.propertySnapshot).length);
  return (
    <View style={{ gap: 12 }}>
      <Txt v="h3">Shortlisted properties</Txt>
      {!completed.length && <Txt color="muted">There are no properties on this lead’s completed visits.</Txt>}
      {completed.map((visit) => (
        <ShortlistVisit key={visit.id + ':' + visit.updatedAt} visit={visit} canEdit={canEdit} onChange={onChange} />
      ))}
    </View>
  );
}

function ShortlistVisit({ visit, canEdit, onChange }: { visit: VisitPropertySelection; canEdit: boolean; onChange: () => void }) {
  const saved = visitShortlistedIds(visit.propertySnapshot);
  const [selected, setSelected] = useState(saved);
  const save = useApiMutation(() => patch(`/visits/${visit.id}/shortlist`, { propertyIds: selected, expectedUpdatedAt: visit.updatedAt }), {
    success: 'Shortlist saved',
    onSuccess: onChange,
  });
  const changed = selected.length !== saved.length || selected.some((id) => !saved.includes(id));
  return (
    <Card style={{ gap: 8, padding: 12 }}>
      <Txt v="bodyStrong">{new Date(visit.scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</Txt>
      {visitShortlistStops(visit.propertySnapshot).map((stop) => {
        const checked = selected.includes(stop.id);
        return (
          <PressableScale
            key={stop.id}
            accessibilityRole="checkbox"
            accessibilityLabel={stop.title}
            accessibilityState={{ checked, disabled: !canEdit || save.isPending }}
            disabled={!canEdit || save.isPending}
            onPress={() => setSelected((ids) => (checked ? ids.filter((id) => id !== stop.id) : [...ids, stop.id]))}
            style={{ paddingVertical: 6 }}
          >
            <Row>
              <Txt style={{ flex: 1 }}>
                {checked ? '☑' : '☐'} {stop.title}
              </Txt>
              <Txt v="caption" color="muted">
                {saved.includes(stop.id) ? 'Shortlisted' : 'Site visit'}
              </Txt>
            </Row>
            {stop.address && stop.address !== stop.title && (
              <Txt v="caption" color="muted">
                {stop.address}
              </Txt>
            )}
          </PressableScale>
        );
      })}
      {canEdit && <Button title="Save shortlist" size="sm" disabled={!changed} loading={save.isPending} onPress={() => save.mutate()} />}
    </Card>
  );
}

import { useState } from 'react';
import { View } from 'react-native';
import { MAX_VISIT_PROPERTIES, visitInventoryTitle, visitPropertyStops, type LedgerItem, type VisitPropertyStop } from '@brokeriq/shared';
import { Button, Row, Txt } from '@/ui';
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

export function VisitItinerary({ snapshot }: { snapshot?: { stops?: VisitPropertyStop[] } | null }) {
  const [expanded, setExpanded] = useState(false);
  const stops = visitPropertyStops(snapshot);
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

import { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { Building2, MapPin, ShieldCheck } from 'lucide-react-native';
import { directoryProfile, type DirectoryRecord } from '@brokeriq/shared';
import { Txt, Button, Row } from '@/ui';
import { NativeCard } from './screen';
import { WorkspaceHero, WorkspaceTag } from './workspace';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { errorMessage } from '@/lib/api';
export function DirectoryDetails({ record }: { record: DirectoryRecord }) {
  const { c } = useTheme(),
    profile = directoryProfile(record);
  const [expanded, setExpanded] = useState<string[]>([]);
  const open = (url: string) => Linking.openURL(url).catch((error) => toast.error(errorMessage(error)));
  const facts = [
    ['Developer / promoter', record.builderName],
    ['Sector / locality', record.sector],
    ['Address', record.address],
    ['City', record.city ?? 'Gurugram'],
    ['Source category', record.category],
    ['Registration / licence', record.registrationNumber],
    ['Registry status', record.registrationStatus],
    ['Registration up to · Source value', record.registrationUntil],
    ['Category evidence', record.categoryEvidence],
    ...profile.facts.map((fact) => [fact.label, fact.value]),
  ].filter(([, value]) => value != null && value !== '');
  return (
    <View style={{ gap: 16 }}>
      <WorkspaceHero
        label={`PROJECT INTELLIGENCE · ${record.provider}`}
        title={record.name.trim()}
        description={record.builderName || 'Developer not recorded by source'}
      />
      {profile.photos.map((photo) => (
        <NativeCard key={photo.url}>
          <Image
            source={{ uri: photo.url }}
            contentFit="cover"
            style={{ width: '100%', aspectRatio: 1.5, borderRadius: 14 }}
            accessibilityLabel={photo.caption}
          />
          <Txt v="small">{photo.caption}</Txt>
          <Txt v="caption" color="muted">
            {photo.author} · {photo.license}
            {photo.capturedAt ? ` · ${photo.capturedAt}` : ''}
          </Txt>
          <Button title="Image source & credit" size="sm" variant="ghost" onPress={() => open(photo.sourceUrl)} />
          <Button title="Image licence" size="sm" variant="ghost" onPress={() => open(photo.licenseUrl)} />
        </NativeCard>
      ))}
      {!profile.photos.length && (
        <Txt v="caption" color="muted">
          No verified project photograph in the available sources.
        </Txt>
      )}
      <NativeCard>
        <Row>
          <Building2 size={20} color={c.brand} />
          <Txt v="h3">Project facts</Txt>
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {facts.map(([label, value], index) => (
            <View key={index} style={{ flexGrow: 1, flexBasis: '44%', gap: 5, paddingVertical: 7 }}>
              <Txt v="caption" color="muted">
                {label}
              </Txt>
              <Txt v="small">{value}</Txt>
            </View>
          ))}
        </View>
      </NativeCard>
      {profile.tables.map((table) => (
        <NativeCard key={table.key}>
          <Txt v="title">{table.title}</Txt>
          <WorkspaceTag tone="muted" label={`${table.rows.length} source rows`} />
          <Button
            variant="secondary"
            title={expanded.includes(table.key) ? 'Collapse details' : 'View all source details'}
            onPress={() => setExpanded((current) => (current.includes(table.key) ? current.filter((key) => key !== table.key) : [...current, table.key]))}
          />
          {expanded.includes(table.key) && (
            <ScrollView horizontal>
              <View style={{ width: Math.max(520, table.rows[0]?.length * 150), gap: 0 }}>
                {table.rows.map((row, index) => (
                  <View key={index} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: c.line, paddingVertical: 10, gap: 10 }}>
                    {row.map((value, column) => (
                      <Txt key={column} v="caption" color={index === 0 ? undefined : 'muted'} style={{ flex: 1 }}>
                        {value}
                      </Txt>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </NativeCard>
      ))}
      <NativeCard>
        <Row>
          <MapPin size={20} color={c.brand} />
          <Txt v="h3">Location & coverage</Txt>
        </Row>
        {record.latitude != null && record.longitude != null ? (
          <>
            <Txt v="small">{`${record.latitude.toFixed(6)}, ${record.longitude.toFixed(6)}`}</Txt>
            <Txt v="caption" color="muted">
              {record.coordinateSource?.replace(/_/g, ' ')}. Source-derived point; this may represent a colony or building centre, not its entrance.
            </Txt>
            <Button
              title="Open location"
              variant="secondary"
              onPress={() =>
                open(`https://www.openstreetmap.org/?mlat=${record.latitude}&mlon=${record.longitude}#map=16/${record.latitude}/${record.longitude}`)
              }
            />
          </>
        ) : (
          <Txt v="small" color="muted">
            Coordinates are not available in this source. The record remains searchable in List.
          </Txt>
        )}
      </NativeCard>
      <NativeCard>
        <Row>
          <ShieldCheck size={20} color={c.brand} />
          <Txt v="h3">Source & provenance</Txt>
        </Row>
        <Txt v="caption" color="muted">
          {profile.note}
        </Txt>
        <Txt v="caption" color="muted">
          Different registrations and phases remain separate. Planned dates, specifications and approvals are historical source statements; they do not confirm
          current possession, approval or unit availability.
        </Txt>
        {profile.sourceUrl && <Button title="Official record" variant="secondary" onPress={() => open(profile.sourceUrl!)} />}
        {profile.enrichmentUrl && <Button title="Detailed source form" variant="secondary" onPress={() => open(profile.enrichmentUrl!)} />}
        <Txt
          v="caption"
          color="muted"
        >{`${record.provider} · ${record.externalId} · Retrieved ${new Date(record.sourceFetchedAt).toLocaleString('en-IN')}`}</Txt>
        {profile.enrichedAt && <Txt v="caption" color="muted">{`Details fetched ${new Date(profile.enrichedAt).toLocaleDateString('en-IN')}`}</Txt>}
        {!!profile.attribution && (
          <Txt v="caption" color="muted">
            {profile.attribution}
          </Txt>
        )}
        <Txt v="small">Directory information does not add a property to your firm’s private inventory.</Txt>
      </NativeCard>
    </View>
  );
}

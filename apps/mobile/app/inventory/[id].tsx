import { WorkspaceHero, WorkspaceTag } from '@/launch/workspace';
import { SourceImage } from '@/launch/source-image';
import { floorLabel, inventoryFactGroups, inventoryTitle, inventoryPrice, readableValue } from '@brokeriq/shared';
import { ScrollView, View, Linking, Share, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { type LedgerItem } from '@brokeriq/shared';
import { api, API_URL, authStore, errorMessage } from '@/lib/api';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { Txt, Button, ErrorView } from '@/ui';
import { toast } from '@/lib/toast';
import { propertyShare } from '@/launch/property-card';
export default function PropertyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['ledger-item', id], queryFn: () => api<LedgerItem>(`/inventory/${id}`) });
  const item = q.data;
  return (
    <BrokerScreen title={item ? inventoryTitle(item) : 'Property details'} subtitle={item?.sector ?? undefined} back>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 16, paddingBottom: 30 }}>
        {q.error && <ErrorView error={q.error} onRetry={() => q.refetch()} />}
        {q.isPending && <ActivityIndicator style={{ padding: 40 }} />}
        {item && (
          <>
            <WorkspaceHero
              label="PROPERTY OVERVIEW"
              title={inventoryPrice(item)}
              description={`${item.bhk ? `${item.bhk} ${item.roomKind || 'rooms'}` : 'Rooms unknown'} · ${floorLabel(item.floor)}`}
            />
            <NativeCard>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <WorkspaceTag label={item.furnishing?.replace(/_/g, ' ') || 'Furnishing unknown'} />
                <WorkspaceTag tone="muted" label={item.area != null ? `${item.area} ${item.areaUnit ?? ''}` : 'Area not recorded'} />
                {item.assignedTo && (
                  <WorkspaceTag tone="brand" label={`👤 ${item.assignedTo.name} (${item.assignedTo.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'})`} />
                )}
                {item.matchingLeadsCount != null && item.matchingLeadsCount > 0 && (
                  <WorkspaceTag tone="brand" label={`🔥 ${item.matchingLeadsCount} Leads Match`} />
                )}
              </View>
              <Txt v="small" color="muted">
                {item.availability === 'UNKNOWN' ? 'Availability needs confirmation' : (item.availability ?? 'UNKNOWN')}
              </Txt>
              {item.availability === 'UNKNOWN' && (
                <Button
                  title="Confirm available"
                  variant="secondary"
                  onPress={async () => {
                    try {
                      await api(`/inventory/${id}`, { method: 'PATCH', body: { availability: 'AVAILABLE', expectedRevision: item.revision } });
                      await qc.invalidateQueries({ queryKey: ['ledger-item', id] });
                      await qc.invalidateQueries({ queryKey: ['ledger'] });
                    } catch (error) {
                      toast.error(errorMessage(error));
                    }
                  }}
                />
              )}
            </NativeCard>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Edit property" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/inventory-edit?id=${id}` as any)} />
              <Button
                title="Share property"
                style={{ flex: 1 }}
                onPress={() => Share.share({ message: propertyShare(item) }).catch((error) => toast.error(errorMessage(error)))}
              />
            </View>
            <Button title="Publish / review rental" variant="secondary" onPress={() => router.push(`/publish-rental?id=${id}` as any)} />
            {inventoryFactGroups(item).map((group) => (
              <NativeCard key={group.title}>
                <Txt v="h3">{group.title}</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                  {group.facts.map((fact) => (
                    <View key={fact.label} style={{ flexGrow: 1, flexBasis: '44%', gap: 5, paddingVertical: 8 }}>
                      <Txt v="caption" color="muted">
                        {fact.label}
                      </Txt>
                      <Txt v="small">{fact.value}</Txt>
                    </View>
                  ))}
                </View>
              </NativeCard>
            ))}
            {!!item.amenities?.length && (
              <NativeCard>
                <Txt v="h3">Amenities</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {item.amenities.map((value) => (
                    <WorkspaceTag key={value} label={readableValue(value)} />
                  ))}
                </View>
              </NativeCard>
            )}
            <NativeCard>
              <Txt v="title">Record & verification</Txt>
              <WorkspaceTag
                tone={item.availability === 'AVAILABLE' ? 'success' : 'warning'}
                label={item.availability === 'UNKNOWN' ? 'Availability needs confirmation' : readableValue(item.availability ?? 'UNKNOWN')}
              />
              <Txt v="caption" color="muted">{`Source: ${readableValue(item.sourceType)} · Revision ${item.revision}`}</Txt>
              <Txt v="caption" color="muted">{`Last updated: ${new Date(item.updatedAt).toLocaleString('en-IN')}`}</Txt>
            </NativeCard>
            {(item.photoUrls ?? []).map((uri) => (
              <Image key={uri} source={{ uri }} contentFit="contain" style={{ width: '100%', height: 220 }} />
            ))}
            {(item.videoUrls ?? []).map((uri) => (
              <Button
                key={uri}
                title="Open property video"
                variant="secondary"
                onPress={() => Linking.openURL(uri).catch((error) => toast.error(errorMessage(error)))}
              />
            ))}
            <Txt v="h3">Contacts</Txt>
            {item.contacts.map((contact, index) => (
              <NativeCard key={index}>
                <Txt v="title">{contact.name || 'Name not recorded'}</Txt>
                <Txt v="caption" color="muted">
                  {readableValue(contact.role)}
                </Txt>
                {!!contact.note && (
                  <Txt v="small" color="muted">
                    {contact.note}
                  </Txt>
                )}
                {contact.phone && (
                  <>
                    <Txt>{contact.phone}</Txt>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Button
                        title="Call"
                        variant="secondary"
                        style={{ flex: 1 }}
                        onPress={() => Linking.openURL(`tel:${contact.phone}`).catch((error) => toast.error(errorMessage(error)))}
                      />
                      <Button
                        title="WhatsApp"
                        variant="secondary"
                        style={{ flex: 1 }}
                        onPress={() =>
                          Linking.openURL(`https://wa.me/91${contact.phone!.replace(/\D/g, '').slice(-10)}`).catch((error) => toast.error(errorMessage(error)))
                        }
                      />
                    </View>
                  </>
                )}
              </NativeCard>
            ))}
            {item.notes && (
              <NativeCard>
                <Txt v="title">Notes</Txt>
                <Txt color="muted">{item.notes}</Txt>
              </NativeCard>
            )}
            {item.sourceEntry && (
              <>
                <Txt v="h3">Source</Txt>
                {item.sourceEntry.batch?.id && (item.pageNo || item.sourceEntry.batch.sourceType === 'IMAGE') && (
                  <SourceImage
                    uri={`${API_URL}/imports/${item.sourceEntry.batch?.id}/source?${item.pageNo ? `pageNo=${item.pageNo}&` : ''}entryId=${item.sourceEntry.id}`}
                    token={authStore.get()?.accessToken}
                  />
                )}
                <NativeCard>
                  <Txt v="caption" color="muted">
                    {item.sourceType === 'PDF_REGISTER' ? 'Register' : item.sourceType?.replace(/_/g, ' ')}
                    {item.pageNo ? ` · Page ${item.pageNo}` : ''}
                  </Txt>
                  {item.sourceEntry.rawText !== item.notes && (
                    <Txt v="small" color="muted">
                      {item.sourceEntry.rawText}
                    </Txt>
                  )}
                  <Button title="Open source review" variant="secondary" onPress={() => router.push(`/import-review/${item.sourceEntry?.batch?.id}` as any)} />
                </NativeCard>
              </>
            )}
          </>
        )}
      </ScrollView>
    </BrokerScreen>
  );
}

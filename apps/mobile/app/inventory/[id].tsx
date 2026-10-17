import { SourceImage } from '@/launch/source-image';
import { floorLabel } from '@brokeriq/shared';
import { ScrollView, View, Linking, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { type LedgerItem, formatINR, PROPERTY_FIELDS } from '@brokeriq/shared';
import { api, API_URL, authStore, errorMessage } from '@/lib/api';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { Txt, Button } from '@/ui';
import { toast } from '@/lib/toast';
import { propertyShare } from '@/launch/property-card';
export default function PropertyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['ledger-item', id], queryFn: () => api<LedgerItem>(`/inventory/${id}`) });
  const item = q.data;
  return (
    <BrokerScreen title={item?.houseNo ? `House ${item.houseNo}` : 'Property details'} subtitle={item?.sector ?? undefined} back>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 16, paddingBottom: 30 }}>
        {q.error && <Txt color="danger">{errorMessage(q.error)}</Txt>}
        {item && (
          <>
            <NativeCard>
              <Txt v="h2">
                {item.monthlyRent != null && item.purpose === 'RENT'
                  ? `${formatINR(item.monthlyRent)}/month`
                  : item.totalSalePrice != null
                    ? formatINR(item.totalSalePrice)
                    : item.ratePerArea != null
                      ? `${formatINR(item.ratePerArea)}/${item.rateAreaUnit}`
                      : 'Price not recorded'}
              </Txt>
              <Txt>
                {item.bhk ? `${item.bhk} ${item.roomKind || 'rooms'}` : 'Rooms unknown'} · {floorLabel(item.floor)}
              </Txt>
              <Txt color="muted">{item.furnishing?.replace(/_/g, ' ') || 'Furnishing unknown'}</Txt>
              <Txt>{item.area ? `${item.area} ${item.areaUnit}` : 'Area not recorded'}</Txt>
              <Txt v="title">{item.availability === 'UNKNOWN' ? 'Availability needs confirmation' : (item.availability ?? 'UNKNOWN')}</Txt>
              <Button title="Edit property" variant="secondary" onPress={() => router.push(`/inventory-edit?id=${id}` as any)} />
              <Button title="Publish / review rental" variant="secondary" onPress={() => router.push(`/publish-rental?id=${id}` as any)} />
              <Button title="Share property" onPress={() => Share.share({ message: propertyShare(item) })} />
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
            <NativeCard>
              <Txt v="h3">Property details</Txt>
              {PROPERTY_FIELDS.filter((field) => item.details?.[field.key] != null).map((field) => (
                <View key={field.key} style={{ gap: 3 }}>
                  <Txt v="caption" color="muted">
                    {field.label}
                  </Txt>
                  <Txt>{String(item.details![field.key]).replace(/_/g, ' ')}</Txt>
                </View>
              ))}
              {!!item.amenities?.length && <Txt v="small">{item.amenities.join(' · ').replace(/_/g, ' ')}</Txt>}
            </NativeCard>
            {(item.photoUrls ?? []).map((uri) => (
              <Image key={uri} source={{ uri }} contentFit="contain" style={{ width: '100%', height: 220 }} />
            ))}
            {(item.videoUrls ?? []).map((uri) => (
              <Button key={uri} title="Open property video" variant="secondary" onPress={() => Linking.openURL(uri)} />
            ))}
            <Txt v="h3">Contacts</Txt>
            {item.contacts.map((contact, index) => (
              <NativeCard key={index}>
                <Txt v="title">{contact.name || 'Name not recorded'}</Txt>
                <Txt v="caption" color="muted">
                  {contact.role}
                </Txt>
                {contact.phone && (
                  <>
                    <Txt>{contact.phone}</Txt>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Button title="Call" variant="secondary" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${contact.phone}`)} />
                      <Button
                        title="WhatsApp"
                        variant="secondary"
                        style={{ flex: 1 }}
                        onPress={() => Linking.openURL(`https://wa.me/91${contact.phone!.replace(/\D/g, '').slice(-10)}`)}
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
                {item.pageNo && (
                  <SourceImage
                    uri={`${API_URL}/imports/${item.sourceEntry.batch?.id}/source?pageNo=${item.pageNo}&entryId=${item.sourceEntry.id}`}
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

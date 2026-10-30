import { useState } from 'react';
import { ScrollView, View, Linking, Share, ActivityIndicator, Pressable, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import {
  type LedgerItem,
  floorLabel,
  inventoryFactGroups,
  inventoryTitle,
  inventoryPrice,
  readableValue,
} from '@brokeriq/shared';
import { api, API_URL, authStore, errorMessage } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { Txt, Button, ErrorView, Sheet } from '@/ui';
import { toast } from '@/lib/toast';
import { propertyShare } from '@/launch/property-card';
import { SourceImage } from '@/launch/source-image';
import { useAuth } from '@/lib/auth';
import {
  Phone,
  MessageCircle,
  Share2,
  Edit3,
  UserCheck,
  Flame,
  CheckCircle2,
  Building2,
  Check,
  Sparkles,
  Layers,
  Maximize2,
  Compass,
  Calendar,
} from 'lucide-react-native';

export default function PropertyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, isDark } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'BROKER_ADMIN';
  const qc = useQueryClient();

  const [reassignOpen, setReassignOpen] = useState(false);
  const [matchLeadsOpen, setMatchLeadsOpen] = useState(false);
  const [updatingAssignee, setUpdatingAssignee] = useState(false);
  const [confirmingAvail, setConfirmingAvail] = useState(false);

  const q = useQuery({
    queryKey: ['ledger-item', id],
    queryFn: () => api<LedgerItem>(`/inventory/${id}`),
  });

  const team = useQuery({
    queryKey: ['broker-team'],
    queryFn: () => api<any>('/broker/team'),
  });

  const item = q.data;
  const teamMembers: any[] = (Array.isArray(team.data) ? team.data : team.data?.members) || [];
  const primaryContact = item?.contacts?.[0];

  async function handleAssign(memberId: string | null) {
    if (!item) return;
    setUpdatingAssignee(true);
    try {
      await api(`/inventory/${id}`, {
        method: 'PATCH',
        body: {
          assignedToId: memberId,
          expectedRevision: item.revision,
        },
      });
      await qc.invalidateQueries({ queryKey: ['ledger-item', id] });
      await qc.invalidateQueries({ queryKey: ['ledger'] });
      toast.success(memberId ? 'Assignee updated successfully' : 'Assignee cleared');
      setReassignOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUpdatingAssignee(false);
    }
  }

  async function handleConfirmAvailable() {
    if (!item) return;
    setConfirmingAvail(true);
    try {
      await api(`/inventory/${id}`, {
        method: 'PATCH',
        body: {
          availability: 'AVAILABLE',
          expectedRevision: item.revision,
        },
      });
      await qc.invalidateQueries({ queryKey: ['ledger-item', id] });
      await qc.invalidateQueries({ queryKey: ['ledger'] });
      toast.success('Marked as AVAILABLE');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setConfirmingAvail(false);
    }
  }

  return (
    <BrokerScreen
      title={item ? inventoryTitle(item) : 'Property details'}
      subtitle={item?.sector ? `📍 ${item.sector}` : undefined}
      back
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14, paddingBottom: 110 }}>
        {q.error && <ErrorView error={q.error} onRetry={() => q.refetch()} />}
        {q.isPending && <ActivityIndicator color={c.brand} style={{ padding: 40 }} />}

        {item && (
          <>
            {/* Top Luxury Price & Header Hero */}
            <View
              style={{
                borderRadius: 24,
                padding: 20,
                backgroundColor: isDark ? '#12162A' : '#FFFFFF',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(99,102,241,0.25)' : c.line,
                shadowColor: '#000',
                shadowOpacity: 0.08,
                shadowRadius: 14,
                elevation: 4,
                gap: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: item.purpose === 'RENT' ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                  }}
                >
                  <Txt
                    v="caption"
                    style={{
                      fontWeight: '800',
                      letterSpacing: 1,
                      color: item.purpose === 'RENT' ? c.success : c.brand,
                    }}
                  >
                    FOR {item.purpose ?? 'RENT'}
                  </Txt>
                </View>

                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: item.availability === 'AVAILABLE' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                  }}
                >
                  <Txt
                    v="caption"
                    style={{
                      fontWeight: '700',
                      color: item.availability === 'AVAILABLE' ? c.success : c.warning,
                    }}
                  >
                    {item.availability === 'AVAILABLE' ? '● AVAILABLE' : '● ' + (item.availability || 'UNKNOWN')}
                  </Txt>
                </View>
              </View>

              <View style={{ gap: 4 }}>
                <Txt style={{ fontSize: 32, fontWeight: '900', color: c.fg, letterSpacing: -0.5 }}>
                  {inventoryPrice(item)}
                </Txt>
                <Txt v="body" color="muted">
                  {item.houseNo ? `#${item.houseNo}, ` : ''}{item.sector ?? item.address ?? 'Sector unknown'}
                </Txt>
              </View>

              {/* Micro Specs Bar */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : c.line,
                }}
              >
                {item.bhk != null && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.surface2 }}>
                    <Layers size={14} color={c.brand} />
                    <Txt v="small" style={{ fontWeight: '600' }}>{item.bhk} {item.roomKind || 'BHK'}</Txt>
                  </View>
                )}
                {item.area != null && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.surface2 }}>
                    <Maximize2 size={14} color={c.brand} />
                    <Txt v="small" style={{ fontWeight: '600' }}>{item.area} {item.areaUnit || 'SQ_FT'}</Txt>
                  </View>
                )}
                {item.floor != null && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.surface2 }}>
                    <Building2 size={14} color={c.brand} />
                    <Txt v="small" style={{ fontWeight: '600' }}>{floorLabel(item.floor)}</Txt>
                  </View>
                )}
                {item.furnishing && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.surface2 }}>
                    <Sparkles size={14} color={c.brand} />
                    <Txt v="small" style={{ fontWeight: '600' }}>{readableValue(item.furnishing)}</Txt>
                  </View>
                )}
              </View>
            </View>

            {/* Quick Action Badges: 1-Tap Assignee Reassign & Auto Match Leads */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Assignee Card with 1-Tap Quick Change */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => (isAdmin ? setReassignOpen(true) : toast.info('Only Broker Admin can re-assign properties'))}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: isDark ? '#141828' : c.surface,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(99,102,241,0.3)' : c.line,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: 'rgba(99,102,241,0.18)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UserCheck size={18} color={c.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="caption" color="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    {isAdmin ? 'Assignee (Tap to change)' : 'Assignee'}
                  </Txt>
                  <Txt v="bodyStrong" numberOfLines={1}>
                    {item.assignedTo ? item.assignedTo.name : 'Unassigned'}
                  </Txt>
                  {item.assignedTo?.role && (
                    <Txt v="caption" color="muted" style={{ fontSize: 10 }}>
                      {item.assignedTo.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'}
                    </Txt>
                  )}
                </View>
              </TouchableOpacity>

              {/* Match Leads Card with 1-Tap Open */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setMatchLeadsOpen(true)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: isDark ? '#1A1424' : '#FFF9F2',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(245,158,11,0.3)' : '#FDE68A',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: 'rgba(245,158,11,0.18)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Flame size={18} color={c.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="caption" color="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Buyer Leads
                  </Txt>
                  <Txt v="bodyStrong" numberOfLines={1} style={{ color: c.warning }}>
                    {item.matchingLeadsCount != null && item.matchingLeadsCount > 0
                      ? `${item.matchingLeadsCount} Leads Match`
                      : 'Match Leads'}
                  </Txt>
                  <Txt v="caption" color="muted" style={{ fontSize: 10 }}>
                    Tap to share
                  </Txt>
                </View>
              </TouchableOpacity>
            </View>

            {/* Need Availability Confirmation Banner */}
            {item.availability === 'UNKNOWN' && (
              <View
                style={{
                  padding: 16,
                  borderRadius: 18,
                  backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : '#FEF3C7',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(245,158,11,0.25)' : '#FCD34D',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt v="bodyStrong" style={{ color: isDark ? '#FCD34D' : '#92400E' }}>
                    Availability Unknown
                  </Txt>
                  <Txt v="caption" style={{ color: isDark ? '#FDE68A' : '#B45309' }}>
                    Verify with owner before sharing with buyers.
                  </Txt>
                </View>
                <Button
                  title="Verify now"
                  size="sm"
                  loading={confirmingAvail}
                  onPress={handleConfirmAvailable}
                />
              </View>
            )}

            {/* Primary Contacts Card */}
            <NativeCard style={{ gap: 14 }}>
              <Txt v="h3">Contacts & Owner</Txt>
              {item.contacts && item.contacts.length > 0 ? (
                item.contacts.map((contact, index) => (
                  <View
                    key={index}
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : c.surface2,
                      borderWidth: 1,
                      borderColor: c.line,
                      gap: 10,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ gap: 2 }}>
                        <Txt v="bodyStrong">{contact.name || 'Name not recorded'}</Txt>
                        <Txt v="caption" color="muted">
                          {readableValue(contact.role)}
                        </Txt>
                      </View>
                      {contact.phone && (
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => Linking.openURL(`tel:${contact.phone}`).catch((e) => toast.error(errorMessage(e)))}
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 12,
                              backgroundColor: 'rgba(16,185,129,0.15)',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Phone size={18} color={c.success} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() =>
                              Linking.openURL(`https://wa.me/91${contact.phone!.replace(/\D/g, '').slice(-10)}`).catch((e) =>
                                toast.error(errorMessage(e)),
                              )
                            }
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 12,
                              backgroundColor: 'rgba(37,211,102,0.15)',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <MessageCircle size={18} color="#25D366" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                    {contact.phone && (
                      <Txt v="small" color="muted">
                        📞 {contact.phone}
                      </Txt>
                    )}
                    {contact.note && (
                      <Txt v="caption" color="muted">
                        Note: {contact.note}
                      </Txt>
                    )}
                  </View>
                ))
              ) : (
                <Txt v="small" color="muted">
                  No contacts recorded for this property.
                </Txt>
              )}
            </NativeCard>

            {/* Fact Groups (Specs, Dimensions, Rates) */}
            {inventoryFactGroups(item).map((group) => (
              <NativeCard key={group.title} style={{ gap: 12 }}>
                <Txt v="h3">{group.title}</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {group.facts.map((fact) => (
                    <View
                      key={fact.label}
                      style={{
                        flexGrow: 1,
                        flexBasis: '45%',
                        padding: 10,
                        borderRadius: 12,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : c.surface2,
                        gap: 4,
                      }}
                    >
                      <Txt v="caption" color="muted">
                        {fact.label}
                      </Txt>
                      <Txt v="bodyStrong">{fact.value}</Txt>
                    </View>
                  ))}
                </View>
              </NativeCard>
            ))}

            {/* Amenities */}
            {!!item.amenities?.length && (
              <NativeCard style={{ gap: 12 }}>
                <Txt v="h3">Amenities</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {item.amenities.map((value) => (
                    <View
                      key={value}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : c.surface2,
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(99,102,241,0.3)' : c.line,
                      }}
                    >
                      <Txt v="small" style={{ fontWeight: '600' }}>
                        {readableValue(value)}
                      </Txt>
                    </View>
                  ))}
                </View>
              </NativeCard>
            )}

            {/* Photos & Videos */}
            {(item.photoUrls ?? []).map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                contentFit="cover"
                style={{ width: '100%', height: 230, borderRadius: 20 }}
              />
            ))}

            {(item.videoUrls ?? []).map((uri) => (
              <Button
                key={uri}
                title="▶ Watch Property Video"
                variant="secondary"
                onPress={() => Linking.openURL(uri).catch((e) => toast.error(errorMessage(e)))}
              />
            ))}

            {/* Notes */}
            {item.notes && (
              <NativeCard style={{ gap: 8 }}>
                <Txt v="h3">Notes</Txt>
                <Txt color="muted">{item.notes}</Txt>
              </NativeCard>
            )}

            {/* Source Audit & Verification Details */}
            <NativeCard style={{ gap: 8 }}>
              <Txt v="title">Audit Trail & Sync</Txt>
              <Txt v="caption" color="muted">
                Source: {readableValue(item.sourceType)} · Revision {item.revision}
              </Txt>
              <Txt v="caption" color="muted">
                Last modified: {new Date(item.updatedAt).toLocaleString('en-IN')}
              </Txt>
            </NativeCard>

            {item.sourceEntry && (
              <>
                <Txt v="h3">Original Import Source</Txt>
                {item.sourceEntry.batch?.id && (item.pageNo || item.sourceEntry.batch.sourceType === 'IMAGE') && (
                  <SourceImage
                    uri={`${API_URL}/imports/${item.sourceEntry.batch?.id}/source?${item.pageNo ? `pageNo=${item.pageNo}&` : ''}entryId=${item.sourceEntry.id}`}
                    token={authStore.get()?.accessToken}
                  />
                )}
                <NativeCard style={{ gap: 8 }}>
                  <Txt v="caption" color="muted">
                    {item.sourceType === 'PDF_REGISTER' ? 'Register' : item.sourceType?.replace(/_/g, ' ')}
                    {item.pageNo ? ` · Page ${item.pageNo}` : ''}
                  </Txt>
                  {item.sourceEntry.rawText !== item.notes && (
                    <Txt v="small" color="muted">
                      {item.sourceEntry.rawText}
                    </Txt>
                  )}
                  <Button
                    title="Open source review"
                    variant="secondary"
                    onPress={() => router.push(`/import-review/${item.sourceEntry?.batch?.id}` as any)}
                  />
                </NativeCard>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Floating 1-Tap Quick Action Dock at Bottom */}
      {item && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 22,
            backgroundColor: isDark ? 'rgba(15, 18, 32, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderTopWidth: 1,
            borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : c.line,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {primaryContact?.phone ? (
            <TouchableOpacity
              onPress={() =>
                Linking.openURL(`tel:${primaryContact.phone}`).catch((e) => toast.error(errorMessage(e)))
              }
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: 'rgba(16,185,129,0.18)',
                borderWidth: 1,
                borderColor: 'rgba(16,185,129,0.35)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Phone size={20} color={c.success} />
            </TouchableOpacity>
          ) : null}

          {primaryContact?.phone ? (
            <TouchableOpacity
              onPress={() =>
                Linking.openURL(`https://wa.me/91${primaryContact.phone!.replace(/\D/g, '').slice(-10)}`).catch((e) =>
                  toast.error(errorMessage(e)),
                )
              }
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: 'rgba(37,211,102,0.18)',
                borderWidth: 1,
                borderColor: 'rgba(37,211,102,0.35)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageCircle size={20} color="#25D366" />
            </TouchableOpacity>
          ) : null}

          <Button
            title="Share"
            variant="secondary"
            style={{ flex: 1, height: 48, borderRadius: 16 }}
            onPress={() => Share.share({ message: propertyShare(item) }).catch((e) => toast.error(errorMessage(e)))}
          />

          <Button
            title="Edit"
            style={{ flex: 1.2, height: 48, borderRadius: 16 }}
            onPress={() => router.push(`/inventory-edit?id=${id}` as any)}
          />
        </View>
      )}

      {/* 1-Tap Quick Assignee Selection Sheet */}
      <Sheet open={reassignOpen} onClose={() => setReassignOpen(false)} title="Change Assignee">
        <View style={{ gap: 8, paddingBottom: 20 }}>
          <TouchableOpacity
            onPress={() => handleAssign(null)}
            style={{
              padding: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: !item?.assignedTo ? c.brand : c.line,
              backgroundColor: !item?.assignedTo ? c.brandSoft : c.surface,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View>
              <Txt v="bodyStrong">Unassigned (None)</Txt>
              <Txt v="caption" color="muted">
                Clear assigned broker/agent
              </Txt>
            </View>
            {!item?.assignedTo && <Check size={18} color={c.brand} />}
          </TouchableOpacity>

          {teamMembers.map((member) => {
            const isAssigned = item?.assignedTo?.id === member.id;
            return (
              <TouchableOpacity
                key={member.id}
                onPress={() => handleAssign(member.id)}
                disabled={updatingAssignee}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: isAssigned ? c.brand : c.line,
                  backgroundColor: isAssigned ? c.brandSoft : c.surface,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Txt v="bodyStrong">{member.name || member.email || member.phone}</Txt>
                  <Txt v="caption" color="muted">
                    {member.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'} · {member.email || member.phone || ''}
                  </Txt>
                </View>
                {isAssigned && <Check size={18} color={c.brand} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </Sheet>

      {/* Matching Leads Sheet */}
      <Sheet open={matchLeadsOpen} onClose={() => setMatchLeadsOpen(false)} title="Matching Buyer Leads">
        <View style={{ gap: 14, paddingBottom: 20 }}>
          <Txt color="muted">
            {item?.matchingLeadsCount
              ? `Found ${item.matchingLeadsCount} active leads looking for ${item.bhk ? `${item.bhk} BHK` : 'property'} within this budget.`
              : 'No auto-matching leads found for current criteria.'}
          </Txt>

          <Button
            title="Open Leads Manager"
            onPress={() => {
              setMatchLeadsOpen(false);
              router.push('/(broker)/leads');
            }}
          />

          <Button
            title="Share Property Card to WhatsApp"
            variant="secondary"
            onPress={() => {
              if (item) {
                Share.share({ message: propertyShare(item) }).catch((e) => toast.error(errorMessage(e)));
              }
            }}
          />
        </View>
      </Sheet>
    </BrokerScreen>
  );
}

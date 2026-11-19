import { inventoryAccessRefreshInterval } from '@brokeriq/shared';
import { usePropertyGallery } from '@/lib/property-gallery';
import { InlineLoader } from '@/components/request-loader';
import { useState } from 'react';
import { View, Linking, Share, Pressable, TouchableOpacity } from 'react-native';
import { ScrollView } from '@/components/keyboard-scroll-view';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from '@/lib/image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  propertyGalleryDraft,
  clientPropertyShare,
  shareablePropertyPhotoUrls,
  type LedgerItem,
  floorLabel,
  inventoryFactGroups,
  inventoryTitle,
  inventoryPrice,
  inventoryNavigation,
  inventoryPossessionLabel,
  readableValue,
} from '@brokeriq/shared';
import { api, API_URL, assertAccountContext, authStore, captureAccountContext, errorMessage, uploadUri } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { Txt, Button, ErrorView, Sheet } from '@/ui';
import { toast } from '@/lib/toast';
import { SharePhotoFilesButton } from '@/components/share-photo-files-button';
import { SourceImage } from '@/launch/source-image';
import { hasDelegatedAccess } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { InventoryDetailAccess } from '@/components/inventory-detail-access';
import { InventoryLeadShare } from '@/components/inventory-lead-share';
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
  const { id, share } = useLocalSearchParams<{ id: string; share?: string }>();
  const { c, isDark } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'BROKER_ADMIN';
  const delegated = user?.role === 'SUB_BROKER_ADMIN';
  const canAssign = isAdmin || (delegated && hasDelegatedAccess(user, 'inventory', 'edit', 'assign'));
  const itemEditable = hasDelegatedAccess(user, 'inventory', 'edit');
  const qc = useQueryClient();

  const [navigationOpen, setNavigationOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [matchLeadsOpen, setMatchLeadsOpen] = useState(false);
  const [shareExternally, setShareExternally] = useState(share === 'photos');
  const [shareWithLead, setShareWithLead] = useState(share === '1');
  const [updatingAssignee, setUpdatingAssignee] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const q = useQuery({
    queryKey: ['ledger-item', id],
    queryFn: () => api<LedgerItem>(`/inventory/${id}`),
    refetchInterval: (state) => (state.state.data ? inventoryAccessRefreshInterval([state.state.data]) : false),
  });

  const team = useQuery({
    queryKey: ['broker-team', 'inventory-assignees', user?.id],
    queryFn: () => api<any>(delegated ? '/inventory/assignees' : '/broker/team'),
    enabled: canAssign,
  });

  const item = q.data;
  const gallery = usePropertyGallery(item?.id, shareExternally && !!shareablePropertyPhotoUrls(item?.photoUrls).length);
  const canEdit = itemEditable && item?.canEdit !== false;
  const teamMembers: any[] = (Array.isArray(team.data) ? team.data : team.data?.members) || [];
  const primaryContact = item?.contacts?.[0];

  async function addPropertyPhoto() {
    if (!item || uploadingPhoto || (item.photoUrls?.length ?? 0) >= 50) return;
    const owner = captureAccountContext();
    setUploadingPhoto(true);
    try {
      const selection = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
      if (selection.canceled) return;
      const asset = selection.assets[0];
      const photo = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: Math.min(asset.width || 1800, 1800) } }], {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      assertAccountContext(owner);
      const { url } = await uploadUri(photo.uri, 'listing');
      await api(`/inventory/${item.id}/photos`, {
        method: 'PATCH',
        ownerContext: owner,
        body: { url },
      });
      await Promise.all([qc.invalidateQueries({ queryKey: ['ledger-item', id] }), qc.invalidateQueries({ queryKey: ['ledger'] })]);
      toast.success('Photo saved to this property');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploadingPhoto(false);
    }
  }

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

  function handleConfirmAvailable() {
    router.push({ pathname: '/inventory-edit', params: { id, makeAvailable: '1' } });
  }

  return (
    <BrokerScreen title={item ? inventoryTitle(item) : 'Property details'} subtitle={item?.sector ? `📍 ${item.sector}` : undefined} back>
      <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 4, gap: 10, paddingBottom: 80 }}>
        {q.error && <ErrorView error={q.error} onRetry={() => q.refetch()} />}
        {q.isPending && <InlineLoader style={{ padding: 40 }} />}

        {item && (
          <>
            <InventoryDetailAccess item={item} />
            {/* Top Luxury Price & Header Hero */}
            <View
              style={{
                borderRadius: 24,
                padding: 14,
                backgroundColor: isDark ? '#12162A' : '#FFFFFF',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(99,102,241,0.25)' : c.line,
                shadowColor: '#000',
                shadowOpacity: 0.08,
                shadowRadius: 14,
                elevation: 4,
                gap: 8,
              }}
            >
              {(item.availability === 'AVAILABLE' || item.sourceType === 'SURVEY') && (
                <Txt v="small" color="brand">
                  {inventoryPossessionLabel(item)}
                </Txt>
              )}
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
                    {item.purpose ? `FOR ${item.purpose}` : 'Transaction not recorded'}
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
                <Txt style={{ fontSize: 28, fontWeight: '900', color: c.fg, letterSpacing: -0.5 }}>{inventoryPrice(item)}</Txt>
                <Txt v="body" color="muted">
                  {item.houseNo ? `#${item.houseNo}, ` : ''}
                  {item.sector ?? item.address ?? 'Sector unknown'}
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
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 10,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.surface2,
                    }}
                  >
                    <Layers size={14} color={c.brand} />
                    <Txt v="small" style={{ fontWeight: '600' }}>
                      {item.bhk} {item.roomKind || 'rooms'}
                    </Txt>
                  </View>
                )}
                {item.area != null && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 10,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.surface2,
                    }}
                  >
                    <Maximize2 size={14} color={c.brand} />
                    <Txt v="small" style={{ fontWeight: '600' }}>
                      {item.area} {item.areaUnit || 'unit not recorded'}
                    </Txt>
                  </View>
                )}
                {item.floor != null && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 10,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.surface2,
                    }}
                  >
                    <Building2 size={14} color={c.brand} />
                    <Txt v="small" style={{ fontWeight: '600' }}>
                      {floorLabel(item.floor)}
                    </Txt>
                  </View>
                )}
                {item.furnishing && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 10,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.surface2,
                    }}
                  >
                    <Sparkles size={14} color={c.brand} />
                    <Txt v="small" style={{ fontWeight: '600' }}>
                      {readableValue(item.furnishing)}
                    </Txt>
                  </View>
                )}
              </View>
            </View>

            {/* Quick Action Badges: 1-Tap Assignee Reassign & Auto Match Leads */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Assignee Card with 1-Tap Quick Change */}
              <TouchableOpacity
                activeOpacity={0.75}
                disabled={!canAssign}
                onPress={() => (canAssign ? setReassignOpen(true) : toast.info('Only Broker Admin can re-assign properties'))}
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
                    {canAssign ? 'Assignee (Tap to change)' : 'Assignee'}
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
                    {item.matchingLeadsCount != null && item.matchingLeadsCount > 0 ? `${item.matchingLeadsCount} Leads Match` : 'Match Leads'}
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
                <Button title="Verify now" disabled={!canEdit} size="sm" onPress={handleConfirmAvailable} />
              </View>
            )}

            {/* Primary Contacts Card */}
            <Button title="Navigation" variant="secondary" icon={<Compass size={17} color={c.brand} />} onPress={() => setNavigationOpen(true)} />
            <Sheet open={navigationOpen} onClose={() => setNavigationOpen(false)} title="Navigation">
              <PropertyNavigationActions item={item} />
            </Sheet>
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
                              Linking.openURL(`https://wa.me/91${contact.phone!.replace(/\D/g, '').slice(-10)}`).catch((e) => toast.error(errorMessage(e)))
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
              <NativeCard key={group.title} style={{ gap: 8, padding: 12 }}>
                <Txt v="h3">{group.title}</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {group.facts.map((fact) => (
                    <View
                      key={fact.label}
                      style={{
                        flexGrow: 1,
                        flexBasis: '45%',
                        padding: 8,
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

            {!item.deletedAt && (item.photoUrls?.length ?? 0) < 50 && (
              <Button title="Add property photo" disabled={!canEdit} variant="secondary" loading={uploadingPhoto} onPress={addPropertyPhoto} />
            )}
            {/* Photos & Videos */}
            {(item.photoUrls ?? []).map((uri) => (
              <Image key={uri} source={{ uri }} contentFit="cover" style={{ width: '100%', height: 230, borderRadius: 20 }} />
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
            <Button
              title="Share using another app"
              variant="secondary"
              onPress={() => {
                if (shareablePropertyPhotoUrls(item.photoUrls).length) setShareExternally(true);
                else void Share.share({ message: clientPropertyShare(item) }).catch((e) => toast.error(errorMessage(e)));
              }}
            />
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
                  <Button title="Open source review" variant="secondary" onPress={() => router.push(`/import-review/${item.sourceEntry?.batch?.id}` as any)} />
                </NativeCard>
              </>
            )}
          </>
        )}
        {item && (
          <View style={{ padding: 16, gap: 8 }}>
            <Txt v="caption" color="muted">
              Publication: {item.publishedListing?.status || 'Not submitted'}
              {item.publishedListing?.reviewRequiredRole ? ' · ' + item.publishedListing.reviewRequiredRole : ''}
            </Txt>
            <Button
              title={isAdmin && item.publishedListing?.reviewRequiredRole === 'BROKER_ADMIN' ? 'Review publication' : 'Public preview / publish'}
              disabled={!hasDelegatedAccess(user, 'inventory', 'publish')}
              variant="secondary"
              onPress={() => router.push(`/publish-rental?id=${id}` as any)}
            />
            {!canEdit && (
              <Txt v="caption" color="muted">
                Ask your Broker Admin for inventory edit access to change details or upload photos.
              </Txt>
            )}
          </View>
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
              onPress={() => Linking.openURL(`tel:${primaryContact.phone}`).catch((e) => toast.error(errorMessage(e)))}
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
                Linking.openURL(`https://wa.me/91${primaryContact.phone!.replace(/\D/g, '').slice(-10)}`).catch((e) => toast.error(errorMessage(e)))
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

          <Button title="Share" variant="secondary" style={{ flex: 1, height: 48, borderRadius: 16 }} onPress={() => setShareWithLead(true)} />

          <Button
            title="Edit"
            disabled={!canEdit}
            style={{ flex: 1.2, height: 48, borderRadius: 16 }}
            onPress={() => router.push(`/inventory-edit?id=${id}` as any)}
          />
        </View>
      )}

      {/* 1-Tap Quick Assignee Selection Sheet */}
      <Sheet open={canAssign && reassignOpen} onClose={() => setReassignOpen(false)} title="Change Assignee">
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
      <Sheet open={shareExternally} onClose={() => setShareExternally(false)} title="Share property">
        {item && shareExternally && (
          <>
            {!!shareablePropertyPhotoUrls(item.photoUrls).length && <SharePhotoFilesButton urls={item.photoUrls ?? []} caption={clientPropertyShare(item)} />}
            {!!item.photoUrls?.length && (
              <Button
                title="Share details and gallery link"
                variant="secondary"
                loading={gallery.isFetching}
                disabled={!gallery.data}
                onPress={() =>
                  gallery.data &&
                  void Share.share({ message: propertyGalleryDraft(clientPropertyShare(item), gallery.data.url) }).catch((error) =>
                    toast.error(errorMessage(error)),
                  )
                }
              />
            )}
            <Button
              title="Share details only"
              variant="ghost"
              onPress={() => void Share.share({ message: clientPropertyShare(item) }).catch((error) => toast.error(errorMessage(error)))}
            />
          </>
        )}
      </Sheet>
      <Sheet open={shareWithLead} onClose={() => setShareWithLead(false)} title="Share with CRM lead">
        {shareWithLead && item && <InventoryLeadShare inventoryId={item.id} message={clientPropertyShare(item)} photoUrls={item.photoUrls} />}
      </Sheet>
      <Sheet open={matchLeadsOpen} onClose={() => setMatchLeadsOpen(false)} title="Matching Buyer Leads">
        <View style={{ gap: 14, paddingBottom: 20 }}>
          <Txt color="muted">
            {item?.matchingLeadsCount
              ? `Found ${item.matchingLeadsCount} active leads looking for ${item.bhk ? `${item.bhk} BHK` : 'property'} within this budget.`
              : 'Open Leads to review clients before sharing this property. An automatic match count is not available here.'}
          </Txt>

          <Button
            title="Open Leads Manager"
            onPress={() => {
              setMatchLeadsOpen(false);
              router.push('/(broker)/leads');
            }}
          />

          <Button
            title="Prepare property in CRM Inbox"
            variant="secondary"
            onPress={() => {
              setMatchLeadsOpen(false);
              setShareWithLead(true);
            }}
          />
        </View>
      </Sheet>
    </BrokerScreen>
  );
}

function PropertyNavigationActions({ item }: { item: LedgerItem }) {
  const { route, exact, sectorMap } = inventoryNavigation(item);
  function open(url: string) {
    void Linking.openURL(url).catch(() => toast.error('Unable to open the maps link'));
  }
  return (
    <View style={{ gap: 10 }}>
      {route && <Button title={exact ? 'Navigate to property' : 'Directions from recorded address'} onPress={() => open(route)} />}
      {sectorMap && <Button title="ABC Buildcon sector map" variant="secondary" onPress={() => open(sectorMap)} />}
      {!route && <Txt color="muted">Add a Maps link or property address for door-to-door directions.</Txt>}
    </View>
  );
}

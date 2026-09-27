import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { ParsedListing } from '../../utils/listingParser';

interface EditableListingCardProps {
  listing: ParsedListing;
  onUpdate: (updated: ParsedListing) => void;
  onDelete: (id: string) => void;
  onImportCRM?: (listing: ParsedListing) => void;
  onPublishDirectory?: (listing: ParsedListing) => void;
  isImported?: boolean;
  isPublished?: boolean;
}

export const EditableListingCard: React.FC<EditableListingCardProps> = ({
  listing,
  onUpdate,
  onDelete,
  onImportCRM,
  onPublishDirectory,
  isImported = false,
  isPublished = false,
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Editable Form State
  const [editSector, setEditSector] = useState(listing.sector);
  const [editProject, setEditProject] = useState(listing.project);
  const [editUnit, setEditUnit] = useState(listing.unitNumber);
  const [editArea, setEditArea] = useState(String(listing.carpetAreaSqFt));
  const [editFloor, setEditFloor] = useState(listing.floor);
  const [editStatus, setEditStatus] = useState(listing.status);
  const [editTenancy, setEditTenancy] = useState(listing.tenancy);
  const [editContactName, setEditContactName] = useState(listing.contactName);
  const [editContactPhone, setEditContactPhone] = useState(listing.cleanPhone || listing.contactPhone);
  const [editPriceDisplay, setEditPriceDisplay] = useState(listing.priceDisplay);

  const handleCall = () => {
    const phone = listing.cleanPhone || listing.contactPhone.replace(/\D/g, '');
    if (!phone) {
      Alert.alert('Phone Unavailable', 'No phone number available for this listing.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Dialer Error', `Could not open phone dialer for ${phone}`);
    });
  };

  const handleWhatsApp = () => {
    const phone = listing.cleanPhone || listing.contactPhone.replace(/\D/g, '');
    if (!phone) {
      Alert.alert('Phone Unavailable', 'No phone number available for WhatsApp.');
      return;
    }
    const message = `Hi ${listing.contactName || 'Partner'}, regarding unit ${listing.unitNumber} at ${listing.project} (${listing.sector}) from the commercial register. Please share current terms and client inspection availability.`;
    const url = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('WhatsApp Error', 'Could not open WhatsApp application.');
    });
  };

  const handleSaveEdits = () => {
    const cleanNum = editContactPhone.replace(/\D/g, '');
    const areaNum = parseInt(editArea, 10) || listing.carpetAreaSqFt;

    const validationErrors: string[] = [];
    if (cleanNum.length !== 10) {
      validationErrors.push('Owner contact phone must be a 10-digit number');
    }
    if (!editUnit.trim()) {
      validationErrors.push('Unit number cannot be empty');
    }
    if (areaNum < 50 || areaNum > 50000) {
      validationErrors.push(`Area ${areaNum} sq.ft is outside standard range`);
    }

    const updated: ParsedListing = {
      ...listing,
      sector: editSector.trim() || listing.sector,
      project: editProject.trim() || listing.project,
      unitNumber: editUnit.trim() || listing.unitNumber,
      carpetAreaSqFt: areaNum,
      floor: editFloor.trim() || listing.floor,
      status: editStatus.trim() || listing.status,
      tenancy: editTenancy.trim() || listing.tenancy,
      contactName: editContactName.trim() || listing.contactName,
      contactPhone: cleanNum || editContactPhone,
      cleanPhone: cleanNum,
      priceDisplay: editPriceDisplay.trim() || listing.priceDisplay,
      confidenceScore: validationErrors.length === 0 ? 98 : 75,
      confidence: validationErrors.length === 0 ? 'HIGH' : 'MEDIUM',
      validationErrors,
    };

    onUpdate(updated);
    setIsEditing(false);
  };

  const handleCancelEdits = () => {
    setEditSector(listing.sector);
    setEditProject(listing.project);
    setEditUnit(listing.unitNumber);
    setEditArea(String(listing.carpetAreaSqFt));
    setEditFloor(listing.floor);
    setEditStatus(listing.status);
    setEditTenancy(listing.tenancy);
    setEditContactName(listing.contactName);
    setEditContactPhone(listing.cleanPhone || listing.contactPhone);
    setEditPriceDisplay(listing.priceDisplay);
    setIsEditing(false);
  };

  const confidenceStyle =
    listing.confidence === 'HIGH'
      ? styles.confHigh
      : listing.confidence === 'MEDIUM'
      ? styles.confMed
      : styles.confLow;

  const confidenceTextStyle =
    listing.confidence === 'HIGH'
      ? styles.confTextHigh
      : listing.confidence === 'MEDIUM'
      ? styles.confTextMed
      : styles.confTextLow;

  return (
    <View style={styles.cardContainer}>
      {/* Top Header Row: Unit Badge, Category, Confidence Tag, Imported/Published Badges */}
      <View style={styles.headerRow}>
        <View style={styles.unitBadge}>
          <Text style={styles.unitBadgeText}>{listing.unitNumber}</Text>
        </View>

        <View style={styles.categoryPill}>
          <Text style={styles.categoryPillText}>{listing.category}</Text>
        </View>

        <View style={{ flex: 1 }} />

        {isImported && (
          <View style={styles.importedBadge}>
            <Text style={styles.importedBadgeText}>✓ CRM</Text>
          </View>
        )}

        {isPublished && (
          <View style={styles.publishedBadge}>
            <Text style={styles.publishedBadgeText}>✓ Directory</Text>
          </View>
        )}

        <View style={[styles.confidencePill, confidenceStyle]}>
          <Text style={[styles.confidenceText, confidenceTextStyle]}>
            {listing.confidenceScore}% {listing.confidence}
          </Text>
        </View>
      </View>

      {!isEditing ? (
        /* READ-ONLY VIEW MODE */
        <View style={styles.cardBody}>
          {/* Project Title & Sector */}
          <View style={styles.projectSection}>
            <Text style={styles.projectTitle}>{listing.project}</Text>
            <Text style={styles.sectorLocation}>{listing.sector}</Text>
          </View>

          {/* Key Specs Grid */}
          <View style={styles.specsGrid}>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>CARPET AREA</Text>
              <Text style={styles.specValue}>{listing.carpetAreaSqFt} sq.ft</Text>
            </View>
            <View style={styles.specDivider} />
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>FLOOR</Text>
              <Text style={styles.specValue} numberOfLines={1}>
                {listing.floorCode} {listing.attributes.length > 0 ? `• ${listing.attributes[0]}` : ''}
              </Text>
            </View>
            <View style={styles.specDivider} />
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>PRICE</Text>
              <Text style={styles.specPriceValue}>{listing.priceDisplay}</Text>
            </View>
          </View>

          {/* Tenancy & Status Box */}
          <View style={styles.tenancyBox}>
            <View style={styles.statusDotRow}>
              <View
                style={[
                  styles.tenancyDot,
                  listing.status === 'Furnished Rented'
                    ? styles.tenancyDotRented
                    : styles.tenancyDotReady,
                ]}
              />
              <Text style={styles.statusTitle}>{listing.status}</Text>
              {listing.rentalYieldPct && (
                <View style={styles.yieldPill}>
                  <Text style={styles.yieldText}>{listing.rentalYieldPct}% ROI</Text>
                </View>
              )}
            </View>
            <Text style={styles.tenancyDetail} numberOfLines={2}>
              {listing.tenancy}
            </Text>
          </View>

          {/* Owner / Contact Row */}
          <View style={styles.contactRow}>
            <View style={styles.contactInfo}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
                  stroke="#64748B"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <Circle cx="12" cy="7" r="4" stroke="#64748B" strokeWidth="2" />
              </Svg>
              <Text style={styles.contactName}>{listing.contactName}</Text>
              <Text style={styles.contactPhone}>{listing.cleanPhone || listing.contactPhone}</Text>
            </View>

            {/* Direct Outreach Buttons */}
            <View style={styles.outreachButtons}>
              <TouchableOpacity
                style={styles.callButton}
                onPress={handleCall}
                activeOpacity={0.8}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"
                    stroke="#0D9488"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={styles.callButtonText}>Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.waButton}
                onPress={handleWhatsApp}
                activeOpacity={0.8}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
                    stroke="#16A34A"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={styles.waButtonText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Validation Errors Alert Box */}
          {listing.validationErrors && listing.validationErrors.length > 0 && (
            <View style={styles.validationBox}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="10" stroke="#D97706" strokeWidth="2" />
                <Path d="M12 8v4M12 16h.01" stroke="#D97706" strokeWidth="2" strokeLinecap="round" />
              </Svg>
              <View style={{ flex: 1, marginLeft: 6 }}>
                {listing.validationErrors.map((err, idx) => (
                  <Text key={idx} style={styles.validationText}>
                    • {err}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* Action Row: Edit, Import, Publish, Discard */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.editActionBtn}
              onPress={() => setIsEditing(true)}
              activeOpacity={0.7}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                  stroke="#0F766E"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <Path
                  d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                  stroke="#0F766E"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </Svg>
              <Text style={styles.editActionText}>Edit</Text>
            </TouchableOpacity>

            {onImportCRM && (
              <TouchableOpacity
                style={[
                  styles.importActionBtn,
                  isImported && styles.importActionBtnDisabled,
                ]}
                onPress={() => onImportCRM(listing)}
                activeOpacity={0.7}
                disabled={isImported}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 4v12M8 12l4 4 4-4M4 20h16"
                    stroke={isImported ? '#94A3B8' : '#0D9488'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text
                  style={[
                    styles.importActionText,
                    isImported && styles.importActionTextDisabled,
                  ]}
                >
                  {isImported ? 'Imported' : 'Import to CRM'}
                </Text>
              </TouchableOpacity>
            )}

            {onPublishDirectory && (
              <TouchableOpacity
                style={[
                  styles.publishActionBtn,
                  isPublished && styles.publishActionBtnDisabled,
                ]}
                onPress={() => onPublishDirectory(listing)}
                activeOpacity={0.7}
                disabled={isPublished}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    stroke={isPublished ? '#94A3B8' : '#475569'}
                    strokeWidth="2"
                  />
                </Svg>
                <Text
                  style={[
                    styles.publishActionText,
                    isPublished && styles.publishActionTextDisabled,
                  ]}
                >
                  {isPublished ? 'Published' : 'Publish'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.deleteActionBtn}
              onPress={() => onDelete(listing.id)}
              activeOpacity={0.7}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  stroke="#EF4444"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* INLINE EDIT MODE */
        <View style={styles.editFormContainer}>
          <Text style={styles.editSectionTitle}>Edit Extracted Listing Record</Text>

          <View style={styles.formRow}>
            <View style={styles.formFieldHalf}>
              <Text style={styles.inputLabel}>Unit / Shop #</Text>
              <TextInput
                style={styles.textInput}
                value={editUnit}
                onChangeText={setEditUnit}
                placeholder="e.g. G80, SCO-309"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={styles.formFieldHalf}>
              <Text style={styles.inputLabel}>Carpet Area (sq.ft)</Text>
              <TextInput
                style={styles.textInput}
                value={editArea}
                onChangeText={setEditArea}
                keyboardType="numeric"
                placeholder="e.g. 449"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formFieldHalf}>
              <Text style={styles.inputLabel}>Project / Complex</Text>
              <TextInput
                style={styles.textInput}
                value={editProject}
                onChangeText={setEditProject}
                placeholder="e.g. SS Omnia"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={styles.formFieldHalf}>
              <Text style={styles.inputLabel}>Sector / Location</Text>
              <TextInput
                style={styles.textInput}
                value={editSector}
                onChangeText={setEditSector}
                placeholder="e.g. Sector 86"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formFieldHalf}>
              <Text style={styles.inputLabel}>Floor & Spec</Text>
              <TextInput
                style={styles.textInput}
                value={editFloor}
                onChangeText={setEditFloor}
                placeholder="e.g. Ground Floor (GF)"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={styles.formFieldHalf}>
              <Text style={styles.inputLabel}>Asking Price</Text>
              <TextInput
                style={styles.textInput}
                value={editPriceDisplay}
                onChangeText={setEditPriceDisplay}
                placeholder="e.g. ₹ 65.0 Lakh"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formFieldHalf}>
              <Text style={styles.inputLabel}>Contact Name</Text>
              <TextInput
                style={styles.textInput}
                value={editContactName}
                onChangeText={setEditContactName}
                placeholder="Owner / Broker Name"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={styles.formFieldHalf}>
              <Text style={styles.inputLabel}>Phone (10 Digits)</Text>
              <TextInput
                style={styles.textInput}
                value={editContactPhone}
                onChangeText={setEditContactPhone}
                keyboardType="phone-pad"
                placeholder="9899248292"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View style={styles.formFieldFull}>
            <Text style={styles.inputLabel}>Status & Tenancy Terms</Text>
            <TextInput
              style={styles.textInput}
              value={editTenancy}
              onChangeText={setEditTenancy}
              placeholder="e.g. Rented @ ₹115/sq.ft to Cafe Coffee Day"
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Form Action Buttons */}
          <View style={styles.formButtonsRow}>
            <TouchableOpacity
              style={styles.saveEditBtn}
              onPress={handleSaveEdits}
              activeOpacity={0.8}
            >
              <Text style={styles.saveEditBtnText}>Save Changes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelEditBtn}
              onPress={handleCancelEdits}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelEditBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  unitBadge: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unitBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  categoryPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  importedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  importedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  publishedBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#7DD3FC',
  },
  publishedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0369A1',
  },
  confidencePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  confHigh: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  confMed: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  confLow: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '700',
  },
  confTextHigh: {
    color: '#15803D',
  },
  confTextMed: {
    color: '#B45309',
  },
  confTextLow: {
    color: '#B91C1C',
  },
  cardBody: {
    padding: 14,
  },
  projectSection: {
    marginBottom: 10,
  },
  projectTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectorLocation: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  specsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  specItem: {
    flex: 1,
    alignItems: 'center',
  },
  specDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  specLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  specValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  specPriceValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0D9488',
  },
  tenancyBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  tenancyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tenancyDotReady: {
    backgroundColor: '#0D9488',
  },
  tenancyDotRented: {
    backgroundColor: '#16A34A',
  },
  statusTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
  },
  yieldPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  yieldText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  tenancyDetail: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 15,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  contactPhone: {
    fontSize: 11,
    color: '#64748B',
  },
  outreachButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  callButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0D9488',
  },
  waButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  waButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  validationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderRadius: 6,
    padding: 8,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  validationText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#B45309',
    lineHeight: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 10,
    gap: 8,
  },
  editActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    gap: 4,
  },
  editActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  importActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#CCFBF1',
    borderWidth: 1,
    borderColor: '#99F6E4',
    gap: 4,
  },
  importActionBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  importActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D9488',
  },
  importActionTextDisabled: {
    color: '#94A3B8',
  },
  publishActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 4,
  },
  publishActionBtnDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  publishActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  publishActionTextDisabled: {
    color: '#94A3B8',
  },
  deleteActionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  editFormContainer: {
    padding: 14,
  },
  editSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  formRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  formFieldHalf: {
    flex: 1,
  },
  formFieldFull: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0F172A',
  },
  formButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  saveEditBtn: {
    flex: 1,
    backgroundColor: '#0D9488',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveEditBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cancelEditBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelEditBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
});

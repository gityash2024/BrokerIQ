import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { SectorData } from '../../data/gurgaonCatalog';

interface SectorHighlightCardProps {
  sector: SectorData;
}

export const SectorHighlightCard: React.FC<SectorHighlightCardProps> = ({ sector }) => {
  return (
    <View style={styles.cardContainer}>
      {/* Top Banner & Sector Info */}
      <View style={styles.topRow}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={styles.nameRow}>
            <View style={styles.sectorPin}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                  stroke="#0D9488"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Circle cx="12" cy="9" r="2.5" fill="#0D9488" />
              </Svg>
            </View>
            <Text style={styles.sectorName} numberOfLines={1}>
              {sector.name}
            </Text>
          </View>
          <Text style={styles.subCorridor}>{sector.subCorridor}</Text>
        </View>

        <View style={styles.highlightBadge}>
          <Text style={styles.highlightBadgeText}>{sector.highlightBadge}</Text>
        </View>
      </View>

      {/* Financial Intelligence Bar */}
      <View style={styles.financialStatsBar}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>AVG RATE</Text>
          <Text style={styles.statValuePrimary}>{sector.financialMetrics.avgRateDisplay}</Text>
          <Text style={styles.statSubText}>{sector.financialMetrics.growthYoY}</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statCol}>
          <Text style={styles.statLabel}>RENTAL YIELD</Text>
          <Text style={styles.statValueSuccess}>{sector.financialMetrics.rentalYieldDisplay}</Text>
          <Text style={styles.statSubText}>High Yield Hub</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statCol}>
          <Text style={styles.statLabel}>ACTIVE UNITS</Text>
          <Text style={styles.statValueNeutral}>{sector.financialMetrics.activeUnitsCount} Units</Text>
          <Text style={styles.statSubText}>Catalog verified</Text>
        </View>
      </View>

      {/* Infrastructure Anchors Section */}
      <View style={styles.infraSection}>
        <View style={styles.infraSectionHeader}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
              stroke="#0D9488"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.infraSectionTitle}>Infrastructure & Catchment Anchors</Text>
        </View>

        {/* Connectivity Chips */}
        <View style={styles.chipsWrap}>
          {sector.infrastructureAnchors.connectivity.map((conn, idx) => (
            <View key={`conn-${idx}`} style={styles.infraChipConnectivity}>
              <View style={styles.chipDotExpress} />
              <Text style={styles.infraChipText}>
                {conn.name} <Text style={styles.infraChipDistance}>({conn.distance})</Text>
              </Text>
            </View>
          ))}

          {/* Social & Commercial Chips */}
          {sector.infrastructureAnchors.socialCommercial.map((anchor, idx) => (
            <View key={`anchor-${idx}`} style={styles.infraChipAnchor}>
              <View style={styles.chipDotSocial} />
              <Text style={styles.infraChipText}>
                {anchor.name} <Text style={styles.infraChipDistance}>({anchor.distance})</Text>
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Marquee Commercial Projects */}
      <View style={styles.marqueeRow}>
        <Text style={styles.marqueeLabel}>MARQUEE HUBS:</Text>
        <Text style={styles.marqueeList}>
          {sector.keyProjects.join(' • ')}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectorPin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectorName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  subCorridor: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
    marginLeft: 28,
  },
  highlightBadge: {
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  highlightBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
  },
  financialStatsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 14,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statValuePrimary: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D9488',
  },
  statValueSuccess: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  statValueNeutral: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  statSubText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  infraSection: {
    marginBottom: 10,
  },
  infraSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  infraSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  infraChipConnectivity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infraChipAnchor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipDotExpress: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0D9488',
  },
  chipDotSocial: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6366F1',
  },
  infraChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  infraChipDistance: {
    fontWeight: '700',
    color: '#0D9488',
  },
  marqueeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 6,
  },
  marqueeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  marqueeList: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
});

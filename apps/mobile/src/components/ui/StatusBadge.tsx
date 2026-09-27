import React from 'react';
import { View, Text } from 'react-native';

type StatusBadgeProps = {
  status: string;
  size?: 'sm' | 'md';
};

export const StatusBadge = ({ status, size = 'sm' }: StatusBadgeProps) => {
  const norm = (status || '').toUpperCase().replace('-', '_');

  let bg = '#F1F5F9';
  let text = '#475569';
  let dot = '#94A3B8';
  let label = status;

  if (norm === 'NEW') {
    bg = '#EFF6FF';
    text = '#1D4ED8';
    dot = '#3B82F6';
    label = 'NEW';
  } else if (norm === 'CONTACTED') {
    bg = '#F0FDFA';
    text = '#0F766E';
    dot = '#0D9488';
    label = 'CONTACTED';
  } else if (norm === 'SITE_VISIT' || norm === 'SITEVISIT') {
    bg = '#FDF4FF';
    text = '#86198F';
    dot = '#C026D3';
    label = 'SITE VISIT';
  } else if (norm === 'NEGOTIATION') {
    bg = '#FEF3C7';
    text = '#B45309';
    dot = '#F59E0B';
    label = 'NEGOTIATION';
  } else if (norm === 'WON' || norm === 'CLOSED') {
    bg = '#DCFCE7';
    text = '#15803D';
    dot = '#22C55E';
    label = 'DEAL WON';
  } else if (norm === 'LOST') {
    bg = '#FEE2E2';
    text = '#B91C1C';
    dot = '#EF4444';
    label = 'LOST';
  } else if (norm === 'HOT') {
    bg = '#FEF2F2';
    text = '#DC2626';
    dot = '#EF4444';
    label = '🔥 HOT';
  } else if (norm === 'WARM') {
    bg = '#FFFBEB';
    text = '#D97706';
    dot = '#F59E0B';
    label = '⚡ WARM';
  } else if (norm === 'COLD') {
    bg = '#F8FAFC';
    text = '#64748B';
    dot = '#94A3B8';
    label = 'COLD';
  }

  const isSmall = size === 'sm';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: bg,
        paddingHorizontal: isSmall ? 8 : 10,
        paddingVertical: isSmall ? 3 : 5,
        borderRadius: 9999,
        alignSelf: 'flex-start',
      }}
    >
      <View
        style={{
          width: isSmall ? 6 : 7,
          height: isSmall ? 6 : 7,
          borderRadius: 4,
          backgroundColor: dot,
          marginRight: 5,
        }}
      />
      <Text
        style={{
          fontSize: isSmall ? 10 : 12,
          fontWeight: '700',
          color: text,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </View>
  );
};
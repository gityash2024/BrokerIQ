import React from 'react';
import { View, Text } from 'react-native';

export interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: string;
  accentColor?: string;
  subtitle?: string;
}

export const MetricCard = ({
  label,
  value,
  trend,
  accentColor = '#0D9488',
  subtitle,
}: MetricCardProps) => (
  <View
    style={{
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: '#E2E8F0',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
      marginBottom: 12,
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: accentColor,
      }}
    />
    <Text
      style={{
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
        letterSpacing: 0.2,
      }}
      numberOfLines={1}
    >
      {label}
    </Text>
    <Text
      style={{
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
        marginTop: 6,
        letterSpacing: -0.5,
      }}
    >
      {value}
    </Text>
    {(trend || subtitle) && (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 6,
        }}
      >
        {trend && (
          <View
            style={{
              backgroundColor: '#DCFCE7',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 6,
              marginRight: 6,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: '#15803D',
              }}
            >
              {trend}
            </Text>
          </View>
        )}
        {subtitle && (
          <Text
            style={{
              fontSize: 11,
              color: '#94A3B8',
            }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
    )}
  </View>
);
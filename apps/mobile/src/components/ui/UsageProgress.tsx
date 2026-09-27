import React from 'react';
import { View, Text } from 'react-native';

export const UsageProgress = ({ label, used, max }: any) => {
  const percentage = Math.min((used / max) * 100, 100);
  return (
    <View className="mb-4">
      <View className="flex-row justify-between mb-1">
        <Text className="text-sm font-medium text-text">{label}</Text>
        <Text className="text-sm text-text-secondary">{used} / {max}</Text>
      </View>
      <View className="h-2 bg-gray-200 rounded-full w-full overflow-hidden">
        <View className="h-full bg-primary" style={{ width: `${percentage}%` }} />
      </View>
    </View>
  );
};
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export const Select = ({ label, value, onPress }: any) => (
  <View className="mb-4">
    {label && <Text className="text-sm text-text font-medium mb-1">{label}</Text>}
    <TouchableOpacity onPress={onPress} className="border border-border rounded-lg p-3 bg-surface">
      <Text className={value ? "text-text" : "text-gray-400"}>{value || 'Select...'}</Text>
    </TouchableOpacity>
  </View>
);
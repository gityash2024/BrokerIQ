import React from 'react';
import { TextInput, View, Text } from 'react-native';

export const Input = ({ label, error, ...props }: any) => (
  <View className="mb-4">
    {label && <Text className="text-sm text-text font-medium mb-1">{label}</Text>}
    <TextInput className={`border rounded-lg p-3 text-text bg-surface ${error ? 'border-error' : 'border-border'}`} placeholderTextColor="#9CA3AF" {...props} />
    {error && <Text className="text-xs text-error mt-1">{error}</Text>}
  </View>
);
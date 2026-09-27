import React from 'react';
import { View, Text } from 'react-native';

export const Timeline = ({ items }: any) => (
  <View className="pl-4">
    {items.map((item: any, i: number) => (
      <View key={i} className="flex-row mb-4">
        <View className="w-2 h-2 rounded-full bg-primary mt-1.5 mr-3" />
        <View>
          <Text className="text-sm font-medium text-text">{item.title}</Text>
          <Text className="text-xs text-text-secondary">{item.date}</Text>
        </View>
      </View>
    ))}
  </View>
);
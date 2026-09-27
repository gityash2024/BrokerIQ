import React from 'react';
import { View, Text } from 'react-native';
import { Button } from './Button';

export const EmptyState = ({ title, description, action }: any) => (
  <View className="flex-1 items-center justify-center p-6">
    <Text className="text-xl font-bold text-text mb-2 text-center">{title}</Text>
    <Text className="text-sm text-text-secondary text-center mb-6">{description}</Text>
    {action && <Button title={action.label} onPress={action.onPress} />}
  </View>
);
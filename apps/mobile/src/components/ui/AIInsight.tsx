import React from 'react';
import { View, Text } from 'react-native';
import { Card } from './Card';
import { Button } from './Button';

export const AIInsight = ({ suggestion }: any) => (
  <Card>
    <Text className="text-sm font-bold text-primary mb-2">✨ AI Suggestion</Text>
    <Text className="text-sm text-text mb-4">{suggestion}</Text>
    <View className="flex-row justify-end space-x-2">
      <Button variant="outline" title="Reject" />
      <Button title="Accept" />
    </View>
  </Card>
);
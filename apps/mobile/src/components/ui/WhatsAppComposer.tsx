import React from 'react';
import { View, TextInput, Text } from 'react-native';

export const WhatsAppComposer = () => (
  <View className="flex-row items-center p-3 border-t border-border bg-surface">
    <TextInput className="flex-1 bg-gray-100 rounded-full px-4 py-2 mr-2" placeholder="Message..." />
    <Text className="text-primary font-bold">Send</Text>
  </View>
);
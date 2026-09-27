import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

export const IconButton = ({ icon, onPress }: any) => (
  <TouchableOpacity onPress={onPress} className="p-2 rounded-full bg-gray-100 items-center justify-center">
    <Text>{icon}</Text>
  </TouchableOpacity>
);
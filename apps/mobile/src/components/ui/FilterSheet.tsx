import React from 'react';
import { View, Text } from 'react-native';
import { BottomSheet } from './BottomSheet';

export const FilterSheet = (props: any) => (
  <BottomSheet {...props}>
    <Text className="text-xl font-bold mb-4">Filters</Text>
  </BottomSheet>
);
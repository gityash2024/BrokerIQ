import React from 'react';
import { TextInput, View } from 'react-native';

export const Search = ({ placeholder, onChangeText }: any) => (
  <View className="px-4 py-2">
    <TextInput className="bg-gray-100 rounded-lg p-3 text-text" placeholder={placeholder || "Search..."} onChangeText={onChangeText} />
  </View>
);
import React from 'react';
import { SafeAreaView, ScrollView, View } from 'react-native';

export const Screen = ({ children, scroll = false }: any) => {
  const Content = scroll ? ScrollView : View;
  return (
    <SafeAreaView className="flex-1 bg-background">
      <Content className="flex-1 p-4">{children}</Content>
    </SafeAreaView>
  );
};
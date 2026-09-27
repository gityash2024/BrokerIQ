import React from 'react';
import { View, Text } from 'react-native';
import { Card } from './Card';

export const SubscriptionCard = ({ plan, status, renewal }: any) => (
  <Card>
    <Text className="text-lg font-bold text-text">{plan} Plan</Text>
    <Text className="text-sm text-text-secondary mt-1">Status: {status}</Text>
    <Text className="text-sm text-text-secondary">Renews: {renewal}</Text>
  </Card>
);
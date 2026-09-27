import React from 'react';
import { View, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export const Card = ({ children, onPress }: { children: React.ReactNode, onPress?: () => void }) => {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style} className="bg-surface rounded-xl shadow-sm p-4 border border-border my-2" onTouchStart={() => onPress && (scale.value = withSpring(0.98))} onTouchEnd={() => onPress && (scale.value = withSpring(1))}>
      {children}
    </Animated.View>
  );
};
import React from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, withRepeat, withTiming, useSharedValue } from 'react-native-reanimated';

export const Skeleton = ({ className }: { className?: string }) => {
  const opacity = useSharedValue(0.5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { opacity.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true); }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={style} className={`bg-gray-200 rounded-md ${className}`} />;
};
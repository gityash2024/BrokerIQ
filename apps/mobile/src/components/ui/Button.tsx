import React from 'react';
import { Text, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  isLoading?: boolean;
}

export const Button = ({ title, onPress, variant = 'primary', isLoading }: ButtonProps) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => { scale.value = withSpring(0.97); };
  const handlePressOut = () => { scale.value = withSpring(1); };

  let bgClass = 'bg-primary';
  let textClass = 'text-white';
  if (variant === 'secondary') { bgClass = 'bg-gray-200'; textClass = 'text-gray-900'; }
  else if (variant === 'outline') { bgClass = 'bg-transparent border border-primary'; textClass = 'text-primary'; }
  else if (variant === 'ghost') { bgClass = 'bg-transparent'; textClass = 'text-primary'; }
  else if (variant === 'danger') { bgClass = 'bg-error'; textClass = 'text-white'; }

  return (
    <Animated.View style={animatedStyle} className="my-2">
      <Animated.Text onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress} className={`px-4 py-3 rounded-lg text-center font-semibold ${bgClass} ${textClass}`}>
        {isLoading ? <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? '#0D9488' : '#FFF'} /> : title}
      </Animated.Text>
    </Animated.View>
  );
};
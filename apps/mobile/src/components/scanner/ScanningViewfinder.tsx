import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ImageSourcePropType,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

interface ScanningViewfinderProps {
  isScanning: boolean;
  imageSource?: ImageSourcePropType | null;
  onScanComplete?: () => void;
  scanDurationMs?: number;
  height?: number;
  statusText?: string;
}

export const ScanningViewfinder: React.FC<ScanningViewfinderProps> = ({
  isScanning,
  imageSource,
  onScanComplete,
  scanDurationMs = 1800,
  height = 240,
  statusText,
}) => {
  const [frameHeight, setFrameHeight] = useState<number>(height);

  // Reanimated shared values
  const laserY = useSharedValue<number>(0);
  const laserOpacity = useSharedValue<number>(0);
  const radarScale = useSharedValue<number>(0.8);
  const radarOpacity = useSharedValue<number>(0);
  const bracketPulse = useSharedValue<number>(1);
  const auraHeight = useSharedValue<number>(30);

  const handleLayout = (e: LayoutChangeEvent) => {
    const layoutH = e.nativeEvent.layout.height;
    if (layoutH > 50 && layoutH !== frameHeight) {
      setFrameHeight(layoutH);
    }
  };

  useEffect(() => {
    if (isScanning) {
      // Trigger initial tactile feedback
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // Safe fallback for web or unsupported devices
      }

      // Laser vertical sweep animation: up and down
      laserOpacity.value = withTiming(1, { duration: 200 });
      laserY.value = withRepeat(
        withTiming(frameHeight - 12, {
          duration: 900,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      );

      // Trailing aura pulsation
      auraHeight.value = withRepeat(
        withSequence(
          withTiming(45, { duration: 450 }),
          withTiming(20, { duration: 450 })
        ),
        -1,
        true
      );

      // Radar pulse expansion
      radarOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 300 }),
          withTiming(0, { duration: 900 })
        ),
        -1,
        false
      );
      radarScale.value = withRepeat(
        withTiming(1.5, {
          duration: 1200,
          easing: Easing.out(Easing.ease),
        }),
        -1,
        false
      );

      // Corner bracket slight pulse
      bracketPulse.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 450 }),
          withTiming(1, { duration: 450 })
        ),
        -1,
        true
      );

      // Scan completion timer
      const timer = setTimeout(() => {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // ignore
        }

        // Smooth fade out
        laserOpacity.value = withTiming(0, { duration: 250 });
        radarOpacity.value = withTiming(0, { duration: 250 });

        if (onScanComplete) {
          onScanComplete();
        }
      }, scanDurationMs);

      return () => {
        clearTimeout(timer);
        cancelAnimation(laserY);
        cancelAnimation(laserOpacity);
        cancelAnimation(radarScale);
        cancelAnimation(radarOpacity);
        cancelAnimation(bracketPulse);
        cancelAnimation(auraHeight);
      };
    } else {
      laserOpacity.value = withTiming(0, { duration: 200 });
      radarOpacity.value = withTiming(0, { duration: 200 });
      cancelAnimation(laserY);
      cancelAnimation(radarScale);
      cancelAnimation(bracketPulse);
      cancelAnimation(auraHeight);
    }
  }, [isScanning, frameHeight, scanDurationMs, onScanComplete]);

  // Animated styles
  const animatedLaserStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: laserY.value }],
    opacity: laserOpacity.value,
  }));

  const animatedAuraStyle = useAnimatedStyle(() => ({
    height: auraHeight.value,
    opacity: laserOpacity.value * 0.45,
  }));

  const animatedRadarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: radarScale.value }],
    opacity: radarOpacity.value,
  }));

  const animatedBracketStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bracketPulse.value }],
  }));

  return (
    <View
      style={[styles.container, { minHeight: height }]}
      onLayout={handleLayout}
    >
      {/* Background Document / Register Image */}
      {imageSource ? (
        <View style={StyleSheet.absoluteFill}>
          <Image
            source={imageSource}
            style={styles.backgroundImage}
            resizeMode="cover"
          />
          <View style={styles.imageDarkOverlay} />
        </View>
      ) : (
        <View style={styles.emptyBackground}>
          <Svg width={44} height={44} viewBox="0 0 24 24" fill="none">
            <Rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="3"
              stroke="#64748B"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <Path
              d="M3 9h18M9 21V9"
              stroke="#64748B"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </Svg>
        </View>
      )}

      {/* Grid Alignment Reticle */}
      <View style={styles.gridOverlay} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Line x1="0" y1="33" x2="100" y2="33" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
          <Line x1="0" y1="66" x2="100" y2="66" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
          <Line x1="33" y1="0" x2="33" y2="100" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
          <Line x1="66" y1="0" x2="66" y2="100" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
        </Svg>
      </View>

      {/* Radar Sweep Animated Ring */}
      <Animated.View
        style={[styles.radarRing, animatedRadarStyle]}
        pointerEvents="none"
      />

      {/* Center Target Crosshair */}
      <View style={styles.centerTarget} pointerEvents="none">
        <Svg width={36} height={36} viewBox="0 0 36 36" fill="none">
          <Circle
            cx="18"
            cy="18"
            r="12"
            stroke={isScanning ? '#10B981' : 'rgba(255,255,255,0.3)'}
            strokeWidth="1.5"
            strokeDasharray={isScanning ? '2 3' : undefined}
          />
          <Line
            x1="18"
            y1="2"
            x2="18"
            y2="10"
            stroke={isScanning ? '#10B981' : 'rgba(255,255,255,0.4)'}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <Line
            x1="18"
            y1="26"
            x2="18"
            y2="34"
            stroke={isScanning ? '#10B981' : 'rgba(255,255,255,0.4)'}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <Line
            x1="2"
            y1="18"
            x2="10"
            y2="18"
            stroke={isScanning ? '#10B981' : 'rgba(255,255,255,0.4)'}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <Line
            x1="26"
            y1="18"
            x2="34"
            y2="18"
            stroke={isScanning ? '#10B981' : 'rgba(255,255,255,0.4)'}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {isScanning && <Circle cx="18" cy="18" r="3" fill="#10B981" />}
        </Svg>
      </View>

      {/* Reanimated Vertical Laser Beam & Glowing Aura */}
      <Animated.View
        style={[styles.laserContainer, animatedLaserStyle]}
        pointerEvents="none"
      >
        <Animated.View style={[styles.laserAura, animatedAuraStyle]} />
        <View style={styles.laserBeam} />
        <View style={styles.laserCore} />
      </Animated.View>

      {/* Neon Viewfinder Corner Brackets */}
      <Animated.View
        style={[styles.cornerBracketWrapper, styles.bracketTopLeft, animatedBracketStyle]}
        pointerEvents="none"
      >
        <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
          <Path
            d="M4 28V6a2 2 0 012-2h22"
            stroke="#10B981"
            strokeWidth={3.5}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[styles.cornerBracketWrapper, styles.bracketTopRight, animatedBracketStyle]}
        pointerEvents="none"
      >
        <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
          <Path
            d="M28 28V6a2 2 0 00-2-2H4"
            stroke="#10B981"
            strokeWidth={3.5}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[styles.cornerBracketWrapper, styles.bracketBottomLeft, animatedBracketStyle]}
        pointerEvents="none"
      >
        <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
          <Path
            d="M4 4v22a2 2 0 002 2h22"
            stroke="#10B981"
            strokeWidth={3.5}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[styles.cornerBracketWrapper, styles.bracketBottomRight, animatedBracketStyle]}
        pointerEvents="none"
      >
        <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
          <Path
            d="M28 4v22a2 2 0 01-2 2H4"
            stroke="#10B981"
            strokeWidth={3.5}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      {/* Status Bar / Tag */}
      <View style={styles.statusBarContainer}>
        <View
          style={[
            styles.statusPill,
            isScanning ? styles.statusPillScanning : styles.statusPillIdle,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              isScanning ? styles.statusDotScanning : styles.statusDotIdle,
            ]}
          />
          <Text
            style={[
              styles.statusText,
              isScanning ? styles.statusTextScanning : styles.statusTextIdle,
            ]}
            numberOfLines={1}
          >
            {statusText ||
              (isScanning
                ? 'AI Neural Scanner: Analyzing Commercial Ledger...'
                : imageSource
                ? 'Register Page Loaded • Ready to Scan'
                : 'Align Physical Register within Brackets')}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  emptyBackground: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  imageDarkOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFill,
  },
  cornerBracketWrapper: {
    position: 'absolute',
    zIndex: 10,
  },
  bracketTopLeft: {
    top: 10,
    left: 10,
  },
  bracketTopRight: {
    top: 10,
    right: 10,
  },
  bracketBottomLeft: {
    bottom: 10,
    left: 10,
  },
  bracketBottomRight: {
    bottom: 10,
    right: 10,
  },
  centerTarget: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  radarRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    zIndex: 4,
  },
  laserContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 8,
  },
  laserAura: {
    width: '100%',
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(52, 211, 153, 0.6)',
  },
  laserBeam: {
    width: '100%',
    height: 3,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 10,
    elevation: 10,
  },
  laserCore: {
    position: 'absolute',
    top: 1,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#A7F3D0',
  },
  statusBarContainer: {
    position: 'absolute',
    bottom: 12,
    zIndex: 12,
    paddingHorizontal: 14,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
  },
  statusPillIdle: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  statusPillScanning: {
    backgroundColor: 'rgba(6, 78, 59, 0.9)',
    borderColor: '#10B981',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusDotIdle: {
    backgroundColor: '#94A3B8',
  },
  statusDotScanning: {
    backgroundColor: '#34D399',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  statusTextIdle: {
    color: '#E2E8F0',
  },
  statusTextScanning: {
    color: '#D1FAE5',
  },
});

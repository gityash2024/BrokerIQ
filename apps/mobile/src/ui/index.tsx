import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeInDown, FadeOutUp, SlideInDown, SlideOutDown, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, ChevronLeft, CircleCheck, Info, Inbox, Settings2, XCircle } from 'lucide-react-native';
import { initials } from '@brokeriq/shared';
import { ApiError, errorMessage, img } from '../lib/api';
import { fonts, palette, radius, useTheme } from '../lib/theme';
import { useToasts } from '../lib/toast';

// ------------------------------------------------------------------ Text
type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'bodyStrong' | 'small' | 'caption' | 'label';
const V: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  h1: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  h2: { fontFamily: fonts.displayBold, fontSize: 21, lineHeight: 27, letterSpacing: -0.2 },
  h3: { fontFamily: fonts.displayBold, fontSize: 17, lineHeight: 23 },
  title: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 21 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15 },
  label: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase' },
};
export function Txt({ v = 'body', color, style, ...p }: TextProps & { v?: Variant; color?: 'fg' | 'muted' | 'subtle' | 'brand' | 'white' | 'danger' | 'success' | 'accent' | string }) {
  const { c } = useTheme();
  const col = color === 'white' ? '#fff' : color && color in c ? (c as any)[color] : color ?? c.fg;
  return <Text {...p} style={[V[v], { color: col }, style]} />;
}

// ------------------------------------------------------------------ Layout
export function Screen({ children, scroll = true, refreshing, onRefresh, padded = true, edges = ['top'], style, contentStyle, keyboard }: { children: React.ReactNode; scroll?: boolean; refreshing?: boolean; onRefresh?: () => void; padded?: boolean; edges?: ('top' | 'bottom')[]; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>; keyboard?: boolean }) {
  const { c } = useTheme();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && { padding: 16, paddingBottom: 110 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.brand} colors={[c.brand]} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padded && { padding: 16 }, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: c.bg }, style]}>
      {keyboard ? <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{body}</KeyboardAvoidingView> : body}
    </SafeAreaView>
  );
}

export function Header({ title, subtitle, right, back = true }: { title?: string; subtitle?: string; right?: React.ReactNode; back?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.bg }}>
      {back && (
        <IconBtn onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <ChevronLeft size={24} color={c.fg} />
        </IconBtn>
      )}
      <View style={{ flex: 1, paddingHorizontal: back ? 0 : 4 }}>
        {!!title && <Txt v="h3" numberOfLines={1}>{title}</Txt>}
        {!!subtitle && <Txt v="small" color="muted" numberOfLines={1}>{subtitle}</Txt>}
      </View>
      {right}
    </View>
  );
}

export function Row({ children, gap = 8, style, wrap }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 24, marginBottom: 12, gap: 8 }}>
      <View style={{ flex: 1 }}>
        <Txt v="h2">{title}</Txt>
        {!!subtitle && <Txt v="small" color="muted">{subtitle}</Txt>}
      </View>
      {action}
    </View>
  );
}

// ------------------------------------------------------------------ Pressables
/**
 * For screens whose dark hero scrolls under a light-icon status bar: fades in a solid bar behind the
 * status icons once the hero has scrolled away, so content never collides with the clock/battery.
 * Usage: const scrim = useStatusScrim(); <Animated.ScrollView onScroll={scrim.onScroll} scrollEventThrottle={16}> … {scrim.view}
 */
export function useStatusScrim(color = '#1E1B4B', fadeFrom = 60) {
  const insets = useSafeAreaInsets();
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const style = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [fadeFrom, fadeFrom + 60], [0, 1], 'clamp') }));
  const view = <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: color }, style]} />;
  return { onScroll, view };
}

/** Style keys that size/position the element inside its parent — they must live on the Pressable itself. */
const OUTER_KEYS = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width', 'minWidth', 'maxWidth', 'alignSelf', 'position', 'top', 'left', 'right', 'bottom', 'zIndex', 'margin', 'marginHorizontal', 'marginVertical', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginStart', 'marginEnd'] as const;

function splitPressStyle(style: StyleProp<ViewStyle>) {
  const flat = { ...(StyleSheet.flatten(style) ?? {}) } as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  for (const k of OUTER_KEYS) {
    if (flat[k] !== undefined) {
      outer[k] = flat[k];
      delete flat[k];
    }
  }
  // A flex item's size comes from its parent row, so let the animated body fill it (equal-height rows).
  // Only for flex items: in unbounded containers (horizontal lists) flexGrow would collapse the body.
  if (outer.flex !== undefined || outer.flexGrow !== undefined) flat.flexGrow = 1;
  return { outer: outer as ViewStyle, inner: flat as ViewStyle };
}

export function PressableScale({ children, style, onPress, haptic = true, disabled, ...p }: PressableProps & { style?: StyleProp<ViewStyle>; haptic?: boolean; children: React.ReactNode }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const { outer, inner } = splitPressStyle(style);
  return (
    <Pressable
      {...p}
      style={outer}
      disabled={disabled}
      onPressIn={() => (s.value = withSpring(0.96, { damping: 20, stiffness: 400 }))}
      onPressOut={() => (s.value = withSpring(1, { damping: 15, stiffness: 300 }))}
      onPress={(e) => {
        if (haptic) Haptics.selectionAsync().catch(() => undefined);
        onPress?.(e);
      }}
    >
      <Animated.View style={[inner, a, disabled && { opacity: 0.5 }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function IconBtn({ children, onPress, style, badge }: { children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; badge?: number }) {
  const { c } = useTheme();
  return (
    <PressableScale onPress={onPress} style={[{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, style]} hitSlop={6}>
      {children}
      {!!badge && (
        <View style={{ position: 'absolute', top: 4, right: 4, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
          <Text style={{ color: '#fff', fontSize: 10, fontFamily: fonts.bold }}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </PressableScale>
  );
}

type BtnVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'success' | 'whatsapp' | 'dark';
export function Button({ title, onPress, variant = 'primary', size = 'md', loading, disabled, icon, style, full, color }: { color?: string; title?: string; onPress?: () => void; variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; disabled?: boolean; icon?: React.ReactNode; style?: StyleProp<ViewStyle>; full?: boolean }) {
  const { c } = useTheme();
  const bg = { primary: c.brand, accent: c.accent, secondary: c.surface, ghost: 'transparent', danger: c.danger, success: c.success, whatsapp: palette.whatsapp, dark: '#0F172A' }[variant];
  const fg = color ?? (variant === 'secondary' || variant === 'ghost' ? c.fg : variant === 'accent' ? '#111827' : '#fff');
  const h = { sm: 38, md: 48, lg: 56 }[size];
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        { height: h, borderRadius: size === 'lg' ? 18 : 14, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: size === 'sm' ? 14 : 20 },
        variant === 'secondary' && { borderWidth: 1, borderColor: c.line },
        variant === 'primary' && { shadowColor: c.brand, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
        full && { alignSelf: 'stretch' },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon}
      {!!title && <Text style={{ color: fg, fontFamily: fonts.bold, fontSize: size === 'sm' ? 13.5 : 15 }}>{title}</Text>}
    </PressableScale>
  );
}

// ------------------------------------------------------------------ Inputs
export function Input({ label, icon, error, hint, style, containerStyle, ...p }: TextInputProps & { label?: string; icon?: React.ReactNode; error?: string | null; hint?: string; containerStyle?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={containerStyle}>
      {!!label && <Txt v="caption" color="muted" style={{ marginBottom: 6, fontFamily: fonts.semibold, fontSize: 12.5 }}>{label}</Txt>}
      <View style={{ flexDirection: 'row', alignItems: p.multiline ? 'flex-start' : 'center', borderWidth: 1.5, borderColor: error ? c.danger : focus ? c.brand : c.line, borderRadius: 14, backgroundColor: c.surface, paddingHorizontal: 14, minHeight: 50 }}>
        {icon && <View style={{ marginRight: 10, marginTop: p.multiline ? 14 : 0 }}>{icon}</View>}
        <TextInput
          placeholderTextColor={c.subtle}
          {...p}
          onFocus={(e) => (setFocus(true), p.onFocus?.(e))}
          onBlur={(e) => (setFocus(false), p.onBlur?.(e))}
          style={[{ flex: 1, color: c.fg, fontFamily: fonts.body, fontSize: 15, paddingVertical: 12 }, p.multiline && { minHeight: 96, textAlignVertical: 'top' }, style]}
        />
      </View>
      {!!(error || hint) && <Txt v="caption" color={error ? 'danger' : 'subtle'} style={{ marginTop: 5 }}>{error || hint}</Txt>}
    </View>
  );
}

export function Chip({ label, active, onPress, icon, color }: { label: string; active?: boolean; onPress?: () => void; icon?: React.ReactNode; color?: string }) {
  const { c } = useTheme();
  return (
    <PressableScale onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 999, borderWidth: 1.5, borderColor: active ? color ?? c.brand : c.line, backgroundColor: active ? (color ? `${color}22` : c.brandSoft) : c.surface }}>
      {icon}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: active ? color ?? c.brand : c.muted }}>{label}</Text>
    </PressableScale>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ flexGrow: 1, gap: 6, padding: 4, backgroundColor: c.surface2, borderRadius: 16 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale key={o.value} onPress={() => onChange(o.value)} style={{ flexGrow: 1, paddingHorizontal: 14, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: on ? c.surface : 'transparent', shadowColor: '#000', shadowOpacity: on ? 0.06 : 0, shadowRadius: 6, elevation: on ? 1 : 0 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: on ? c.fg : c.muted }}>{o.label}</Text>
            {!!o.count && <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: c.brand }}>{o.count}</Text>}
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

// ------------------------------------------------------------------ Display
export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { c, isDark } = useTheme();
  const s: StyleProp<ViewStyle> = [{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, shadowColor: '#0F172A', shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: isDark ? 0 : 1 }, style];
  return onPress ? <PressableScale onPress={onPress} style={s}>{children}</PressableScale> : <View style={s}>{children}</View>;
}

export function Badge({ label, color, icon, solid }: { label: string; color?: string; icon?: React.ReactNode; solid?: boolean }) {
  const { c } = useTheme();
  const col = color ?? c.muted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: solid ? col : `${col}1f` }}>
      {icon}
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: solid ? '#fff' : col }}>{label}</Text>
    </View>
  );
}

const AV = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#E11D48', '#8B5CF6', '#14B8A6'];
export function Avatar({ name, uri, size = 40 }: { name?: string | null; uri?: string | null; size?: number }) {
  const bg = AV[[...(name ?? '?')].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV.length];
  if (uri) return <Image source={{ uri: img(uri, size * 3) }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" transition={200} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: size * 0.38 }}>{initials(name ?? '?')}</Text>
    </View>
  );
}

export function Skeleton({ h = 16, w = '100%', r = 10, style }: { h?: number; w?: number | `${number}%`; r?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const o = useSharedValue(0.5);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height: h, width: w, borderRadius: r, backgroundColor: c.surface2 }, a, style]} />;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: c.line, marginVertical: 12 }, style]} />;
}

export function Empty({ title, text, icon, action }: { title: string; text?: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 8 }}>
      <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>{icon ?? <Inbox size={28} color={c.brand} />}</View>
      {/* alignSelf: stretch — Android under-measures centred Devanagari and clips the last word otherwise */}
      <Txt v="h3" style={{ textAlign: 'center', alignSelf: 'stretch' }}>{title}</Txt>
      {!!text && <Txt v="small" color="muted" style={{ textAlign: 'center', alignSelf: 'stretch' }}>{text}</Txt>}
      {action && <View style={{ marginTop: 10 }}>{action}</View>}
    </Animated.View>
  );
}

/** Error block — "integration not configured" errors explain which admin/broker setting is missing. */
export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { c } = useTheme();
  const nc = error instanceof ApiError && error.isNotConfigured ? error.body : null;
  return (
    <View style={{ margin: 16, padding: 16, borderRadius: 18, backgroundColor: nc ? `${c.warning}18` : `${c.danger}14`, borderWidth: 1, borderColor: nc ? `${c.warning}55` : `${c.danger}44`, gap: 8 }}>
      <Row>
        {nc ? <Settings2 size={20} color={c.warning} /> : <AlertTriangle size={20} color={c.danger} />}
        <Txt v="title" style={{ flex: 1 }}>{nc ? `${nc.integration?.name ?? 'Integration'} setup बाकी है` : 'कुछ गड़बड़ हुई'}</Txt>
      </Row>
      <Txt v="small" color="muted">{errorMessage(error)}</Txt>
      {nc && <Txt v="caption" color="subtle">{nc.integration?.scope === 'organization' ? 'Broker app → More → Lead connectors में जोड़ें।' : 'Super Admin → Settings → Credentials center (website) में जोड़ें।'}</Txt>}
      {onRetry && <Button title="फिर कोशिश करें" size="sm" variant="secondary" onPress={onRetry} style={{ alignSelf: 'flex-start', marginTop: 4 }} />}
    </View>
  );
}

export function Stat({ label, value, icon, tint }: { label: string; value: React.ReactNode; icon?: React.ReactNode; tint?: string }) {
  const { c } = useTheme();
  return (
    <Card style={{ flex: 1, padding: 14, gap: 8, minWidth: 140 }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${tint ?? c.brand}1f` }}>{icon}</View>
      <Txt v="h2">{value}</Txt>
      <Txt v="caption" color="muted">{label}</Txt>
    </Card>
  );
}

// ------------------------------------------------------------------ Sheet
export function Sheet({ open, onClose, title, children, full }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; full?: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {/* Android sizes the modal root without the system bars even though it draws edge-to-edge, so pin the sheet to the real screen height. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={Platform.OS === 'android' ? { position: 'absolute', top: 0, left: 0, right: 0, height: Dimensions.get('screen').height } : { flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: c.overlay }} onPress={onClose} />
        {open && (
          <Animated.View entering={SlideInDown.springify().damping(18)} exiting={SlideOutDown} style={{ backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom + 12, maxHeight: full ? '94%' : '88%' }}>
            <View style={{ alignItems: 'center', paddingTop: 10 }}>
              <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: c.line }} />
            </View>
            {!!title && <Txt v="h2" style={{ paddingHorizontal: 20, paddingTop: 12 }}>{title}</Txt>}
            <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ------------------------------------------------------------------ Toaster
export function Toaster() {
  const { c } = useTheme();
  const items = useToasts((s) => s.items);
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, gap: 8 }}>
      {items.map((t) => {
        const col = t.type === 'success' ? c.success : t.type === 'error' ? c.danger : c.info;
        const Icon = t.type === 'success' ? CircleCheck : t.type === 'error' ? XCircle : Info;
        return (
          <Animated.View key={t.id} entering={FadeInDown.springify()} exiting={FadeOutUp} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.line, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, elevation: 8 }}>
            <Icon size={20} color={col} />
            <Txt v="small" style={{ flex: 1, fontFamily: fonts.medium }}>{t.text}</Txt>
            {t.action && <Button title={t.action.label} size="sm" variant="secondary" onPress={t.action.onPress} />}
          </Animated.View>
        );
      })}
    </View>
  );
}

export function Loader() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <ActivityIndicator size="large" color={c.brand} />
    </View>
  );
}

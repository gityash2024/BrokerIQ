import { useRef, useState, type ReactNode } from 'react';
import { FlatList, View, type FlatListProps, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView as NativeScrollView } from 'react-native';
import { ArrowDownToLine, ArrowUpToLine, MoveVertical } from 'lucide-react-native';
import { ScrollView } from '@/components/keyboard-scroll-view';
import { useTheme } from '@/lib/theme';
import { IconBtn } from '@/ui';

type Destination = 'top' | 'middle' | 'bottom';

export function useListJump() {
  const [visible, setVisible] = useState(false);
  const measure = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    setVisible(contentOffset.y >= layoutMeasurement.height * 1.75);
  };
  return { visible, measure, reset: () => setVisible(false) };
}

export function ListJumpControls({ onJump }: { onJump: (target: Destination) => void }) {
  const { c } = useTheme();
  return <View accessibilityLabel="Jump in results" style={{ position: 'absolute', bottom: 18, right: 12,
    gap: 2, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface }}>
    <IconBtn accessibilityLabel="Start of results" onPress={() => onJump('top')}><ArrowUpToLine size={18} color={c.brand} /></IconBtn>
    <IconBtn accessibilityLabel="Middle of results" onPress={() => onJump('middle')}><MoveVertical size={18} color={c.brand} /></IconBtn>
    <IconBtn accessibilityLabel="End of results" onPress={() => onJump('bottom')}><ArrowDownToLine size={18} color={c.brand} /></IconBtn>
  </View>;
}

export function resultPage(to: Destination, totalPages: number) {
  return to === 'top' ? 1 : to === 'middle' ? Math.ceil(totalPages / 2) : totalPages;
}

export function QuickListScroll({ children, page = 1, totalPages = 1, onPage }: {
  children: ReactNode; page?: number; totalPages?: number; onPage?: (page: number) => void;
}) {
  const list = useRef<NativeScrollView>(null);
  const dimensions = useRef({ viewport: 0, height: 0 });
  const { visible, measure, reset } = useListJump();

  function jump(to: Destination) {
    const target = resultPage(to, totalPages);
    if (onPage && target !== page) {
      onPage(target);
      list.current?.scrollTo({ y: 0, animated: false });
      reset();
      return;
    }
    const end = Math.max(0, dimensions.current.height - dimensions.current.viewport);
    list.current?.scrollTo({ y: to === 'top' ? 0 : to === 'middle' ? end / 2 : end, animated: true });
  }

  return <View style={{ flex: 1 }}>
    <ScrollView ref={list} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" scrollEventThrottle={64}
      onContentSizeChange={(_, height) => { dimensions.current.height = height; }}
      onLayout={(event) => { dimensions.current.viewport = event.nativeEvent.layout.height; }}
      onScroll={measure}>{children}</ScrollView>
    {visible && <ListJumpControls onJump={jump} />}
  </View>;
}

export function JumpFlatList<Item>({ onScroll, onContentSizeChange, onLayout, scrollEventThrottle, horizontal, ...props }: FlatListProps<Item>) {
  const list = useRef<FlatList<Item>>(null);
  const dimensions = useRef({ viewport: 0, height: 0 });
  const { visible, measure } = useListJump();
  if (horizontal) return <FlatList {...props} horizontal onScroll={onScroll}
    onContentSizeChange={onContentSizeChange} onLayout={onLayout} scrollEventThrottle={scrollEventThrottle} />;
  return <View style={{ flex: 1, minHeight: 0 }}>
    <FlatList {...props} ref={list} scrollEventThrottle={scrollEventThrottle ?? 64}
      onScroll={(event) => { measure(event); onScroll?.(event); }}
      onLayout={(event) => { dimensions.current.viewport = event.nativeEvent.layout.height; onLayout?.(event); }}
      onContentSizeChange={(width, height) => { dimensions.current.height = height; onContentSizeChange?.(width, height); }} />
    {visible && <ListJumpControls onJump={(to) => {
      const end = Math.max(0, dimensions.current.height - dimensions.current.viewport);
      list.current?.scrollToOffset({ offset: to === 'top' ? 0 : to === 'middle' ? end / 2 : end, animated: true });
    }} />}
  </View>;
}

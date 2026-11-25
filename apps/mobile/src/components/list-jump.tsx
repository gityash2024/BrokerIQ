import { useRef, useState, type ReactNode } from 'react';
import { View, type ScrollView as NativeScrollView } from 'react-native';
import { ArrowDownToLine, ArrowUpToLine, MoveVertical } from 'lucide-react-native';
import { ScrollView } from '@/components/keyboard-scroll-view';
import { useTheme } from '@/lib/theme';
import { IconBtn } from '@/ui';

export function QuickListScroll({ children, page = 1, totalPages = 1, onPage }: {
  children: ReactNode; page?: number; totalPages?: number; onPage?: (page: number) => void;
}) {
  const { c } = useTheme();
  const list = useRef<NativeScrollView>(null);
  const dimensions = useRef({ viewport: 0, height: 0 });
  const [visible, setVisible] = useState(false);

  function jump(to: 'top' | 'middle' | 'bottom') {
    const target = to === 'top' ? 1 : to === 'middle' ? Math.ceil(totalPages / 2) : totalPages;
    if (onPage && target !== page) {
      onPage(target);
      list.current?.scrollTo({ y: 0, animated: false });
      setVisible(false);
      return;
    }
    const end = Math.max(0, dimensions.current.height - dimensions.current.viewport);
    list.current?.scrollTo({ y: to === 'top' ? 0 : to === 'middle' ? end / 2 : end, animated: true });
  }

  return <View style={{ flex: 1 }}>
    <ScrollView ref={list} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" scrollEventThrottle={64}
      onContentSizeChange={(_, height) => { dimensions.current.height = height; }}
      onLayout={(event) => { dimensions.current.viewport = event.nativeEvent.layout.height; }}
      onScroll={(event) => {
        const { contentOffset, layoutMeasurement } = event.nativeEvent;
        setVisible(contentOffset.y >= layoutMeasurement.height * 1.75);
      }}>{children}</ScrollView>
    {visible && <View accessibilityLabel="Jump in results" style={{ position: 'absolute', bottom: 18, right: 12,
      gap: 2, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface }}>
      <IconBtn accessibilityLabel="Start of results" onPress={() => jump('top')}><ArrowUpToLine size={18} color={c.brand} /></IconBtn>
      <IconBtn accessibilityLabel="Middle of results" onPress={() => jump('middle')}><MoveVertical size={18} color={c.brand} /></IconBtn>
      <IconBtn accessibilityLabel="End of results" onPress={() => jump('bottom')}><ArrowDownToLine size={18} color={c.brand} /></IconBtn>
    </View>}
  </View>;
}

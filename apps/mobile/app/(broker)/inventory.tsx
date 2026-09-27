import { View } from 'react-native';
import { router } from 'expo-router';
import { Plus, ScanLine } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { ListingsManager } from '@/components/listings-manager';
import { IconBtn, Row, Txt } from '@/ui';

export default function Inventory() {
  const { c } = useTheme();
  return (
    <ListingsManager
      header={
        <Row style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, justifyContent: 'space-between' }}>
          <View>
            <Txt v="h1">Inventory</Txt>
            <Txt v="caption" color="muted">Firm की सारी listings</Txt>
          </View>
          <Row>
            <IconBtn onPress={() => router.push('/scanner')} style={{ backgroundColor: c.surface2 }}><ScanLine size={20} color={c.brand} /></IconBtn>
            <IconBtn onPress={() => router.push('/post-property')} style={{ backgroundColor: c.brand }}><Plus size={22} color="#fff" /></IconBtn>
          </Row>
        </Row>
      }
    />
  );
}

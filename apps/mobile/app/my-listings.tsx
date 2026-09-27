import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { ListingsManager } from '@/components/listings-manager';
import { Header, IconBtn } from '@/ui';

export default function MyListings() {
  const { c } = useTheme();
  return <ListingsManager header={<Header title="मेरी listings" right={<IconBtn onPress={() => router.push('/post-property')} style={{ backgroundColor: c.brand }}><Plus size={20} color="#fff" /></IconBtn>} />} />;
}

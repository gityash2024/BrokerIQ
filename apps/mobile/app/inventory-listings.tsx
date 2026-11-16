import { View } from 'react-native';
import { ListingsManager } from '@/components/listings-manager';
import { NativeInventoryTabs } from '@/launch/inventory-tabs';
import { Header } from '@/ui';

export default function InventoryListings() {
  return (
    <ListingsManager
      activeOnly
      header={
        <>
          <Header title="Publish Listing" subtitle="Properties live on the marketplace." />
          <View style={{ paddingHorizontal: 16 }}>
            <NativeInventoryTabs active="/broker/listings" />
          </View>
        </>
      }
    />
  );
}

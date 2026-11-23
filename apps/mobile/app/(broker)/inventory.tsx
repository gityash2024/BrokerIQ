import { useLocalSearchParams } from 'expo-router';
import { NativeInventoryFolders } from '@/launch/inventory-folders';
import { hasLedgerFilters, InventoryLedger } from '@/launch/inventory-ledger';

export default function Inventory() {
  const params = useLocalSearchParams();
  if (params.survey === '1') return <NativeInventoryFolders key="survey" initialMode="SURVEY" />;
  return hasLedgerFilters(params) ? <InventoryLedger /> : <NativeInventoryFolders />;
}

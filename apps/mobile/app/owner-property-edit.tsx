import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { Loader } from '@/ui';
import { InventoryEditorForm } from './inventory-edit';

export default function OwnerPropertyEditor() {
  const { user, ready } = useAuth();
  if (!ready) return <Loader />;
  if (user?.role !== 'PROPERTY_OWNER') return <Redirect href="/" />;
  return <InventoryEditorForm ownerMode />;
}

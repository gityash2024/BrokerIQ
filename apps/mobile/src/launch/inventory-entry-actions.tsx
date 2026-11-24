import { View } from 'react-native';
import { router } from 'expo-router';
import { hasDelegatedAccess, moduleAllowed } from '@brokeriq/shared';
import { Camera, FileArchive, Plus } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { useTheme } from '@/lib/theme';
import { Button, Txt } from '@/ui';
import { SurveyPhoneAction } from './survey-phone-action';
import { SurveyPhotoAction } from './survey-photo-action';

export function NativeInventoryEntryActions({ params, survey = false }: { params?: Record<string, string>; survey?: boolean }) {
  const { user } = useAuth();
  const { modules } = useConfig();
  const { c, isDark } = useTheme();
  const role = user?.role === 'SUB_BROKER_ADMIN' ? 'BROKER_ADMIN' : (user?.role ?? '');
  const canCreate = !!user && hasDelegatedAccess(user, 'inventory', 'create');
  const canImport = canCreate && moduleAllowed(modules, 'inbox', role) && hasDelegatedAccess(user, 'inbox', 'view', 'create');
  return (
    <View
      accessibilityLabel="Inventory entry actions"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        padding: 12,
        borderRadius: 16,
        backgroundColor: isDark ? c.surface : 'rgba(255,255,255,0.92)',
        borderWidth: 0.5,
        borderColor: c.line,
        shadowColor: '#231345',
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      <Button
        title={survey ? 'Add survey property' : 'Add property'}
        disabled={!canCreate}
        icon={<Plus size={17} color="white" />}
        style={{ flexGrow: 1, flexBasis: 140, minHeight: 44, borderRadius: 16, paddingHorizontal: 10 }}
        onPress={() =>
          router.push({ pathname: '/inventory-edit', params: survey ? { ...params, survey: '1' } : params })
        }
      />
      <Button
        title={survey ? 'Scan survey register' : 'Scan property'}
        variant="secondary"
        disabled={!canImport}
        icon={<Camera size={17} color={c.brand} />}
        style={{ flexGrow: 1, flexBasis: 140, minHeight: 44, borderRadius: 16, paddingHorizontal: 10 }}
        onPress={() =>
          router.push(
            survey ? { pathname: '/scanner', params: { target: 'SURVEY', ...(params?.sector ? { sector: params.sector } : {}) } } : '/scanner?target=INVENTORY',
          )
        }
      />
      {survey && <SurveyPhotoAction allowed={canCreate} sector={params?.sector} customFolderId={params?.customFolderId} />}
      {survey && <SurveyPhoneAction allowed={canCreate} sector={params?.sector} customFolderId={params?.customFolderId} />}
      {!survey && (
        <Button
          title="WhatsApp import"
          variant="secondary"
          disabled={!canImport}
          icon={<FileArchive size={17} color={c.brand} />}
          style={{ flexGrow: 1, flexBasis: 140, minHeight: 44, borderRadius: 16, paddingHorizontal: 10 }}
          onPress={() => router.push('/capture?target=INVENTORY')}
        />
      )}
      {!canImport && (
        <Txt v="caption" color="muted" style={{ width: '100%' }}>
          Ask your Broker Admin for inventory create and capture access to use these actions.
        </Txt>
      )}
    </View>
  );
}

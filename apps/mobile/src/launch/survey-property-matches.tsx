import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import { hasDelegatedAccess, surveyPropertyLookupSchema, surveyPropertyViews, type SurveyPropertyMatch } from '@brokeriq/shared';
import { api, patch, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiMutation, useDebounced } from '@/lib/hooks';
import { Button, Card, Row, Txt } from '@/ui';

export function SurveyPropertyMatches({ sector, houseNo, linkToProperty = false }: { sector?: string | null; houseNo?: string | null; linkToProperty?: boolean }) {
  const { user } = useAuth();
  const canView = !!user && hasDelegatedAccess(user, 'inventory', 'view');
  const number = houseNo?.trim() ?? '';
  const debounced = useDebounced(number, 300);
  const lookup = surveyPropertyLookupSchema.safeParse({ sector, houseNo: debounced });
  const query = useQuery({
    queryKey: ['survey-property-matches', user?.id, user?.organization?.id, sector, debounced],
    enabled: canView && lookup.success && number === debounced,
    queryFn: () => api<SurveyPropertyMatch[]>('/inventory/survey-property-matches' + qs(lookup.data ?? {})),
  });
  const reopen = useApiMutation((item: SurveyPropertyMatch) => patch(`/inventory/${encodeURIComponent(item.id)}/reopen-survey`, { expectedRevision: item.revision }), {
    success: 'Property returned to Survey',
    invalidate: [['survey-property-matches'], ['inventory-folders'], ['inventory-folder-items'], ['broker-today']],
  });
  if (!canView || !lookup.success || number !== debounced) return null;
  if (query.error || query.fetchStatus === 'paused') return <Txt v="caption" color="muted">Existing properties could not be checked. Your draft can still be saved.</Txt>;
  if (!query.data?.length) return null;
  return (
    <Card style={{ padding: 10, gap: 8 }}>
      <Txt v="small">Existing properties at this address</Txt>
      {query.data.map((item) => (
        <View key={item.id} style={{ gap: 3 }}>
          <Row wrap gap={8}>
            {linkToProperty
              ? <Button title={item.propertyCode} size="sm" variant="ghost" onPress={() => router.push({ pathname: '/inventory/[id]', params: { id: item.id } })} />
              : <Txt v="bodyStrong">{item.propertyCode}</Txt>}
            <Txt v="small">{[item.floor, item.unitLabel, surveyPropertyViews[item.view]].filter(Boolean).join(' · ')}</Txt>
          </Row>
          {item.canReturnToSurvey && (
            <Button title="Return to Survey" size="sm" variant="secondary" disabled={reopen.isPending} onPress={() => {
              Alert.alert('Return to Survey?', 'Use the existing property record for this survey.', [
                { text: 'Cancel', style: 'cancel' }, { text: 'Return to Survey', onPress: () => reopen.mutate(item) },
              ]);
            }} />
          )}
        </View>
      ))}
    </Card>
  );
}

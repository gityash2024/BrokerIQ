import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import {
  hasDelegatedAccess,
  surveyPropertyLookupSchema,
  surveyPropertyViews,
  type SurveyPropertyMatch,
  type SurveyPropertyMatchSummary,
} from '@brokeriq/shared';
import { api, patch, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiMutation, useDebounced } from '@/lib/hooks';
import { Button, Card, Row, Txt } from '@/ui';

export function SurveyPropertyMatches({
  sector,
  houseNo,
  excludeId,
  onOpenProperty,
}: {
  sector?: string | null;
  houseNo?: string | null;
  excludeId?: string;
  onOpenProperty?: () => void;
}) {
  const { user } = useAuth();
  const canView = !!user && hasDelegatedAccess(user, 'inventory', 'view');
  const number = houseNo?.trim() ?? '';
  const debounced = useDebounced(number, 300);
  const lookup = surveyPropertyLookupSchema.safeParse({ sector, houseNo: debounced, includeRestrictedNotice: 'true', ...(excludeId ? { excludeId } : {}) });
  const query = useQuery({
    queryKey: ['survey-property-matches', user?.id, user?.organization?.id, sector, debounced, excludeId],
    staleTime: 0,
    enabled: canView && lookup.success && number === debounced,
    queryFn: () => api<SurveyPropertyMatchSummary | SurveyPropertyMatch[]>('/inventory/survey-property-matches' + qs(lookup.data ?? {})),
  });
  const reopen = useApiMutation(
    (item: SurveyPropertyMatch) => patch(`/inventory/${encodeURIComponent(item.id)}/reopen-survey`, { expectedRevision: item.revision }),
    {
      success: 'Property returned to Survey',
      invalidate: [['survey-property-matches'], ['inventory-folders'], ['inventory-folder-items'], ['broker-today']],
    },
  );
  if (!canView || !lookup.success || number !== debounced) return null;
  if (query.error || query.fetchStatus === 'paused')
    return (
      <Txt v="caption" color="muted">
        Existing properties could not be checked. Your draft can still be saved.
      </Txt>
    );
  if (query.isFetching && !query.data)
    return (
      <Txt v="caption" color="muted">
        Checking existing properties…
      </Txt>
    );
  const items = Array.isArray(query.data) ? query.data : (query.data?.items ?? []);
  const restricted = !Array.isArray(query.data) && query.data?.hasRestrictedMatches;
  if (!items.length && !restricted) return null;
  return (
    <Card style={{ padding: 10, gap: 8 }}>
      <Txt v="small">Existing properties at this address</Txt>
      {restricted && (
        <Txt v="small" color="muted">
          This house number is already recorded in your firm. Ask your Broker Admin to check the existing entry before adding it again.
        </Txt>
      )}
      {items.map((item) => (
        <View key={item.id} style={{ gap: 3 }}>
          <Row wrap gap={8}>
            <Button
              title={item.propertyCode}
              size="sm"
              variant="ghost"
              onPress={() => {
                onOpenProperty?.();
                router.push({ pathname: '/inventory/[id]', params: { id: item.id } });
              }}
            />
            <Txt v="small">{[item.floor, item.unitLabel, surveyPropertyViews[item.view]].filter(Boolean).join(' · ')}</Txt>
          </Row>
          {item.canReturnToSurvey && (
            <Button
              title="Return to Survey"
              size="sm"
              variant="secondary"
              disabled={reopen.isPending}
              onPress={() => {
                Alert.alert('Return to Survey?', 'Use the existing property record for this survey.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Return to Survey', onPress: () => reopen.mutate(item) },
                ]);
              }}
            />
          )}
        </View>
      ))}
    </Card>
  );
}

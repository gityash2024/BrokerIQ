import React from 'react';
import { Alert } from 'react-native';
import type { SurveyPropertyMatch } from '@brokeriq/shared';
import { SurveyPropertyMatches } from '../survey-property-matches';

const { act, create } = require('react-test-renderer');
const mockMutate = jest.fn();
const mockRows: SurveyPropertyMatch[] = [
  { id: 'available', propertyCode: 'BIQ-000001', revision: 2, floor: 'First', unitLabel: 'A', view: 'AVAILABLE', canReturnToSurvey: false },
  { id: 'historical', propertyCode: 'BIQ-000002', revision: 4, floor: 'Second', unitLabel: 'B', view: 'ALL', canReturnToSurvey: true },
];
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: mockRows }) }));
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { id: 'broker', role: 'BROKER_ADMIN', organization: { id: 'firm' } } }) }));
jest.mock('@/lib/api', () => ({ api: jest.fn(), patch: jest.fn(), qs: jest.fn() }));
jest.mock('@/lib/hooks', () => ({
  useApiMutation: () => ({ mutate: mockMutate, isPending: false }),
  useDebounced: (value: string) => value,
}));
jest.mock('@/ui', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    Card: View, Row: View, Txt: Text,
    Button: ({ title, onPress }: { title: string; onPress: () => void }) => (
      <Pressable accessibilityLabel={title} onPress={onPress}><Text>{title}</Text></Pressable>
    ),
  };
});

it('shows the distinct inventory locations and only queues the selected historical unit after confirmation', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  let tree: any;
  try {
    act(() => { tree = create(<SurveyPropertyMatches sector="Sec-30" houseNo="48" />); });
    expect(tree.root.findAll((element: any) => element.props.children === 'First · A · Available Inventory').length).toBeGreaterThan(0);
    expect(tree.root.findAll((element: any) => element.props.children === 'Second · B · All Inventory').length).toBeGreaterThan(0);
    const controls = tree.root.findAll((element: any) => element.props.title === 'Return to Survey' && typeof element.props.onPress === 'function');
    expect(controls).toHaveLength(1);
    act(() => controls[0].props.onPress());
    expect(mockMutate).not.toHaveBeenCalled();
    act(() => alert.mock.calls[0][2]?.find((choice) => choice.text === 'Return to Survey')?.onPress?.());
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith(mockRows[1]);
  } finally {
    act(() => tree?.unmount());
    alert.mockRestore();
  }
});

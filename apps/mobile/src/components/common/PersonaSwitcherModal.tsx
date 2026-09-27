import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuth } from '../../stores/authStore';
import { DEMO_PERSONAS, PersonaConfig } from '../../data/personaData';

interface PersonaSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PersonaSwitcherModal = ({
  visible,
  onClose,
}: PersonaSwitcherModalProps) => {
  const router = useRouter();
  const { activePersona, switchPersona } = useAuth();

  const handleSelectPersona = async (persona: PersonaConfig) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // safe fallback on simulators without haptics
    }

    await switchPersona(persona.id);
    onClose();

    // Reset to tabs root so the role's primary home screen renders immediately
    router.replace('/(tabs)');
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'SEEKER':
        return 'Seeker Discovery';
      case 'OWNER':
        return 'Owner Landlord';
      case 'BROKER':
        return 'Broker CRM';
      default:
        return mode;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            justifyContent: 'flex-end',
          }}
        >
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: 36,
                maxHeight: '88%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.15,
                shadowRadius: 16,
                elevation: 20,
              }}
            >
              {/* Drag Indicator */}
              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <View
                  style={{
                    width: 44,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: '#E2E8F0',
                  }}
                />
              </View>

              {/* Modal Header */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <View>
                  <Text
                    style={{
                      fontSize: 19,
                      fontWeight: '800',
                      color: '#0F172A',
                      letterSpacing: -0.3,
                    }}
                  >
                    Switch User Persona
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#64748B',
                      marginTop: 2,
                      fontWeight: '500',
                    }}
                  >
                    Experience BrokerIQ across all 5 roles with 1-tap switching
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: '#F1F5F9',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M18 6L6 18M6 6l12 12"
                      stroke="#475569"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </Svg>
                </TouchableOpacity>
              </View>

              {/* Persona List */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 10 }}
              >
                {Object.values(DEMO_PERSONAS).map((persona) => {
                  const isSelected = activePersona.id === persona.id;

                  return (
                    <TouchableOpacity
                      key={persona.id}
                      activeOpacity={0.8}
                      onPress={() => handleSelectPersona(persona)}
                      style={{
                        backgroundColor: isSelected ? '#F0FDFA' : '#F8FAFC',
                        borderWidth: 1.5,
                        borderColor: isSelected ? '#0D9488' : '#E2E8F0',
                        borderRadius: 16,
                        padding: 14,
                        marginBottom: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      {/* Avatar Circle */}
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: persona.accentColor,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                          shadowColor: persona.accentColor,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 4,
                          elevation: 3,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: '800',
                            color: '#FFFFFF',
                          }}
                        >
                          {persona.avatar}
                        </Text>
                      </View>

                      {/* Info Column */}
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 6,
                            marginBottom: 2,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: '700',
                              color: '#0F172A',
                            }}
                          >
                            {persona.name}
                          </Text>
                          <View
                            style={{
                              backgroundColor: `${persona.accentColor}1A`,
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: 6,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: '800',
                                color: persona.accentColor,
                              }}
                            >
                              {persona.badgeText}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={{
                            fontSize: 11,
                            color: '#64748B',
                            fontWeight: '600',
                            marginBottom: 2,
                          }}
                        >
                          {persona.organizationName} • {getModeLabel(persona.mode)}
                        </Text>

                        <Text
                          style={{
                            fontSize: 11,
                            color: '#475569',
                            lineHeight: 15,
                          }}
                          numberOfLines={2}
                        >
                          {persona.description}
                        </Text>
                      </View>

                      {/* Selected Radio Indicator */}
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          borderWidth: 2,
                          borderColor: isSelected ? '#0D9488' : '#CBD5E1',
                          backgroundColor: isSelected ? '#0D9488' : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isSelected && (
                          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                            <Path
                              d="M20 6L9 17l-5-5"
                              stroke="#FFFFFF"
                              strokeWidth="3.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </Svg>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default PersonaSwitcherModal;

import { useState } from 'react';
import { Alert, ScrollView, View, Linking, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { tr } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { PLATFORM_MODULES, defaultModulePolicies, moduleAllowed, languageOf } from '@brokeriq/shared';
import { Txt, Button } from '@/ui';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { LanguageSheet } from '@/components/language';
import { useTheme, useThemeMode } from '@/lib/theme';
import { useLang } from '@/lib/lang';
import {
  Users,
  Building2,
  FileDown,
  Languages,
  Sun,
  Moon,
  ExternalLink,
  Eye,
  LogOut,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Edit2,
  Layers,
} from 'lucide-react-native';

export default function BrokerSettings() {
  const { user, logout } = useAuth();
  const { modules = defaultModulePolicies() } = useConfig();
  const { c, isDark } = useTheme();
  const mode = useThemeMode((s) => s.mode);
  const setMode = useThemeMode((s) => s.setMode);
  const lang = useLang((s) => s.lang);
  const [langSheetOpen, setLangSheetOpen] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      tr('Log out of BrokerIQ?'),
      tr('Are you sure you want to log out of your account?'),
      [
        { text: tr('Cancel'), style: 'cancel' },
        { text: tr('Log out'), style: 'destructive', onPress: logout },
      ],
    );
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'B';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const currentLangLabel = lang ? languageOf(lang).native : 'हिंग्लिश (Original)';

  return (
    <BrokerScreen title="Profile & Settings" subtitle="Account, agency & app configuration" back>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14, paddingBottom: 40 }}>
        {/* Profile Hero Card */}
        <View
          style={{
            borderRadius: 24,
            padding: 18,
            backgroundColor: isDark ? '#13172C' : '#FFFFFF',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(99,102,241,0.25)' : c.line,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 14,
            elevation: 4,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {/* Avatar Initials */}
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: 20,
                backgroundColor: c.brand,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: c.brand,
                shadowOpacity: 0.35,
                shadowRadius: 10,
                elevation: 6,
              }}
            >
              <Txt style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>
                {getInitials(user?.name)}
              </Txt>
            </View>

            <View style={{ flex: 1, gap: 3 }}>
              <Txt style={{ fontSize: 18, fontWeight: '800', color: c.fg }} numberOfLines={1}>
                {user?.name || 'Broker Partner'}
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Building2 size={13} color={c.muted} />
                <Txt v="small" color="muted" numberOfLines={1}>
                  {user?.organization?.name || 'BrokerIQ Real Estate'}
                </Txt>
              </View>
              <Txt v="caption" color="muted" numberOfLines={1}>
                {user?.email || user?.phone || ''}
              </Txt>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : c.line,
            }}
          >
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: 'rgba(99,102,241,0.15)',
              }}
            >
              <Txt v="caption" style={{ color: c.brand, fontWeight: '700' }}>
                🛡️ {user?.role === 'BROKER_ADMIN' ? 'Broker Administrator' : 'Broker Agent'}
              </Txt>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/edit-profile')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Edit2 size={14} color={c.brand} />
              <Txt v="small" style={{ color: c.brand, fontWeight: '700' }}>
                Edit Profile
              </Txt>
            </TouchableOpacity>
          </View>
        </View>

        {/* Agent KYC Verification Card */}
        <TouchableOpacity
          onPress={() => router.push('/agent-kyc')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderRadius: 20,
            backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(16,185,129,0.3)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: '#10B981',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={22} color="#FFFFFF" />
            </View>
            <View style={{ gap: 2 }}>
              <Txt style={{ fontWeight: '800', fontSize: 14, color: c.fg }}>
                Agent KYC Verification
              </Txt>
              <Txt v="caption" color="muted">
                आधार, पैन व 3-स्टेप चेहरा सत्यापन
              </Txt>
            </View>
          </View>
          <ChevronRight size={18} color={c.muted} />
        </TouchableOpacity>

        {/* Section 1: Firm & Team */}
        <View style={{ gap: 8 }}>
          <Txt v="caption" color="muted" style={{ fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 4 }}>
            Firm & Team
          </Txt>

          <View
            style={{
              borderRadius: 20,
              backgroundColor: isDark ? '#121524' : c.surface,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : c.line,
              overflow: 'hidden',
            }}
          >
            {moduleAllowed(modules, 'team', user?.role ?? 'PUBLIC') && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/team')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 15,
                  gap: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : c.line,
                }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(99,102,241,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={18} color={c.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="bodyStrong">Team & Sub-Agents</Txt>
                  <Txt v="caption" color="muted">Manage agency members, agents & invites</Txt>
                </View>
                <ChevronRight size={18} color={c.muted} />
              </TouchableOpacity>
            )}

            {user?.role === 'BROKER_ADMIN' && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/broker-onboarding')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 15,
                  gap: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : c.line,
                }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={18} color={c.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="bodyStrong">Firm Profile & RERA</Txt>
                  <Txt v="caption" color="muted">Company details, GST & RERA license</Txt>
                </View>
                <ChevronRight size={18} color={c.muted} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/drafts')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 15,
                gap: 12,
              }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <FileDown size={18} color={c.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong">Saved Drafts & Offline Sync</Txt>
                <Txt v="caption" color="muted">Local offline property listings & retry queue</Txt>
              </View>
              <ChevronRight size={18} color={c.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 2: Preferences & Display */}
        <View style={{ gap: 8 }}>
          <Txt v="caption" color="muted" style={{ fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 4 }}>
            Preferences & Language
          </Txt>

          <View
            style={{
              borderRadius: 20,
              backgroundColor: isDark ? '#121524' : c.surface,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : c.line,
              overflow: 'hidden',
            }}
          >
            {/* Language Selection */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setLangSheetOpen(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 15,
                gap: 12,
                borderBottomWidth: 1,
                borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : c.line,
              }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(99,102,241,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Languages size={18} color={c.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong">App Language / भाषा</Txt>
                <Txt v="caption" color="muted">{currentLangLabel}</Txt>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Txt v="small" style={{ color: c.brand, fontWeight: '700' }}>Change</Txt>
                <ChevronRight size={18} color={c.muted} />
              </View>
            </TouchableOpacity>

            {/* Theme Toggle */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 15,
                gap: 12,
                borderBottomWidth: 1,
                borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : c.line,
              }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                {isDark ? <Moon size={18} color={c.warning} /> : <Sun size={18} color={c.warning} />}
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong">Theme Display</Txt>
                <Txt v="caption" color="muted">{isDark ? 'Dark Luxury' : 'Light Mode'}</Txt>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  onPress={() => setMode('light')}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 10,
                    backgroundColor: mode === 'light' ? c.brand : (isDark ? 'rgba(255,255,255,0.06)' : c.surface2),
                  }}
                >
                  <Txt v="caption" style={{ color: mode === 'light' ? '#fff' : c.muted, fontWeight: '700' }}>Light</Txt>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMode('dark')}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 10,
                    backgroundColor: mode === 'dark' ? c.brand : (isDark ? 'rgba(255,255,255,0.06)' : c.surface2),
                  }}
                >
                  <Txt v="caption" style={{ color: mode === 'dark' ? '#fff' : c.muted, fontWeight: '700' }}>Dark</Txt>
                </TouchableOpacity>
              </View>
            </View>

            {/* Product Tools */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/product-tools' as any)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 15,
                gap: 12,
              }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(168,85,247,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={18} color="#A855F7" />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong">Product Tools & AI Features</Txt>
                <Txt v="caption" color="muted">Upcoming roadmap, AI matching & feature flags</Txt>
              </View>
              <ChevronRight size={18} color={c.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 3: Portals & External */}
        <View style={{ gap: 8 }}>
          <Txt v="caption" color="muted" style={{ fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 4 }}>
            Portals & Access
          </Txt>

          <View
            style={{
              borderRadius: 20,
              backgroundColor: isDark ? '#121524' : c.surface,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : c.line,
              overflow: 'hidden',
            }}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/(user)/home')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 15,
                gap: 12,
                borderBottomWidth: 1,
                borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : c.line,
              }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(14,165,233,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Eye size={18} color="#0EA5E9" />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong">Browse Consumer Portal</Txt>
                <Txt v="caption" color="muted">Experience the public buyer & tenant portal</Txt>
              </View>
              <ChevronRight size={18} color={c.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Linking.openURL('https://brokeriq.mymultimeds.com/login')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 15,
                gap: 12,
              }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(99,102,241,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <ExternalLink size={18} color={c.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong">Open Web Dashboard</Txt>
                <Txt v="caption" color="muted">brokeriq.mymultimeds.com</Txt>
              </View>
              <ChevronRight size={18} color={c.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 4: Upcoming Modules */}
        {PLATFORM_MODULES.filter((m) => modules[m.key]?.state === 'COMING_SOON' && m.key !== 'legacy').length > 0 && (
          <View style={{ gap: 8 }}>
            <Txt v="caption" color="muted" style={{ fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 4 }}>
              Upcoming Modules
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PLATFORM_MODULES.filter((m) => modules[m.key]?.state === 'COMING_SOON' && m.key !== 'legacy').map((m) => (
                <View
                  key={m.key}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 14,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : c.surface,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : c.line,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Sparkles size={14} color={c.muted} />
                  <Txt v="small" color="muted">
                    {m.name} (Soon)
                  </Txt>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Logout Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleLogout}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 16,
            borderRadius: 18,
            backgroundColor: 'rgba(244,63,94,0.12)',
            borderWidth: 1,
            borderColor: 'rgba(244,63,94,0.25)',
            marginTop: 6,
          }}
        >
          <LogOut size={18} color={c.danger} />
          <Txt v="bodyStrong" style={{ color: c.danger, fontWeight: '700' }}>
            Log Out of BrokerIQ
          </Txt>
        </TouchableOpacity>

        {/* App Version Info Footer */}
        <View style={{ alignItems: 'center', paddingVertical: 10, gap: 2 }}>
          <Txt v="caption" color="muted" style={{ fontSize: 11 }}>
            BrokerIQ Mobile Enterprise v2.2.1 (Build 37)
          </Txt>
          <Txt v="caption" color="muted" style={{ fontSize: 10 }}>
            Automated Real Estate Operating System
          </Txt>
        </View>
      </ScrollView>

      {/* Language Selection Sheet */}
      <LanguageSheet open={langSheetOpen} onClose={() => setLangSheetOpen(false)} />
    </BrokerScreen>
  );
}

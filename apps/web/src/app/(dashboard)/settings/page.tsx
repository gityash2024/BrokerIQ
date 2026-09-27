'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Button } from '@/components/Button';
import { Switch } from '@/components/Switch';
import { CheckCircle2, Sliders, ShieldCheck, Zap, CreditCard, Sparkles } from 'lucide-react';

interface SystemSettingItem {
  id: string;
  group: string;
  key: string;
  value: any;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'payments' | 'security'>('general');
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const { data: settings = [], isLoading } = useQuery<SystemSettingItem[]>({
    queryKey: ['system-settings'],
    queryFn: () => api.settings.getAll(),
  });

  const getVal = (key: string, defaultVal: any) => {
    const item = settings.find((s) => s.key === key);
    if (!item) return defaultVal;
    if (typeof item.value === 'object' && item.value !== null) {
      return item.value[Object.keys(item.value)[0]] ?? defaultVal;
    }
    return item.value ?? defaultVal;
  };

  // Form states
  const [appName, setAppName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('INR');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiProvider, setAiProvider] = useState('GROQ');
  const [aiLimit, setAiLimit] = useState(250000);
  const [paymentGateway, setPaymentGateway] = useState('RAZORPAY');

  useEffect(() => {
    if (settings.length > 0) {
      setAppName(getVal('app_name', 'BrokerIQ Enterprise SaaS'));
      setSupportEmail(getVal('support_email', 'support@brokeriq.in'));
      setSupportPhone(getVal('support_phone', '+91 98765 43210'));
      setDefaultCurrency(getVal('default_currency', 'INR'));
      setAiEnabled(getVal('ai_global_enabled', true));
      setAiProvider(getVal('ai_primary_provider', 'GROQ'));
      setAiLimit(getVal('ai_daily_limit', 250000));
      setPaymentGateway(getVal('active_payment_gateway', 'RAZORPAY'));
    }
  }, [settings]);

  const upsertMutation = useMutation({
    mutationFn: async (items: Array<{ key: string; value: any; group: string }>) => {
      for (const item of items) {
        await api.settings.upsert(item.key, item.value, item.group);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      setSaveSuccess('Configuration successfully saved to database.');
      setTimeout(() => setSaveSuccess(null), 3500);
    },
  });

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate([
      { key: 'app_name', value: { name: appName }, group: 'GENERAL' },
      { key: 'support_email', value: { email: supportEmail }, group: 'GENERAL' },
      { key: 'support_phone', value: { phone: supportPhone }, group: 'GENERAL' },
      { key: 'default_currency', value: { currency: defaultCurrency }, group: 'PAYMENTS' },
    ]);
  };

  const handleSaveAI = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate([
      { key: 'ai_global_enabled', value: { enabled: aiEnabled }, group: 'AI' },
      { key: 'ai_primary_provider', value: { provider: aiProvider }, group: 'AI' },
      { key: 'ai_daily_limit', value: { limit: Number(aiLimit) }, group: 'AI' },
    ]);
  };

  const handleSavePayments = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate([
      { key: 'active_payment_gateway', value: { gateway: paymentGateway }, group: 'PAYMENTS' },
    ]);
  };

  const tabs = [
    { id: 'general' as const, label: 'General & Localization', icon: Sliders },
    { id: 'ai' as const, label: 'AI Copilot & Models', icon: Sparkles },
    { id: 'payments' as const, label: 'Billing & Gateway', icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">System Settings & Governance</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure global platform variables, AI routing thresholds, and payment integrations.
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-600" />
          {saveSuccess}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`flex items-center gap-2 px-5 py-3 font-semibold text-xs tracking-wide uppercase border-b-2 transition-all ${
                isActive
                  ? 'border-[#0D9488] text-[#0D9488]'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Settings Card */}
      <Card className="p-6">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading settings from database...</div>
        ) : (
          <>
            {activeTab === 'general' && (
              <form onSubmit={handleSaveGeneral} className="space-y-6 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Input
                    label="Platform Title"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                  />
                  <Input
                    label="Support Email"
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                  />
                  <Input
                    label="Support Hotline"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                  />
                  <Select
                    label="Default Operating Currency"
                    value={defaultCurrency}
                    onChange={(e: any) => setDefaultCurrency(e.target.value)}
                    options={[
                      { label: 'INR (₹ - Indian Rupee)', value: 'INR' },
                      { label: 'USD ($ - US Dollar)', value: 'USD' },
                      { label: 'AED (د.إ - UAE Dirham)', value: 'AED' },
                    ]}
                  />
                </div>
                <div className="pt-4 border-t">
                  <Button type="submit" disabled={upsertMutation.isPending}>
                    {upsertMutation.isPending ? 'Saving...' : 'Save General Settings'}
                  </Button>
                </div>
              </form>
            )}

            {activeTab === 'ai' && (
              <form onSubmit={handleSaveAI} className="space-y-6 max-w-2xl">
                <div className="flex items-center justify-between p-4 bg-teal-50/50 rounded-xl border border-teal-100">
                  <div>
                    <h4 className="font-semibold text-gray-900 text-sm">BrokerIQ AI Copilot Engine</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Enable Llama-3 real-time message drafting, lead qualification, and property matching.
                    </p>
                  </div>
                  <Switch
                    checked={aiEnabled}
                    onChange={() => setAiEnabled(!aiEnabled)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Select
                    label="Primary LLM Provider"
                    value={aiProvider}
                    onChange={(e: any) => setAiProvider(e.target.value)}
                    options={[
                      { label: 'Groq (Llama-3.3-70b-versatile)', value: 'GROQ' },
                      { label: 'OpenAI (GPT-4o Mini)', value: 'OPENAI' },
                      { label: 'Anthropic (Claude 3.5 Haiku)', value: 'ANTHROPIC' },
                    ]}
                  />
                  <Input
                    label="Tenant Daily Token Quota"
                    type="number"
                    value={aiLimit}
                    onChange={(e) => setAiLimit(Number(e.target.value))}
                  />
                </div>

                <div className="pt-4 border-t">
                  <Button type="submit" disabled={upsertMutation.isPending}>
                    {upsertMutation.isPending ? 'Saving...' : 'Save AI Settings'}
                  </Button>
                </div>
              </form>
            )}

            {activeTab === 'payments' && (
              <form onSubmit={handleSavePayments} className="space-y-6 max-w-2xl">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <h4 className="font-semibold text-gray-900 text-sm mb-1">Billing Provider Gateway</h4>
                  <p className="text-xs text-gray-500 mb-4">
                    Select the active payment service provider for subscription recurring mandates.
                  </p>
                  <Select
                    label="Active Payment Gateway"
                    value={paymentGateway}
                    onChange={(e: any) => setPaymentGateway(e.target.value)}
                    options={[
                      { label: 'Razorpay (India - UPI, Cards, NetBanking)', value: 'RAZORPAY' },
                      { label: 'Stripe (Global - Cards, SEPA)', value: 'STRIPE' },
                    ]}
                  />
                </div>

                <div className="pt-4 border-t">
                  <Button type="submit" disabled={upsertMutation.isPending}>
                    {upsertMutation.isPending ? 'Saving...' : 'Save Payment Configuration'}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

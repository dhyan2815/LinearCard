'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { PageShell } from '../../../../../../components/ui/PageShell';
import { Card } from '../../../../../../components/ui/Card';
import { Input } from '../../../../../../components/ui/Input';
import { Label } from '../../../../../../components/ui/Label';
import { Button } from '../../../../../../components/ui/Button';
import { apiClient } from '../../../../../../lib/api-client';
import { MessageSquare, Save, RefreshCw } from 'lucide-react';

const DEFAULT_TEMPLATES = {
  otp: 'Your {{tenant}} login code is {{code}}.',
  welcome: 'Welcome to the {{programName}}! We are thrilled to have you onboard.\n\nTap to add it to Google Wallet:\n{{walletUrl}}\n\n_Powered by LinearCard_',
  receipt: 'Thank you for your purchase! You earned {{points}} points. Your new balance is {{balance}}.',
  walletSave: '🎉 Success! Your *{{tenant}}* {{programName}} has been securely saved to your Google Wallet. You can now access it anytime from your phone.',
  tierUpgrade: 'Congratulations! You have been upgraded to the {{tierName}} tier.',
};

const TEMPLATE_VARS: Record<string, string[]> = {
  otp: ['tenant', 'code'],
  welcome: ['programName', 'tenant', 'memberName', 'walletUrl'],
  receipt: ['points', 'balance', 'programName', 'tenant'],
  walletSave: ['memberName', 'programName', 'tenant'],
  tierUpgrade: ['tierName', 'programName', 'tenant'],
};

export default function WhatsAppTemplatesEditor({ programId }: { programId: string }) {
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [programId]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await apiClient(`/programs/${programId}`);
      if (res.success && res.program) {
        setTemplates(res.program.whatsappTemplates || {});
      }
    } catch (e: any) {
      toast.error('Failed to load templates: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await apiClient(`/programs/${programId}`, {
        method: 'PATCH',
        body: JSON.stringify({ whatsappTemplates: templates }),
      });
      if (!res.success) throw new Error(res.error || 'Update failed');
      toast.success('WhatsApp templates updated successfully');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (key: string) => {
    setTemplates((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleChange = (key: string, value: string) => {
    setTemplates((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <PageShell>
        <div className="h-8 w-48 bg-surface-hover animate-pulse rounded mb-6" />
        <div className="space-y-4">
          <div className="h-32 bg-surface-card animate-pulse rounded-xl" />
          <div className="h-32 bg-surface-card animate-pulse rounded-xl" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold text-ink-dark flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-brand-blue" />
              Messages
          </h1>
          <p className="text-ink-secondary text-sm mt-1">
            Customize automated messages sent to members for this program. Leave blank to use defaults.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="space-y-6 mt-6">
        {Object.entries(DEFAULT_TEMPLATES).map(([key, defaultValue]) => {
          const currentValue = templates[key] ?? '';
          const isOverridden = currentValue !== '';
          const vars = TEMPLATE_VARS[key].map((v) => `{{${v}}}`).join(', ');

          return (
            <Card key={key} className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-[15px] font-semibold text-ink-dark capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </h3>
                  <p className="text-xs text-ink-muted mt-1 font-mono">
                    Available variables: {vars}
                  </p>
                </div>
                {isOverridden && (
                  <Button variant="ghost" size="sm" onClick={() => handleReset(key)}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Reset to Default
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <textarea
                  value={isOverridden ? currentValue : defaultValue}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className={`w-full bg-surface-card border border-border-subtle rounded-xl px-4 py-3 text-ink-dark focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue min-h-20 font-mono text-sm ${!isOverridden ? 'text-ink-muted opacity-80' : ''}`}
                />
                {!isOverridden && (
                  <p className="text-[11px] text-brand-blue/80 italic">Using system default message.</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}

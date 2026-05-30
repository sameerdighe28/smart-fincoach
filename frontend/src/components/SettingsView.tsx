"use client";
import { useEffect, useState } from "react";
import {
  Settings, Clock, Bell, Brain, Shield, Database,
  Play, Save, ToggleLeft, ToggleRight, RefreshCw, Loader2
} from "lucide-react";
import { api } from "@/lib/api";

interface AppSettings {
  nightly_enabled: boolean;
  nightly_time: string; // HH:MM in IST
  email_notifications: boolean;
  notification_email: string;
  llm_enabled: boolean;
  llm_budget_monthly: number; // in INR
  llm_usage_this_month: number;
  auto_categorize_on_upload: boolean;
  auto_reconcile_on_upload: boolean;
  duplicate_check_enabled: boolean;
  dark_mode: boolean;
  currency: string;
  tax_bracket: number; // percentage for tax savings calculation
  fy_start_month: number; // 4 for April (India default)
  emergency_fund_target_months: number;
  budget_alert_threshold: number; // percentage
}

const DEFAULT_SETTINGS: AppSettings = {
  nightly_enabled: true,
  nightly_time: "23:30",
  email_notifications: true,
  notification_email: "",
  llm_enabled: true,
  llm_budget_monthly: 50,
  llm_usage_this_month: 0,
  auto_categorize_on_upload: true,
  auto_reconcile_on_upload: true,
  duplicate_check_enabled: false,
  dark_mode: true,
  currency: "INR",
  tax_bracket: 30,
  fy_start_month: 4,
  emergency_fund_target_months: 6,
  budget_alert_threshold: 80,
};

function Toggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2 group">
      {enabled ? (
        <ToggleRight className="w-8 h-5 text-brand-400" />
      ) : (
        <ToggleLeft className="w-8 h-5 text-[var(--muted)]" />
      )}
      <span className="text-sm">{label}</span>
    </button>
  );
}

export default function SettingsView() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [runningNightly, setRunningNightly] = useState(false);
  const [nightlyResult, setNightlyResult] = useState<any>(null);

  useEffect(() => {
    // Load settings from localStorage (or backend in future)
    const stored = localStorage.getItem("fc_settings");
    if (stored) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      } catch { }
    }
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
  };

  const saveSettings = () => {
    setSaving(true);
    localStorage.setItem("fc_settings", JSON.stringify(settings));
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 300);
  };

  const runNightlyNow = async () => {
    setRunningNightly(true);
    setNightlyResult(null);
    try {
      const result = await api.runNightly();
      setNightlyResult(result);
    } catch (err: any) {
      setNightlyResult({ error: err.message });
    }
    setRunningNightly(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-brand-400" />
        <h2 className="font-semibold text-lg">Settings</h2>
      </div>

      {/* Nightly Analysis */}
      <section className="rounded-xl bg-[var(--card)] border border-[var(--card-border)] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-400" />
          <h3 className="font-semibold text-sm">Nightly Analysis</h3>
        </div>

        <Toggle
          enabled={settings.nightly_enabled}
          onToggle={() => updateSetting("nightly_enabled", !settings.nightly_enabled)}
          label="Enable nightly LLM analysis"
        />

        {settings.nightly_enabled && (
          <div className="pl-10 space-y-3">
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Run time (IST)</label>
              <input
                type="time"
                value={settings.nightly_time}
                onChange={(e) => updateSetting("nightly_time", e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--card-border)] text-sm"
              />
              <p className="text-[10px] text-[var(--muted)] mt-1">
                Recommended: 11:00 PM – 11:59 PM IST (after all daily transactions settle)
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-[var(--card-border)] pt-3">
          <button
            onClick={runNightlyNow}
            disabled={runningNightly}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600/20 text-purple-400 text-xs font-medium hover:bg-purple-600/30 disabled:opacity-50 transition-all"
          >
            {runningNightly ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {runningNightly ? "Running Analysis..." : "Run Nightly Analysis Now"}
          </button>

          {nightlyResult && (
            <div className={`mt-3 p-3 rounded-lg text-xs ${nightlyResult.error ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
              {nightlyResult.error ? (
                <p>❌ Error: {nightlyResult.error}</p>
              ) : (
                <div className="space-y-1">
                  <p>✅ Analysis complete!</p>
                  <p>• Critical alerts: {nightlyResult.critical_count}</p>
                  <p>• Warnings: {nightlyResult.warning_count}</p>
                  <p>• Savings score: {nightlyResult.savings_score?.score}/10</p>
                  {nightlyResult.llm_summary && (
                    <p className="mt-2 text-[var(--muted)] whitespace-pre-line">{nightlyResult.llm_summary.slice(0, 200)}...</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Notifications */}
      <section className="rounded-xl bg-[var(--card)] border border-[var(--card-border)] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold text-sm">Notifications</h3>
        </div>

        <Toggle
          enabled={settings.email_notifications}
          onToggle={() => updateSetting("email_notifications", !settings.email_notifications)}
          label="Email notifications for critical alerts"
        />

        {settings.email_notifications && (
          <div className="pl-10">
            <label className="text-xs text-[var(--muted)] mb-1 block">Notification email</label>
            <input
              type="email"
              value={settings.notification_email}
              onChange={(e) => updateSetting("notification_email", e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--card-border)] text-sm"
            />
            <p className="text-[10px] text-[var(--muted)] mt-1">
              Set NOTIFICATION_EMAIL env var on Render to match this.
            </p>
          </div>
        )}
      </section>

      {/* AI / LLM */}
      <section className="rounded-xl bg-[var(--card)] border border-[var(--card-border)] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-brand-400" />
          <h3 className="font-semibold text-sm">AI & LLM</h3>
        </div>

        <Toggle
          enabled={settings.llm_enabled}
          onToggle={() => updateSetting("llm_enabled", !settings.llm_enabled)}
          label="Enable LLM-powered features (categorization, insights, nightly)"
        />

        {settings.llm_enabled && (
          <div className="pl-10 space-y-3">
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Monthly LLM budget (₹)</label>
              <input
                type="number"
                value={settings.llm_budget_monthly}
                onChange={(e) => updateSetting("llm_budget_monthly", Number(e.target.value))}
                className="w-24 px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--card-border)] text-sm"
              />
              <p className="text-[10px] text-[var(--muted)] mt-1">
                Typical usage: ₹5-15/month. Disable nightly analysis to reduce cost.
              </p>
            </div>
            <div className="p-2 rounded-lg bg-white/5 text-xs text-[var(--muted)]">
              <p>Estimated usage this month: ₹{settings.llm_usage_this_month}</p>
              <p>• Categorization: ~₹0.005/merchant (cached after first call)</p>
              <p>• Nightly analysis: ~₹0.05/run × 30 = ₹1.50/month</p>
              <p>• AI insights: ~₹0.05/call</p>
            </div>
          </div>
        )}
      </section>

      {/* Pipeline & Processing */}
      <section className="rounded-xl bg-[var(--card)] border border-[var(--card-border)] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-emerald-400" />
          <h3 className="font-semibold text-sm">Pipeline & Processing</h3>
        </div>

        <Toggle
          enabled={settings.auto_categorize_on_upload}
          onToggle={() => updateSetting("auto_categorize_on_upload", !settings.auto_categorize_on_upload)}
          label="Auto-categorize transactions on upload"
        />
        <Toggle
          enabled={settings.auto_reconcile_on_upload}
          onToggle={() => updateSetting("auto_reconcile_on_upload", !settings.auto_reconcile_on_upload)}
          label="Auto-reconcile (UTR matching) on upload"
        />
        <Toggle
          enabled={settings.duplicate_check_enabled}
          onToggle={() => updateSetting("duplicate_check_enabled", !settings.duplicate_check_enabled)}
          label="Block duplicate file uploads"
        />
      </section>

      {/* Financial Planning */}
      <section className="rounded-xl bg-[var(--card)] border border-[var(--card-border)] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-400" />
          <h3 className="font-semibold text-sm">Financial Planning Defaults</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[var(--muted)] mb-1 block">Tax bracket (%)</label>
            <select
              value={settings.tax_bracket}
              onChange={(e) => updateSetting("tax_bracket", Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--card-border)] text-sm"
            >
              <option value={5}>5% (₹3-6L)</option>
              <option value={10}>10% (₹6-9L, new regime)</option>
              <option value={15}>15% (₹9-12L, new regime)</option>
              <option value={20}>20% (₹12-15L, new regime)</option>
              <option value={30}>30% (₹15L+, old regime)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] mb-1 block">Emergency fund target</label>
            <select
              value={settings.emergency_fund_target_months}
              onChange={(e) => updateSetting("emergency_fund_target_months", Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--card-border)] text-sm"
            >
              <option value={3}>3 months</option>
              <option value={6}>6 months (recommended)</option>
              <option value={9}>9 months</option>
              <option value={12}>12 months (conservative)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] mb-1 block">Budget alert threshold (%)</label>
            <input
              type="number"
              value={settings.budget_alert_threshold}
              onChange={(e) => updateSetting("budget_alert_threshold", Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--card-border)] text-sm"
              min={50}
              max={95}
            />
            <p className="text-[10px] text-[var(--muted)] mt-1">Alert when budget reaches this %</p>
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] mb-1 block">FY start month</label>
            <select
              value={settings.fy_start_month}
              onChange={(e) => updateSetting("fy_start_month", Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--card-border)] text-sm"
            >
              <option value={1}>January (Calendar year)</option>
              <option value={4}>April (Indian FY)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="rounded-xl bg-[var(--card)] border border-[var(--card-border)] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-400" />
          <h3 className="font-semibold text-sm">Security</h3>
        </div>
        <div className="text-xs text-[var(--muted)] space-y-2">
          <p>• All uploaded PDFs are encrypted at rest (Fernet/AES-256)</p>
          <p>• JWT token expires after 24 hours</p>
          <p>• 2-step authentication (email + OTP)</p>
          <p>• Rate limiting: 5 failed login attempts = 5 min lockout</p>
          <p>• Admin credentials stored in Render env vars (not in DB)</p>
        </div>
        <div className="pt-2 border-t border-[var(--card-border)]">
          <p className="text-xs text-[var(--muted)] mb-2">To change password/OTP, update these on Render:</p>
          <code className="text-[10px] text-brand-400 block bg-white/5 p-2 rounded">
            ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_OTP
          </code>
        </div>
      </section>

      {/* Save button */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            saved
              ? "bg-emerald-600 text-white"
              : "bg-brand-600 text-white hover:bg-brand-700"
          } disabled:opacity-50`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved ✓" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}



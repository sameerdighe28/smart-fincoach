"use client";
import { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, Minus, Wallet, ArrowUpRight, ArrowDownRight,
  Repeat, Sparkles, Bell, PieChart as PieIcon
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip
} from "recharts";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { DashboardResponse, MonthSummary, CategorySpend, Alert } from "@/lib/types";

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#78716c",
];

function StatCard({ label, value, icon: Icon, trend, color }: {
  label: string; value: string; icon: any; trend?: string; color: string;
}) {
  return (
    <div className="rounded-xl bg-[var(--card)] border border-[var(--card-border)] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--muted)] uppercase tracking-wide">{label}</span>
        <Icon className={`w-4 h-4`} style={{ color }} />
      </div>
      <p className="text-xl font-bold">{value}</p>
      {trend && <p className="text-xs text-[var(--muted)] mt-1">{trend}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const loadInsight = async () => {
    setLoadingInsight(true);
    try {
      const res = await api.getAiInsight();
      setInsight(res.insight);
    } catch { }
    setLoadingInsight(false);
  };

  if (error) return (
    <div className="text-center py-12 text-[var(--muted)]">
      <p>No data yet. Upload your first bank statement to get started!</p>
    </div>
  );
  if (!data) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const { current_month: cur, previous_month: prev, savings_trend, category_breakdown, alerts } = data;

  const trendIcon = savings_trend === "IMPROVING" ? TrendingUp : savings_trend === "DECLINING" ? TrendingDown : Minus;
  const trendColor = savings_trend === "IMPROVING" ? "#22c55e" : savings_trend === "DECLINING" ? "#ef4444" : "#71717a";
  const trendText = prev
    ? `${savings_trend.toLowerCase()} vs last month (${prev.savings_rate}%)`
    : "";

  const pieData = category_breakdown.map((c, i) => ({
    name: `${c.category_icon} ${c.category_name}`,
    value: Number(c.total),
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Income" value={formatCurrency(Number(cur.total_income))} icon={ArrowDownRight} color="#22c55e" />
        <StatCard label="Expenses" value={formatCurrency(Number(cur.total_expense))} icon={ArrowUpRight} color="#ef4444" />
        <StatCard
          label="Savings"
          value={formatCurrency(Number(cur.savings))}
          icon={trendIcon}
          color={trendColor}
          trend={`${cur.savings_rate}% rate — ${trendText}`}
        />
        <StatCard label="Transfers" value={formatCurrency(Number(cur.total_transfer))} icon={Repeat} color="#6366f1" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Category pie */}
        <div className="rounded-xl bg-[var(--card)] border border-[var(--card-border)] p-4">
          <div className="flex items-center gap-2 mb-4">
            <PieIcon className="w-4 h-4 text-brand-400" />
            <h3 className="font-semibold text-sm">Spending by Category</h3>
          </div>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 text-xs">
                {pieData.slice(0, 6).map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-[var(--muted)]">{d.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)] text-center py-8">No categorized expenses yet</p>
          )}
        </div>

        {/* Alerts */}
        <div className="rounded-xl bg-[var(--card)] border border-[var(--card-border)] p-4">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-sm">Alerts</h3>
          </div>
          {alerts.length > 0 ? (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {alerts.map((a: Alert) => (
                <div key={a.id} className={`p-2.5 rounded-lg text-xs ${
                  a.alert_type === "THRESHOLD" ? "bg-red-500/10 border border-red-500/20" :
                  a.alert_type === "RUNRATE" ? "bg-amber-500/10 border border-amber-500/20" :
                  "bg-blue-500/10 border border-blue-500/20"
                }`}>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-[var(--muted)] mt-0.5">{a.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)] text-center py-8">No alerts — you&apos;re doing great! 🎉</p>
          )}
        </div>
      </div>

      {/* AI Insight */}
      <div className="rounded-xl bg-gradient-to-r from-brand-600/20 to-purple-600/20 border border-brand-500/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" />
            <h3 className="font-semibold text-sm">AI Finance Coach</h3>
          </div>
          {!insight && (
            <button
              onClick={loadInsight}
              disabled={loadingInsight}
              className="px-3 py-1 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-50 transition-all"
            >
              {loadingInsight ? "Thinking..." : "Get Insight"}
            </button>
          )}
        </div>
        {insight ? (
          <p className="text-sm leading-relaxed whitespace-pre-line">{insight}</p>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Click &quot;Get Insight&quot; for a personalized AI analysis of your spending patterns and saving tips.
          </p>
        )}
      </div>
    </div>
  );
}


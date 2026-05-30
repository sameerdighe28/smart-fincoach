"use client";
import { useEffect, useState } from "react";
import {
  Shield, TrendingUp, Heart, Wallet, PieChart as PieIcon,
  IndianRupee, AlertTriangle, CheckCircle, XCircle, Info
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

function HealthBadge({ health }: { health: string }) {
  const config: Record<string, { color: string; icon: any }> = {
    EXCELLENT: { color: "text-emerald-400 bg-emerald-500/10", icon: CheckCircle },
    GOOD: { color: "text-emerald-400 bg-emerald-500/10", icon: CheckCircle },
    HEALTHY: { color: "text-emerald-400 bg-emerald-500/10", icon: CheckCircle },
    MODERATE: { color: "text-amber-400 bg-amber-500/10", icon: Info },
    WARNING: { color: "text-amber-400 bg-amber-500/10", icon: AlertTriangle },
    CRITICAL: { color: "text-red-400 bg-red-500/10", icon: XCircle },
  };
  const c = config[health] || config.MODERATE;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${c.color}`}>
      <Icon className="w-3 h-3" /> {health}
    </span>
  );
}

function ProgressBar({ value, max, color = "bg-brand-500" }: { value: number; max: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function FinancialHealthView() {
  const [healthScore, setHealthScore] = useState<any>(null);
  const [fySummary, setFySummary] = useState<any>(null);
  const [taxPlanning, setTaxPlanning] = useState<any>(null);
  const [dti, setDti] = useState<any>(null);
  const [emergency, setEmergency] = useState<any>(null);
  const [fixedVar, setFixedVar] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [hs, fy, tax, d, ef, fv] = await Promise.all([
          api.getHealthScore(),
          api.getFySummary(),
          api.getTaxPlanning(),
          api.getDebtToIncome(),
          api.getEmergencyFund(),
          api.getFixedVsVariable(),
        ]);
        setHealthScore(hs);
        setFySummary(fy);
        setTaxPlanning(tax);
        setDti(d);
        setEmergency(ef);
        setFixedVar(fv);
      } catch { }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Overall Health Score */}
      {healthScore && (
        <div className="rounded-xl bg-gradient-to-r from-brand-600/20 to-emerald-600/20 border border-brand-500/30 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-brand-400" />
              <h2 className="font-semibold">Financial Health Score</h2>
            </div>
            <div className="text-3xl font-bold">
              <span className={healthScore.score >= 65 ? "text-emerald-400" : healthScore.score >= 40 ? "text-amber-400" : "text-red-400"}>
                {healthScore.score}
              </span>
              <span className="text-sm text-[var(--muted)]">/100</span>
              <span className="ml-2 text-lg font-bold px-2 py-0.5 rounded bg-white/10">
                {healthScore.grade}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="p-2 rounded-lg bg-white/5">
              <p className="text-xs text-[var(--muted)]">Savings Rate</p>
              <p className="font-bold text-sm">{healthScore.quick_summary.savings_rate}%</p>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <p className="text-xs text-[var(--muted)]">Debt-to-Income</p>
              <p className="font-bold text-sm">{healthScore.quick_summary.dti_ratio}%</p>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <p className="text-xs text-[var(--muted)]">Emergency Fund</p>
              <p className="font-bold text-sm">{healthScore.quick_summary.emergency_months} mo</p>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <p className="text-xs text-[var(--muted)]">Investment Rate</p>
              <p className="font-bold text-sm">{healthScore.quick_summary.investment_rate}%</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* FY Summary */}
        {fySummary && (
          <div className="rounded-xl bg-[var(--card)] border border-[var(--card-border)] p-4">
            <div className="flex items-center gap-2 mb-4">
              <IndianRupee className="w-4 h-4 text-brand-400" />
              <h3 className="font-semibold text-sm">{fySummary.fy_label} Summary</h3>
              <span className="text-xs text-[var(--muted)]">({fySummary.months_elapsed} months)</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Total Income</span>
                <span className="text-emerald-400 font-medium">{formatCurrency(fySummary.total_income)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Total Expenses</span>
                <span className="text-red-400 font-medium">{formatCurrency(fySummary.total_expense)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Investments</span>
                <span className="text-purple-400 font-medium">{formatCurrency(fySummary.total_investment)}</span>
              </div>
              <div className="border-t border-[var(--card-border)] pt-2 flex justify-between">
                <span className="font-medium">Net Savings</span>
                <span className={`font-bold ${fySummary.total_savings >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatCurrency(fySummary.total_savings)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-[var(--muted)]">
                <span>Avg Monthly: {formatCurrency(fySummary.avg_monthly_savings)}/mo</span>
                <span>Rate: {fySummary.savings_rate}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Debt-to-Income */}
        {dti && (
          <div className="rounded-xl bg-[var(--card)] border border-[var(--card-border)] p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-brand-400" />
                <h3 className="font-semibold text-sm">Debt-to-Income Ratio</h3>
              </div>
              <HealthBadge health={dti.health} />
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[var(--muted)]">EMI / Income</span>
                  <span className="font-medium">{dti.dti_ratio}% (limit: {dti.bank_limit_pct}%)</span>
                </div>
                <ProgressBar
                  value={dti.dti_ratio}
                  max={dti.bank_limit_pct}
                  color={dti.dti_ratio > 40 ? "bg-red-500" : dti.dti_ratio > 30 ? "bg-amber-500" : "bg-emerald-500"}
                />
              </div>
              <div className="text-xs space-y-1 text-[var(--muted)]">
                <div className="flex justify-between">
                  <span>Monthly Income</span>
                  <span>{formatCurrency(dti.avg_monthly_income)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly EMI</span>
                  <span className="text-red-400">{formatCurrency(dti.avg_monthly_emi)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly Rent</span>
                  <span>{formatCurrency(dti.avg_monthly_rent)}</span>
                </div>
                <div className="flex justify-between font-medium text-white">
                  <span>Fixed Obligations</span>
                  <span>{dti.fixed_obligation_ratio}% of income</span>
                </div>
              </div>
              <p className="text-xs text-[var(--muted)] italic">{dti.message}</p>
            </div>
          </div>
        )}

        {/* Emergency Fund */}
        {emergency && (
          <div className="rounded-xl bg-[var(--card)] border border-[var(--card-border)] p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-400" />
                <h3 className="font-semibold text-sm">Emergency Fund</h3>
              </div>
              <HealthBadge health={emergency.health} />
            </div>
            <div className="space-y-3">
              <div className="text-center py-2">
                <p className="text-3xl font-bold">
                  {emergency.months_covered}
                  <span className="text-sm text-[var(--muted)] font-normal"> / {emergency.recommended_months} months</span>
                </p>
              </div>
              <ProgressBar
                value={emergency.months_covered}
                max={emergency.recommended_months}
                color={emergency.months_covered >= 6 ? "bg-emerald-500" : emergency.months_covered >= 3 ? "bg-amber-500" : "bg-red-500"}
              />
              <div className="text-xs space-y-1 text-[var(--muted)]">
                <div className="flex justify-between">
                  <span>Current Balance (approx)</span>
                  <span>{formatCurrency(emergency.liquid_savings)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly Expenses</span>
                  <span>{formatCurrency(emergency.avg_monthly_expense)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Target ({emergency.recommended_months} months)</span>
                  <span>{formatCurrency(emergency.target_amount)}</span>
                </div>
                {emergency.gap > 0 && (
                  <div className="flex justify-between text-amber-400 font-medium">
                    <span>Gap to fill</span>
                    <span>{formatCurrency(emergency.gap)}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-[var(--muted)] italic">{emergency.message}</p>
            </div>
          </div>
        )}

        {/* Fixed vs Variable */}
        {fixedVar && (
          <div className="rounded-xl bg-[var(--card)] border border-[var(--card-border)] p-4">
            <div className="flex items-center gap-2 mb-4">
              <PieIcon className="w-4 h-4 text-brand-400" />
              <h3 className="font-semibold text-sm">Fixed vs Variable Expenses</h3>
              <span className="text-xs text-[var(--muted)]">({fixedVar.month})</span>
            </div>
            <div className="space-y-3">
              {/* Visual bar */}
              <div className="flex h-4 rounded-full overflow-hidden">
                <div
                  className="bg-red-500/60 flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ width: `${fixedVar.fixed.pct_of_total}%` }}
                >
                  {fixedVar.fixed.pct_of_total > 15 ? `${fixedVar.fixed.pct_of_total}%` : ""}
                </div>
                <div
                  className="bg-emerald-500/60 flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ width: `${fixedVar.variable.pct_of_total}%` }}
                >
                  {fixedVar.variable.pct_of_total > 15 ? `${fixedVar.variable.pct_of_total}%` : ""}
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-red-400">🔒 Fixed: {formatCurrency(fixedVar.fixed.total)}</span>
                <span className="text-emerald-400">🎯 Variable: {formatCurrency(fixedVar.variable.total)}</span>
              </div>

              {/* Top variable items (controllable) */}
              <div className="mt-2">
                <p className="text-xs text-[var(--muted)] mb-1">Top controllable spending:</p>
                <div className="space-y-1">
                  {fixedVar.variable.items.slice(0, 4).map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span>{item.icon} {item.category}</span>
                      <span className="font-medium">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {fixedVar.controllable_savings_potential > 0 && (
                <div className="p-2 rounded-lg bg-emerald-500/10 text-xs text-emerald-400">
                  💡 Potential savings with 20% cut in variable expenses: {formatCurrency(fixedVar.controllable_savings_potential)}/month
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tax Planning */}
      {taxPlanning && (
        <div className="rounded-xl bg-[var(--card)] border border-[var(--card-border)] p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-brand-400" />
            <h3 className="font-semibold text-sm">Tax Planning — {taxPlanning.fy_label}</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {/* 80C */}
            <div className="p-3 rounded-lg bg-white/[0.02] border border-[var(--card-border)]">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-semibold uppercase text-[var(--muted)]">Section 80C</h4>
                <span className="text-xs text-[var(--muted)]">Limit: ₹1,50,000</span>
              </div>
              <ProgressBar
                value={taxPlanning.section_80c.utilized}
                max={taxPlanning.section_80c.limit}
                color={taxPlanning.section_80c.pct_used >= 100 ? "bg-emerald-500" : "bg-brand-500"}
              />
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-[var(--muted)]">Used: {formatCurrency(taxPlanning.section_80c.utilized)}</span>
                <span className="text-brand-400 font-medium">
                  Remaining: {formatCurrency(taxPlanning.section_80c.remaining)}
                </span>
              </div>
              {taxPlanning.section_80c.monthly_investment_needed > 0 && (
                <p className="text-xs text-amber-400 mt-2">
                  💡 Invest {formatCurrency(taxPlanning.section_80c.monthly_investment_needed)}/month in ELSS/PPF to max out
                </p>
              )}
              <p className="text-xs text-emerald-400 mt-1">
                Tax saved: ~{formatCurrency(taxPlanning.section_80c.potential_tax_saved)}
              </p>
            </div>

            {/* 80D */}
            <div className="p-3 rounded-lg bg-white/[0.02] border border-[var(--card-border)]">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-semibold uppercase text-[var(--muted)]">Section 80D</h4>
                <span className="text-xs text-[var(--muted)]">Limit: ₹25,000</span>
              </div>
              <ProgressBar
                value={taxPlanning.section_80d.utilized}
                max={taxPlanning.section_80d.limit}
                color={taxPlanning.section_80d.pct_used >= 100 ? "bg-emerald-500" : "bg-purple-500"}
              />
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-[var(--muted)]">Used: {formatCurrency(taxPlanning.section_80d.utilized)}</span>
                <span className="text-purple-400 font-medium">
                  Remaining: {formatCurrency(taxPlanning.section_80d.remaining)}
                </span>
              </div>
              <p className="text-xs text-emerald-400 mt-1">
                Tax saved: ~{formatCurrency(taxPlanning.section_80d.potential_tax_saved)}
              </p>
            </div>
          </div>
          <div className="mt-3 p-2 rounded-lg bg-emerald-500/10 text-center">
            <span className="text-sm font-medium text-emerald-400">
              Total tax saved this FY: ~{formatCurrency(taxPlanning.total_tax_saved)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}


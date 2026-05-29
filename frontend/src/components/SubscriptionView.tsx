"use client";
import { useEffect, useState } from "react";
import { RotateCcw, CreditCard, IndianRupee } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

interface Subscription {
  merchant: string;
  avg_amount: number;
  months_active: number;
  monthly_cost: number;
  total_cost: number;
}

export default function SubscriptionView() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSubscriptions()
      .then((data) => {
        setSubs(data.subscriptions || []);
        setTotal(data.total_monthly || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-8 text-[var(--muted)]">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-purple-400" />
          <h2 className="font-semibold">Recurring Subscriptions</h2>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-400 text-sm font-medium">
          {formatCurrency(total)}/month
        </div>
      </div>

      {subs.length === 0 ? (
        <p className="text-center py-8 text-[var(--muted)]">No recurring subscriptions detected yet. Need at least 2 months of data.</p>
      ) : (
        <div className="grid gap-3">
          {subs.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-[var(--card)] border border-[var(--card-border)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-sm capitalize">{s.merchant}</p>
                  <p className="text-xs text-[var(--muted)]">Active {s.months_active} months • Total {formatCurrency(s.total_cost)}</p>
                </div>
              </div>
              <span className="text-sm font-semibold">{formatCurrency(s.monthly_cost)}/mo</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


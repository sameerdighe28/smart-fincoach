"use client";
import { useEffect, useState } from "react";
import { Search, Filter, ArrowUpRight, ArrowDownRight, Link2, Unlink } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, SOURCE_LABELS } from "@/lib/utils";
import type { Transaction, Category } from "@/lib/types";

const TYPE_BADGES: Record<string, { color: string; label: string }> = {
  EXPENSE: { color: "bg-red-500/20 text-red-400", label: "Expense" },
  INCOME: { color: "bg-emerald-500/20 text-emerald-400", label: "Income" },
  TRANSFER: { color: "bg-blue-500/20 text-blue-400", label: "Transfer" },
  REFUND: { color: "bg-amber-500/20 text-amber-400", label: "Refund" },
  INVESTMENT: { color: "bg-purple-500/20 text-purple-400", label: "Investment" },
};

const RECON_BADGES: Record<string, { icon: any; color: string; tip: string }> = {
  UTR_EXACT: { icon: Link2, color: "text-emerald-400", tip: "UTR matched" },
  AMOUNT_DATE_FUZZY: { icon: Link2, color: "text-amber-400", tip: "Fuzzy matched" },
  MANUAL: { icon: Link2, color: "text-blue-400", tip: "Manually matched" },
  UNMATCHED: { icon: Unlink, color: "text-[var(--muted)]", tip: "Unmatched" },
};

export default function TransactionList() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (filterSource) params.source = filterSource;
      if (filterMonth) params.month = filterMonth;
      const [t, c] = await Promise.all([api.getTransactions(params), api.getCategories()]);
      setTxns(t);
      setCategories(c);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterSource, filterMonth]);

  const handleCategoryChange = async (txnId: string, categoryId: string) => {
    try {
      await api.updateTransaction(txnId, { category_id: categoryId });
      load();
    } catch { }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search narration, merchant..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--card-border)] text-sm focus:outline-none focus:border-brand-500"
          />
        </div>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--card-border)] text-sm focus:outline-none"
        >
          <option value="">All Sources</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--card-border)] text-sm focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl bg-[var(--card)] border border-[var(--card-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)] text-xs text-[var(--muted)] uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-center">Match</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-[var(--muted)]">Loading...</td></tr>
              ) : txns.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-[var(--muted)]">No transactions found</td></tr>
              ) : txns.map((t) => {
                const typeBadge = TYPE_BADGES[t.transaction_type] || TYPE_BADGES.EXPENSE;
                const reconBadge = RECON_BADGES[t.reconciliation_method] || RECON_BADGES.UNMATCHED;
                const ReconIcon = reconBadge.icon;
                return (
                  <tr key={t.id} className="border-b border-[var(--card-border)] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--muted)]">{formatDate(t.txn_date)}</td>
                    <td className="px-4 py-3 max-w-[300px]">
                      <p className="truncate font-medium">
                        {t.counterparty_name || t.raw_narration.slice(0, 60)}
                      </p>
                      {t.payment_app_note && (
                        <p className="text-xs text-[var(--muted)] truncate">{t.payment_app_note}</p>
                      )}
                      {t.utr && (
                        <p className="text-[10px] text-[var(--muted)] font-mono">UTR: {t.utr}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[var(--muted)]">{SOURCE_LABELS[t.source_type] || t.source_type}</span>
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${t.is_debit ? "text-red-400" : "text-emerald-400"}`}>
                      {t.is_debit ? "-" : "+"}{formatCurrency(Number(t.amount))}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${typeBadge.color}`}>
                        {typeBadge.label}
                      </span>
                      {t.is_self_transfer && (
                        <span className="ml-1 inline-block px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400">Self</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={t.category_name || ""}
                        onChange={(e) => {
                          const cat = categories.find(c => c.name === e.target.value);
                          if (cat) handleCategoryChange(t.id, cat.id);
                        }}
                        className="bg-transparent text-xs border border-[var(--card-border)] rounded px-1.5 py-1 focus:outline-none focus:border-brand-500 max-w-[120px]"
                      >
                        <option value="">Uncategorized</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center" title={reconBadge.tip}>
                      <ReconIcon className={`w-4 h-4 mx-auto ${reconBadge.color}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


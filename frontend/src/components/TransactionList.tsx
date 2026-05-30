"use client";
import { useEffect, useState } from "react";
import { Search, ArrowUpRight, ArrowDownRight, Link2, Unlink, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
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

type DatePreset = "this_week" | "last_week" | "this_month" | "last_month" | "custom" | "";

function getDateRange(preset: DatePreset): { from?: string; to?: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  switch (preset) {
    case "this_week": {
      const day = now.getDay() || 7;
      const start = new Date(now);
      start.setDate(now.getDate() - day + 1);
      return { from: fmt(start), to: fmt(now) };
    }
    case "last_week": {
      const day = now.getDay() || 7;
      const end = new Date(now);
      end.setDate(now.getDate() - day);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      return { from: fmt(start), to: fmt(end) };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fmt(start), to: fmt(now) };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmt(start), to: fmt(end) };
    }
    default:
      return {};
  }
}

const PAGE_SIZE = 50;

export default function TransactionList() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const load = async (pageNum = page) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (filterSource) params.source = filterSource;

      // Date filtering
      if (datePreset === "custom") {
        if (customFrom) params.date_from = customFrom;
        if (customTo) params.date_to = customTo;
      } else if (datePreset) {
        const range = getDateRange(datePreset);
        if (range.from) params.date_from = range.from;
        if (range.to) params.date_to = range.to;
      }

      params.limit = String(PAGE_SIZE);
      params.offset = String(pageNum * PAGE_SIZE);

      const [t, c] = await Promise.all([api.getTransactions(params), api.getCategories()]);
      setTxns(t);
      setCategories(c);
      setHasMore(t.length === PAGE_SIZE);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { setPage(0); load(0); }, [filterSource, datePreset, customFrom, customTo]);

  useEffect(() => { load(); }, [page]);

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
            onKeyDown={(e) => e.key === "Enter" && load(0)}
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
        <select
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value as DatePreset)}
          className="px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--card-border)] text-sm focus:outline-none"
        >
          <option value="">All Time</option>
          <option value="this_week">This Week</option>
          <option value="last_week">Last Week</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="custom">Custom Date</option>
        </select>
      </div>

      {/* Custom date range */}
      {datePreset === "custom" && (
        <div className="flex gap-3 items-center">
          <Calendar className="w-4 h-4 text-[var(--muted)]" />
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--card-border)] text-sm"
          />
          <span className="text-xs text-[var(--muted)]">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--card-border)] text-sm"
          />
        </div>
      )}

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

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--card-border)]">
          <span className="text-xs text-[var(--muted)]">
            Page {page + 1} • Showing {txns.length} transactions
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!hasMore}
              className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

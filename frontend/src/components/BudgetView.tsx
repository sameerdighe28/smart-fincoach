"use client";
import { useEffect, useState } from "react";
import { Gauge, Plus, Wand2, Trash2, Pencil, Check, X } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { Budget, Category } from "@/lib/types";

export default function BudgetView() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newCatId, setNewCatId] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [b, c] = await Promise.all([api.getBudgets(), api.getCategories()]);
      setBudgets(b);
      setCategories(c);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addBudget = async () => {
    if (!newCatId || !newAmount) return;
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    try {
      await api.createBudget({ category_id: newCatId, month, limit_amount: Number(newAmount) });
      setShowAdd(false);
      setNewCatId("");
      setNewAmount("");
      load();
    } catch { }
  };

  const deleteBudget = async (id: string) => {
    if (!confirm("Delete this budget?")) return;
    try {
      await api.deleteBudget(id);
      load();
    } catch { }
  };

  const startEdit = (b: Budget) => {
    setEditingId(b.id);
    setEditAmount(String(b.limit_amount));
  };

  const saveEdit = async () => {
    if (!editingId || !editAmount) return;
    try {
      await api.updateBudget(editingId, { limit_amount: Number(editAmount) });
      setEditingId(null);
      load();
    } catch { }
  };

  const generateAdaptive = async () => {
    try {
      await api.generateAdaptive();
      load();
    } catch { }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="w-5 h-5 text-brand-400" />
          <h2 className="font-semibold">Monthly Budgets</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generateAdaptive}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-400 text-xs font-medium hover:bg-purple-600/30 transition-all"
          >
            <Wand2 className="w-3.5 h-3.5" /> Auto-Generate
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add Budget
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="flex gap-3 items-end p-4 rounded-xl bg-[var(--card)] border border-[var(--card-border)]">
          <div className="flex-1">
            <label className="text-xs text-[var(--muted)] mb-1 block">Category</label>
            <select
              value={newCatId}
              onChange={(e) => setNewCatId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--card-border)] text-sm"
            >
              <option value="">Select category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div className="w-32">
            <label className="text-xs text-[var(--muted)] mb-1 block">Limit (₹)</label>
            <input
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--card-border)] text-sm"
              placeholder="5000"
            />
          </div>
          <button onClick={addBudget} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium">
            Save
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-[var(--muted)]">Loading...</div>
      ) : budgets.length === 0 ? (
        <div className="text-center py-8 text-[var(--muted)]">
          <p>No budgets set. Click &quot;Auto-Generate&quot; to create adaptive budgets from your history.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {budgets.map((b) => {
            const pct = b.pct_used || 0;
            const barColor = pct >= 100 ? "bg-red-500" : pct >= b.alert_threshold_pct ? "bg-amber-500" : "bg-brand-500";
            const isEditing = editingId === b.id;
            return (
              <div key={b.id} className="p-4 rounded-xl bg-[var(--card)] border border-[var(--card-border)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{b.category_name}</span>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-20 px-2 py-0.5 rounded bg-[var(--background)] border border-[var(--card-border)] text-xs"
                        />
                        <button onClick={saveEdit} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingId(null)} className="text-red-400 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs text-[var(--muted)]">
                          {formatCurrency(Number(b.spent || 0))} / {formatCurrency(Number(b.limit_amount))}
                        </span>
                        <button onClick={() => startEdit(b)} className="text-[var(--muted)] hover:text-white"><Pencil className="w-3 h-3" /></button>
                        <button onClick={() => deleteBudget(b.id)} className="text-[var(--muted)] hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                      </>
                    )}
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-[var(--muted)]">{pct.toFixed(0)}% used</span>
                  <span className={`text-xs font-medium ${Number(b.remaining) < 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {Number(b.remaining) < 0 ? "Over by " : ""}
                    {formatCurrency(Math.abs(Number(b.remaining || 0)))} {Number(b.remaining) >= 0 ? "left" : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

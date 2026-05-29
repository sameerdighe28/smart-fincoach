const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Health
  health: () => fetchAPI<{ status: string }>("/api/health"),

  // Uploads
  upload: async (file: File, sourceType: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("source_type", sourceType);
    const res = await fetch(`${API_BASE}/api/uploads/`, { method: "POST", body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Upload failed ${res.status}`);
    }
    return res.json();
  },
  getUploads: () => fetchAPI<any[]>("/api/uploads/"),

  // Transactions
  getTransactions: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return fetchAPI<any[]>(`/api/transactions/${qs}`);
  },
  updateTransaction: (id: string, body: Record<string, unknown>) =>
    fetchAPI<any>(`/api/transactions/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  // Categories
  getCategories: () => fetchAPI<any[]>("/api/categories"),
  createCategory: (body: { name: string; icon?: string; color?: string }) =>
    fetchAPI<any>("/api/categories", { method: "POST", body: JSON.stringify(body) }),

  // Budgets
  getBudgets: (month?: string) => {
    const qs = month ? `?month=${month}` : "";
    return fetchAPI<any[]>(`/api/budgets${qs}`);
  },
  createBudget: (body: { category_id: string; month: string; limit_amount: number }) =>
    fetchAPI<any>("/api/budgets", { method: "POST", body: JSON.stringify(body) }),
  generateAdaptive: () => fetchAPI<any>("/api/budgets/generate-adaptive", { method: "POST" }),

  // Dashboard & Insights
  getDashboard: () => fetchAPI<any>("/api/dashboard"),
  getAiInsight: () => fetchAPI<{ insight: string }>("/api/insights/ai"),
  getSubscriptions: () => fetchAPI<any>("/api/insights/subscriptions"),

  // Alerts
  getAlerts: (unreadOnly?: boolean) => {
    const qs = unreadOnly ? "?unread_only=true" : "";
    return fetchAPI<any[]>(`/api/alerts${qs}`);
  },
  markAlertRead: (id: string) => fetchAPI<any>(`/api/alerts/${id}/read`, { method: "PATCH" }),

  // Pipeline
  runPipeline: () => fetchAPI<any>("/api/pipeline/run", { method: "POST" }),
};


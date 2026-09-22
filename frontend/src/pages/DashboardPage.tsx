import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { loadAuthSession } from "../lib/auth";
import { getErrorMessage, request } from "../lib/api";

type TransactionType = "income" | "expense";
type TrendMetric = "income" | "expenses" | "balance";

interface Category {
  id: string;
  name: string;
  color: string;
  description: string;
  ownerUserId?: string | null;
  createdAt?: string;
  updatedAt: string;
}

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  categoryId: string | null;
  ownerUserId?: string | null;
  description: string;
  date: string;
  categoryDetails?: Category | null;
}

interface SummaryResponse {
  month?: string;
  totals: {
    income: number;
    expenses: number;
    balance: number;
  };
  byCategory?: {
    income?: Record<string, number>;
    expenses?: Record<string, number>;
  };
  transactionCount?: number;
}

interface TrendEntry {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}

interface TrendsResponse {
  months: number;
  trends: TrendEntry[];
}

interface DashboardOverview {
  totals: {
    transactions: number;
    users: number;
    categories: number;
  };
  groupedCounts?: Record<string, number>;
  recentTransactions: Transaction[];
}

interface TransactionForm {
  type: TransactionType;
  amount: string;
  categoryId: string;
  category: string;
  description: string;
  date: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount || 0);
}

function getCurrentMonth() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function buildDashboardQuery(selectedMonth: string, selectedCategory: string) {
  const params = new URLSearchParams();

  if (selectedMonth) {
    params.set("month", selectedMonth);
  }

  if (selectedCategory) {
    params.set("category", selectedCategory);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

function getBreakdownEntries(group: Record<string, number> = {}) {
  return Object.entries(group)
    .map(([name, amount]) => ({ name, amount: Number(amount) || 0 }))
    .sort((a, b) => b.amount - a.amount);
}

function getTrendPresentation(metric: TrendMetric) {
  if (metric === "income") {
    return { label: "Income", className: "income", accent: "#10b981" };
  }

  if (metric === "expenses") {
    return { label: "Expenses", className: "expense", accent: "#ef4444" };
  }

  return { label: "Balance", className: "balance", accent: "#2563eb" };
}

export default function DashboardPage() {
  const session = loadAuthSession();
  const isAdmin = session?.user.role === "admin";
  const currentUserId = session?.user.id ?? null;
  const [month, setMonth] = useState(getCurrentMonth());
  const [categoryFilter, setCategoryFilter] = useState("");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("balance");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [trends, setTrends] = useState<TrendEntry[]>([]);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TransactionForm>({
    type: "expense",
    amount: "",
    categoryId: "",
    category: "",
    description: "",
    date: ""
  });
  const [form, setForm] = useState<TransactionForm>({
    type: "expense",
    amount: "",
    categoryId: "",
    category: "",
    description: "",
    date: new Date().toISOString().slice(0, 10)
  });

  async function loadDashboard(selectedMonth: string, selectedCategory: string) {
    setLoading(true);
    setError("");

    try {
      const query = buildDashboardQuery(selectedMonth, selectedCategory);
      const [txData, summaryData, trendData, overviewData, categoryData] = await Promise.all([
        request<Transaction[]>(`/api/transactions${query}`),
        request<SummaryResponse>(`/api/summary${query}`),
        request<TrendsResponse>("/api/trends?months=6"),
        request<DashboardOverview>("/api/dashboard"),
        request<Category[]>("/api/categories")
      ]);

      setTransactions(txData);
      setSummary(summaryData);
      setTrends(trendData.trends || []);
      setOverview(overviewData);
      setCategories(categoryData);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard(month, categoryFilter);
  }, [month, categoryFilter]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      await request<Transaction>("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          ...(form.categoryId ? { categoryId: form.categoryId } : {}),
          amount: Number(form.amount)
        })
      });

      setForm((prev) => ({
        ...prev,
        amount: "",
        categoryId: "",
        category: "",
        description: ""
      }));
      await loadDashboard(month, categoryFilter);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  }

  function startEditing(item: Transaction) {
    const matchedCategory =
      categories.find((entry) => entry.id === item.categoryId) ??
      categories.find((entry) => entry.name.toLowerCase() === String(item.category).toLowerCase());

    setEditingId(item.id);
    setEditForm({
      type: item.type,
      amount: String(item.amount),
      categoryId: matchedCategory?.id ?? item.categoryId ?? "",
      category: item.category,
      description: item.description || "",
      date: new Date(item.date).toISOString().slice(0, 10)
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setEditForm({
      type: "expense",
      amount: "",
      categoryId: "",
      category: "",
      description: "",
      date: ""
    });
  }

  async function handleUpdate(itemId: string) {
    setError("");

    try {
      await request<Transaction>(`/api/transactions/${itemId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...editForm,
          ...(editForm.categoryId ? { categoryId: editForm.categoryId } : {}),
          amount: Number(editForm.amount)
        })
      });

      cancelEditing();
      await loadDashboard(month, categoryFilter);
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    }
  }

  async function handleDelete(itemId: string) {
    setError("");

    try {
      await request<Transaction>(`/api/transactions/${itemId}`, {
        method: "DELETE"
      });

      if (editingId === itemId) {
        cancelEditing();
      }

      await loadDashboard(month, categoryFilter);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    }
  }

  const totals = summary?.totals ?? { income: 0, expenses: 0, balance: 0 };
  const appTotals = overview?.totals ?? { transactions: 0, users: 0, categories: 0 };
  const expenseBreakdown = getBreakdownEntries(summary?.byCategory?.expenses);
  const incomeBreakdown = getBreakdownEntries(summary?.byCategory?.income);
  const maxBreakdownAmount = Math.max(
    1,
    ...expenseBreakdown.map((entry) => entry.amount),
    ...incomeBreakdown.map((entry) => entry.amount)
  );
  const trendPresentation = getTrendPresentation(trendMetric);
  const maxTrendAmount = Math.max(1, ...trends.map((entry) => Math.abs(entry[trendMetric]) || 0));
  const ownCategoriesCount = currentUserId
    ? categories.filter((item) => item.ownerUserId === currentUserId).length
    : categories.length;
  const ownTransactionsCount = currentUserId
    ? transactions.filter((item) => item.ownerUserId === currentUserId).length
    : transactions.length;
  const visibleCategoriesCount = isAdmin ? appTotals.categories : ownCategoriesCount;
  const visibleTransactionsCount = isAdmin ? appTotals.transactions : ownTransactionsCount;

  const orderedTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [transactions]
  );

  return (
    <main className="page">
      <section className="panel">
        <p className="eyebrow">Dashboard</p>
        <h1>Expense Tracker / Budget Dashboard</h1>
        <p className="section-copy">
          Track transactions, review monthly totals, inspect trend data, and manage model
          relationships with categories.
        </p>
      </section>

      <section className="grid">
        <article className="panel">
          <h3>Total Transactions</h3>
          <p className="metric">{visibleTransactionsCount}</p>
        </article>
        {isAdmin ? (
          <article className="panel">
            <h3>Total Users</h3>
            <p className="metric">{appTotals.users}</p>
          </article>
        ) : null}
        <article className="panel">
          <h3>Total Categories</h3>
          <p className="metric">{visibleCategoriesCount}</p>
        </article>
      </section>

      <section className="panel">
        <h2>Log Transaction</h2>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Type
            <select
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, type: event.target.value as TransactionType }))
              }
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>

          <label>
            Amount
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.amount}
              onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
            />
          </label>

          <label>
            Category
            <input
              type="text"
              required
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            />
          </label>

          <label>
            Linked Category
            <select
              value={form.categoryId}
              onChange={(event) => {
                const selectedId = event.target.value;
                const selectedCategory = categories.find((entry) => entry.id === selectedId);

                setForm((prev) => ({
                  ...prev,
                  categoryId: selectedId,
                  category: selectedCategory?.name ?? prev.category
                }));
              }}
            >
              <option value="">None</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Date
            <input
              type="date"
              required
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
            />
          </label>

          <label className="span-2">
            Description
            <input
              type="text"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </label>

          <button type="submit">Save Transaction</button>
        </form>
      </section>

      <section className="panel filters">
        <h2>Filters</h2>
        <div className="filter-grid">
          <label>
            Month
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>

          <label>
            Category
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p>Loading...</p> : null}

      <section className="grid">
        <article className="panel">
          <h3>Income</h3>
          <p className="metric">{formatCurrency(totals.income)}</p>
        </article>
        <article className="panel">
          <h3>Expenses</h3>
          <p className="metric">{formatCurrency(totals.expenses)}</p>
        </article>
        <article className="panel">
          <h3>Balance</h3>
          <p className="metric">{formatCurrency(totals.balance)}</p>
        </article>
      </section>

      <section className="grid grid-2">
        <article className="panel">
          <h2>Expense Breakdown</h2>
          <div className="breakdown-list" aria-label="Expense breakdown by category">
            {expenseBreakdown.length ? (
              expenseBreakdown.map((entry) => (
                <div key={`expense-${entry.name}`} className="breakdown-item">
                  <div className="breakdown-labels">
                    <span>{entry.name}</span>
                    <strong>{formatCurrency(entry.amount)}</strong>
                  </div>
                  <div className="breakdown-bar-shell">
                    <div
                      className="breakdown-bar expense"
                      style={{ width: `${(entry.amount / maxBreakdownAmount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">No expense categories for the current filter.</p>
            )}
          </div>
        </article>

        <article className="panel">
          <h2>Income Breakdown</h2>
          <div className="breakdown-list" aria-label="Income breakdown by category">
            {incomeBreakdown.length ? (
              incomeBreakdown.map((entry) => (
                <div key={`income-${entry.name}`} className="breakdown-item">
                  <div className="breakdown-labels">
                    <span>{entry.name}</span>
                    <strong>{formatCurrency(entry.amount)}</strong>
                  </div>
                  <div className="breakdown-bar-shell">
                    <div
                      className="breakdown-bar income"
                      style={{ width: `${(entry.amount / maxBreakdownAmount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">No income categories for the current filter.</p>
            )}
          </div>
        </article>
      </section>

      <section className="panel">
        <h2>Recent Transactions</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orderedTransactions.map((item) => {
                const isEditing = editingId === item.id;

                return (
                  <tr key={item.id}>
                    <td>
                      {isEditing ? (
                        <input
                          type="date"
                          value={editForm.date}
                          onChange={(event) =>
                            setEditForm((prev) => ({ ...prev, date: event.target.value }))
                          }
                        />
                      ) : (
                        new Date(item.date).toLocaleDateString()
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          value={editForm.type}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              type: event.target.value as TransactionType
                            }))
                          }
                        >
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                        </select>
                      ) : (
                        item.type
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div className="cell-stack">
                          <input
                            type="text"
                            value={editForm.category}
                            onChange={(event) =>
                              setEditForm((prev) => ({ ...prev, category: event.target.value }))
                            }
                          />
                          <select
                            value={editForm.categoryId}
                            onChange={(event) => {
                              const selectedId = event.target.value;
                              const selectedCategory = categories.find((entry) => entry.id === selectedId);

                              setEditForm((prev) => ({
                                ...prev,
                                categoryId: selectedId,
                                category: selectedCategory?.name ?? prev.category
                              }));
                            }}
                          >
                            <option value="">No linked category</option>
                            {categories.map((categoryOption) => (
                              <option key={categoryOption.id} value={categoryOption.id}>
                                {categoryOption.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        item.category
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.description}
                          onChange={(event) =>
                            setEditForm((prev) => ({ ...prev, description: event.target.value }))
                          }
                        />
                      ) : (
                        item.description || "—"
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editForm.amount}
                          onChange={(event) =>
                            setEditForm((prev) => ({ ...prev, amount: event.target.value }))
                          }
                        />
                      ) : (
                        formatCurrency(item.amount)
                      )}
                    </td>
                    <td>
                      <div className="actions">
                        {isEditing ? (
                          <>
                            <button type="button" onClick={() => handleUpdate(item.id)}>
                              Save
                            </button>
                            <button type="button" onClick={cancelEditing}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <Link to={`/transactions/${item.id}`}>View</Link>
                            <button type="button" onClick={() => startEditing(item)}>
                              Edit
                            </button>
                            <button type="button" onClick={() => handleDelete(item.id)}>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!orderedTransactions.length ? (
                <tr>
                  <td colSpan={6}>No transactions for selected month.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Trends (Last 6 Months)</h2>
            <p className="muted">Switch between income, expenses, and balance to compare months.</p>
          </div>

          <label className="trend-select">
            Trend Metric
            <select value={trendMetric} onChange={(event) => setTrendMetric(event.target.value as TrendMetric)}>
              <option value="income">Income</option>
              <option value="expenses">Expenses</option>
              <option value="balance">Balance</option>
            </select>
          </label>
        </div>

        <div className="trend-chart-panel">
          <div className="trend-summary">
            <span className={`trend-dot ${trendPresentation.className}`} aria-hidden="true" />
            <div>
              <p className="eyebrow">Active metric</p>
              <h3>{trendPresentation.label}</h3>
            </div>
          </div>

          <div className="trend-chart" aria-label={`${trendPresentation.label} trend chart`}>
            {trends.map((item) => (
              <div key={`trend-chart-${item.month}`} className="trend-card">
                <div className="trend-row-header">
                  <span>{item.month}</span>
                  <strong>{formatCurrency(item[trendMetric])}</strong>
                </div>
                <div className="breakdown-bar-shell trend-bar-shell">
                  <div
                    className={`breakdown-bar ${trendPresentation.className}`}
                    style={{ width: `${(Math.abs(item[trendMetric]) / maxTrendAmount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {!trends.length ? <p className="muted">No trend data available.</p> : null}
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Income</th>
                <th>Expenses</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {trends.map((item) => (
                <tr key={item.month}>
                  <td>{item.month}</td>
                  <td>{formatCurrency(item.income)}</td>
                  <td>{formatCurrency(item.expenses)}</td>
                  <td>{formatCurrency(item.balance)}</td>
                </tr>
              ))}
              {!trends.length ? (
                <tr>
                  <td colSpan={4}>No trend data available.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

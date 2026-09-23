import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getErrorMessage, request } from "../lib/api";

type TransactionType = "income" | "expense";
type TransactionSortKey = "date" | "type" | "category" | "amount";
type SortDirection = "asc" | "desc";

interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  description: string;
  updatedAt: string;
}

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  categoryId: string | null;
  description: string;
  date: string;
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

function getCategoryBadgeStyle(categoryId: string | null, categoryName: string, categories: Category[]) {
  const matchedCategory =
    categories.find((entry) => entry.id === categoryId) ??
    categories.find((entry) => entry.name.toLowerCase() === categoryName.toLowerCase());

  if (!matchedCategory?.color) {
    return undefined;
  }

  return {
    color: matchedCategory.color,
    borderColor: matchedCategory.color,
    backgroundColor: `${matchedCategory.color}1A`
  };
}

function getMostRecentTransactionMonth(items: Transaction[]) {
  let mostRecent: Date | null = null;

  for (const item of items) {
    const parsed = new Date(item.date);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }

    if (!mostRecent || parsed.getTime() > mostRecent.getTime()) {
      mostRecent = parsed;
    }
  }

  return mostRecent ? mostRecent.toISOString().slice(0, 7) : "";
}

function getMonthKey(dateValue: string) {
  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 7);
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [monthFilter, setMonthFilter] = useState("");
  const [newestTransactionId, setNewestTransactionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: TransactionSortKey; direction: SortDirection }>({
    key: "date",
    direction: "desc"
  });
  const [form, setForm] = useState<TransactionForm>({
    type: "expense",
    amount: "",
    categoryId: "",
    category: "",
    description: "",
    date: new Date().toISOString().slice(0, 10)
  });
  const [editForm, setEditForm] = useState<TransactionForm>({
    type: "expense",
    amount: "",
    categoryId: "",
    category: "",
    description: "",
    date: ""
  });

  async function loadTransactions() {
    setLoading(true);
    setError("");

    try {
      const [txData, categoryData] = await Promise.all([
        request<Transaction[]>('/api/transactions'),
        request<Category[]>('/api/categories')
      ]);

      setTransactions(txData);
      setCategories(categoryData);

      setMonthFilter((current) => (current ? current : getMostRecentTransactionMonth(txData)));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTransactions();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const created = await request<Transaction>("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          ...(form.categoryId ? { categoryId: form.categoryId } : {}),
          amount: Number(form.amount)
        })
      });

      setNewestTransactionId(created.id);
      setMonthFilter(getMonthKey(created.date));

      setForm((prev) => ({
        ...prev,
        amount: "",
        categoryId: "",
        category: "",
        description: ""
      }));
      await loadTransactions();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  function startEditing(item: Transaction) {
    setPendingDeleteId(null);
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
    setSaving(true);
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
      await loadTransactions();
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId: string) {
    setSaving(true);
    setError("");

    try {
      await request<Transaction>(`/api/transactions/${itemId}`, {
        method: "DELETE"
      });

      setPendingDeleteId(null);

      if (editingId === itemId) {
        cancelEditing();
      }

      await loadTransactions();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setSaving(false);
    }
  }

  function requestDelete(itemId: string) {
    setPendingDeleteId(itemId);
  }

  function cancelDelete() {
    setPendingDeleteId(null);
  }

  const orderedTransactions = useMemo(() => {
    const multiplier = sort.direction === "asc" ? 1 : -1;

    return [...transactions].sort((a, b) => {
      if (newestTransactionId) {
        if (a.id === newestTransactionId && b.id !== newestTransactionId) {
          return -1;
        }

        if (b.id === newestTransactionId && a.id !== newestTransactionId) {
          return 1;
        }
      }

      if (sort.key === "date") {
        const delta = (new Date(a.date).getTime() - new Date(b.date).getTime()) * multiplier;

        if (delta !== 0) {
          return delta;
        }

        return b.id.localeCompare(a.id);
      }

      if (sort.key === "amount") {
        const delta = (a.amount - b.amount) * multiplier;

        if (delta !== 0) {
          return delta;
        }

        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }

      if (sort.key === "type") {
        const delta = a.type.localeCompare(b.type) * multiplier;

        if (delta !== 0) {
          return delta;
        }

        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }

      const delta = a.category.localeCompare(b.category, undefined, { sensitivity: "base" }) * multiplier;

      if (delta !== 0) {
        return delta;
      }

      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [transactions, sort, newestTransactionId]);

  const availableCategoriesByType = useMemo(() => {
    const seen = new Set<string>();

    return categories.filter((item) => {
      if (item.type !== form.type) {
        return false;
      }

      const key = `${item.type}:${item.name.trim().toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }, [categories, form.type]);

  const editAvailableCategoriesByType = useMemo(() => {
    const seen = new Set<string>();

    return categories.filter((item) => {
      if (item.type !== editForm.type) {
        return false;
      }

      const key = `${item.type}:${item.name.trim().toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }, [categories, editForm.type]);

  const filteredTransactions = useMemo(() => {
    if (!monthFilter) {
      return orderedTransactions;
    }

    return orderedTransactions.filter((item) => {
      const itemMonth = new Date(item.date).toISOString().slice(0, 7);
      return itemMonth === monthFilter;
    });
  }, [orderedTransactions, monthFilter]);

  function handleSort(column: TransactionSortKey) {
    setSort((prev) => {
      if (prev.key !== column) {
        return { key: column, direction: "desc" };
      }

      return { key: column, direction: prev.direction === "desc" ? "asc" : "desc" };
    });
  }

  function getSortLabel(column: TransactionSortKey) {
    if (sort.key !== column) {
      return "Not sorted";
    }

    return sort.direction === "asc" ? "Sorted ascending" : "Sorted descending";
  }

  return (
    <main className="page">
      <section className="panel">
        <p className="eyebrow">Transactions</p>
        <h1>Manage Transactions</h1>
        <p className="section-copy">
          Create, review, edit, and delete transaction records from a dedicated list view.
        </p>
      </section>

      <section className="panel">
        <h2>Add New Transaction</h2>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Type
            <select
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  type: event.target.value as TransactionType,
                  categoryId: "",
                  category: ""
                }))
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
            <select
              required
              value={form.categoryId}
              onChange={(event) => {
                const selectedId = event.target.value;
                const selectedCategory = categories.find((entry) => entry.id === selectedId);

                setForm((prev) => ({
                  ...prev,
                  categoryId: selectedId,
                  category: selectedCategory?.name ?? ""
                }));
              }}
            >
              <option value="">Select category</option>
              {availableCategoriesByType.map((item) => (
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

          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Transaction"}
          </button>
        </form>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p>Loading...</p> : null}

      <section className="panel">
        <h2>Transaction Library</h2>
        <div className="filter-grid transaction-library-filters">
          <label>
            Filter by month:
            <input
              type="month"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
            />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    className="table-sort-button"
                    onClick={() => handleSort("date")}
                    aria-label={`Sort by Date (${getSortLabel("date")})`}
                  >
                    Date
                    {sort.key === "date" ? ` ${sort.direction === "asc" ? "↑" : "↓"}` : ""}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="table-sort-button"
                    onClick={() => handleSort("type")}
                    aria-label={`Sort by Type (${getSortLabel("type")})`}
                  >
                    Type
                    {sort.key === "type" ? ` ${sort.direction === "asc" ? "↑" : "↓"}` : ""}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="table-sort-button"
                    onClick={() => handleSort("category")}
                    aria-label={`Sort by Category (${getSortLabel("category")})`}
                  >
                    Category
                    {sort.key === "category" ? ` ${sort.direction === "asc" ? "↑" : "↓"}` : ""}
                  </button>
                </th>
                <th>Description</th>
                <th>
                  <button
                    type="button"
                    className="table-sort-button"
                    onClick={() => handleSort("amount")}
                    aria-label={`Sort by Amount (${getSortLabel("amount")})`}
                  >
                    Amount
                    {sort.key === "amount" ? ` ${sort.direction === "asc" ? "↑" : "↓"}` : ""}
                  </button>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((item) => {
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
                              type: event.target.value as TransactionType,
                              categoryId: "",
                              category: ""
                            }))
                          }
                        >
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                        </select>
                      ) : (
                        <span className={`status-badge ${item.type}`}>{item.type}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
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
                          <option value="">Select category</option>
                          {editAvailableCategoriesByType.map((categoryOption) => (
                            <option key={categoryOption.id} value={categoryOption.id}>
                              {categoryOption.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="category-badge"
                          style={getCategoryBadgeStyle(item.categoryId, item.category, categories)}
                        >
                          {item.category}
                        </span>
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
                          pendingDeleteId === item.id ? (
                            <>
                              <button
                                type="button"
                                className="button-confirm-delete"
                                onClick={() => handleDelete(item.id)}
                              >
                                Confirm Delete
                              </button>
                              <button type="button" onClick={cancelDelete}>
                                Cancel
                              </button>
                            </>
                          ) : (
                          <>
                            <Link to={`/transactions/${item.id}`} className="action-link-button">
                              View
                            </Link>
                            <button type="button" onClick={() => startEditing(item)}>
                              Edit
                            </button>
                            <button type="button" onClick={() => requestDelete(item.id)}>
                              Delete
                            </button>
                          </>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredTransactions.length ? (
                <tr>
                  <td colSpan={6}>No transactions for the selected month.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

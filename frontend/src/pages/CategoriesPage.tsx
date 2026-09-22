import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getErrorMessage, request } from "../lib/api";

type CategoryType = "income" | "expense";

interface Category {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  description: string;
  updatedAt: string;
}

interface CategoryForm {
  name: string;
  type: CategoryType;
  color: string;
  description: string;
}

interface TransactionCategoryHint {
  type: CategoryType;
  category: string;
  date: string;
}

interface CategoryLibraryItem extends Category {
  inferred?: boolean;
}

function getCategoryBadgeStyle(color?: string) {
  if (!color) {
    return undefined;
  }

  return {
    color,
    borderColor: color,
    backgroundColor: `${color}1A`
  };
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactionHints, setTransactionHints] = useState<TransactionCategoryHint[]>([]);
  const [typeFilter, setTypeFilter] = useState<"" | "income" | "expense">("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>({
    name: "",
    type: "expense",
    color: "#2563eb",
    description: ""
  });
  const [editForm, setEditForm] = useState<CategoryForm>({
    name: "",
    type: "expense",
    color: "#2563eb",
    description: ""
  });

  async function loadCategories() {
    setLoading(true);
    setError("");

    try {
      const [categoryData, transactionData] = await Promise.all([
        request<Category[]>("/api/categories"),
        request<TransactionCategoryHint[]>("/api/transactions")
      ]);

      setCategories(categoryData);
      setTransactionHints(transactionData);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await request<Category>("/api/categories", {
        method: "POST",
        body: JSON.stringify(form)
      });

      setForm({ name: "", type: "expense", color: "#2563eb", description: "" });
      await loadCategories();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  function startEditing(category: Category) {
    setPendingDeleteId(null);
    setEditingId(category.id);
    setEditForm({
      name: category.name,
      type: category.type,
      color: category.color,
      description: category.description || ""
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setEditForm({ name: "", type: "expense", color: "#2563eb", description: "" });
  }

  async function handleUpdate(categoryId: string) {
    setSaving(true);
    setError("");

    try {
      await request<Category>(`/api/categories/${categoryId}`, {
        method: "PUT",
        body: JSON.stringify(editForm)
      });

      cancelEditing();
      await loadCategories();
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(categoryId: string) {
    setSaving(true);
    setError("");

    try {
      await request<Category>(`/api/categories/${categoryId}`, {
        method: "DELETE"
      });

      setPendingDeleteId(null);

      if (editingId === categoryId) {
        cancelEditing();
      }

      await loadCategories();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setSaving(false);
    }
  }

  function requestDelete(categoryId: string) {
    setPendingDeleteId(categoryId);
  }

  function cancelDelete() {
    setPendingDeleteId(null);
  }

  const deduplicatedCategories = useMemo<Category[]>(() => {
    const seen = new Set<string>();

    return categories.filter((category) => {
      const key = `${category.type}:${category.name.trim().toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }, [categories]);

  const inferredCategories = useMemo<CategoryLibraryItem[]>(() => {
    const knownKeys = new Set(
      deduplicatedCategories.map((category) => `${category.type}:${category.name.trim().toLowerCase()}`)
    );
    const latestByKey = new Map<string, TransactionCategoryHint>();

    for (const entry of transactionHints) {
      const normalizedName = entry.category.trim();
      if (!normalizedName) {
        continue;
      }

      const key = `${entry.type}:${normalizedName.toLowerCase()}`;
      if (knownKeys.has(key)) {
        continue;
      }

      const previous = latestByKey.get(key);
      if (!previous || new Date(entry.date).getTime() > new Date(previous.date).getTime()) {
        latestByKey.set(key, {
          ...entry,
          category: normalizedName
        });
      }
    }

    return Array.from(latestByKey.entries()).map(([key, value]) => ({
      id: `inferred-${key.replace(/[^a-z0-9-:]/gi, "-")}`,
      name: value.category,
      type: value.type,
      color: "#94a3b8",
      description: "In use by transactions",
      updatedAt: value.date,
      inferred: true
    }));
  }, [deduplicatedCategories, transactionHints]);

  const libraryCategories = useMemo<CategoryLibraryItem[]>(
    () => [...deduplicatedCategories, ...inferredCategories],
    [deduplicatedCategories, inferredCategories]
  );

  const visibleCategories = useMemo(() => {
    if (!typeFilter) {
      return libraryCategories;
    }

    return libraryCategories.filter((category) => category.type === typeFilter);
  }, [libraryCategories, typeFilter]);

  return (
    <main className="page">
      <section className="panel">
        <p className="eyebrow">Categories</p>
        <h1>Manage Expense & Income Categories</h1>
        <p className="section-copy">
          Create new expense and income categories to organize transactions.
        </p>
      </section>

      <section className="panel">
        <h2>Add New Category</h2>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Type
            <select
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, type: event.target.value as "income" | "expense" }))
              }
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>

          <label>
            New Category Name
            <input
              type="text"
              required
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>

          <label>
            Color
            <span className="color-input-row">
              <input
                type="color"
                value={form.color}
                onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
              />
              <span className="color-chip-row" aria-live="polite">
                <span
                  className="color-chip"
                  style={{ backgroundColor: form.color }}
                  aria-hidden="true"
                />
                {form.color.toUpperCase()}
              </span>
            </span>
          </label>

          <label className="span-2">
            Description
            <input
              type="text"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </label>

          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Category"}
          </button>
        </form>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p>Loading...</p> : null}

      <section className="panel">
        <h2>Category Library</h2>
        <div className="filter-grid">
          <label>
            Type Filter
            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as "" | "income" | "expense")
              }
            >
              <option value="">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Color</th>
                <th>Description</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleCategories.map((category) => {
                const isEditing = editingId === category.id;

                return (
                  <tr key={category.id}>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(event) =>
                            setEditForm((prev) => ({ ...prev, name: event.target.value }))
                          }
                        />
                      ) : (
                        <span className="category-badge" style={getCategoryBadgeStyle(category.color)}>
                          {category.name}
                        </span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          value={editForm.type}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              type: event.target.value as "income" | "expense"
                            }))
                          }
                        >
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                        </select>
                      ) : (
                        <span className={`status-badge ${category.type}`}>{category.type}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="color"
                          value={editForm.color}
                          onChange={(event) =>
                            setEditForm((prev) => ({ ...prev, color: event.target.value }))
                          }
                        />
                      ) : (
                        <span className="color-chip-row">
                          <span
                            className="color-chip"
                            style={{ backgroundColor: category.color }}
                            aria-hidden="true"
                          />
                          {category.color}
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
                        category.description || "—"
                      )}
                    </td>
                    <td>{new Date(category.updatedAt).toLocaleDateString()}</td>
                    <td>
                      <div className="actions">
                        {isEditing ? (
                          <>
                            <button type="button" onClick={() => handleUpdate(category.id)}>
                              Save
                            </button>
                            <button type="button" onClick={cancelEditing}>
                              Cancel
                            </button>
                          </>
                        ) : category.inferred ? (
                          <span className="muted">In transactions</span>
                        ) : pendingDeleteId === category.id ? (
                          <>
                            <button
                              type="button"
                              className="button-confirm-delete"
                              onClick={() => handleDelete(category.id)}
                            >
                              Confirm Delete
                            </button>
                            <button type="button" onClick={cancelDelete}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => startEditing(category)}>
                              Edit
                            </button>
                            <button type="button" onClick={() => requestDelete(category.id)}>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!visibleCategories.length ? (
                <tr>
                  <td colSpan={6}>No categories yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { getErrorMessage, request } from "../lib/api";

interface Category {
  id: string;
  name: string;
  color: string;
  description: string;
  updatedAt: string;
}

interface CategoryForm {
  name: string;
  color: string;
  description: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>({
    name: "",
    color: "#2563eb",
    description: ""
  });
  const [editForm, setEditForm] = useState<CategoryForm>({
    name: "",
    color: "#2563eb",
    description: ""
  });

  async function loadCategories() {
    setLoading(true);
    setError("");

    try {
      const data = await request<Category[]>("/api/categories");
      setCategories(data);
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

      setForm({ name: "", color: "#2563eb", description: "" });
      await loadCategories();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  function startEditing(category: Category) {
    setEditingId(category.id);
    setEditForm({
      name: category.name,
      color: category.color,
      description: category.description || ""
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setEditForm({ name: "", color: "#2563eb", description: "" });
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

  return (
    <main className="page">
      <section className="panel">
        <p className="eyebrow">Categories</p>
        <h1>Manage Categories</h1>
        <p className="section-copy">
          Create and maintain the second core model used to organize transactions and show
          model relationships in the app.
        </p>
      </section>

      <section className="panel">
        <h2>Create Category</h2>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Name
            <input
              type="text"
              required
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>

          <label>
            Color
            <input
              type="color"
              value={form.color}
              onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
            />
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Color</th>
                <th>Description</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
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
                        category.name
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
                        ) : (
                          <>
                            <button type="button" onClick={() => startEditing(category)}>
                              Edit
                            </button>
                            <button type="button" onClick={() => handleDelete(category.id)}>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!categories.length ? (
                <tr>
                  <td colSpan={5}>No categories yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

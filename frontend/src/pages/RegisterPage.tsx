import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { saveAuthSession, type AuthSession, type UserRole } from "../lib/auth";
import { getErrorMessage, request } from "../lib/api";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" as UserRole });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await request<AuthSession>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(form)
      });

      saveAuthSession(response);
      navigate("/");
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="panel auth-panel">
        <div className="auth-copy">
          <p className="eyebrow">Authentication</p>
          <h1>Register</h1>
          <p>Enter your information below to create a new account.</p>
        </div>
      </section>

      <section className="panel auth-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
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
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            />
          </label>
          <label>
            Role
            <select
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as UserRole }))}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          {error ? <p className="error">{error}</p> : null}

          <div className="auth-actions">
            <button type="submit" className="button-primary" disabled={loading}>
              {loading ? "Creating..." : "Create account"}
            </button>
            <Link to="/login" className="button-secondary">
              Sign in
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}

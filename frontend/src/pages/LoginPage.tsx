import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { saveAuthSession, type AuthSession } from "../lib/auth";
import { request, getErrorMessage } from "../lib/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await request<AuthSession>("/api/auth/login", {
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
          <h1>Login</h1>
          <p className="login-subtitle">Sign in with your email and password to manage expense transactions and budgets.</p>
        </div>
      </section>

      <section className="panel auth-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
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

          {error ? <p className="error">{error}</p> : null}

          <div className="auth-actions">
            <button type="submit" className="button-primary" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
            <Link to="/register" className="button-secondary">
              Need an account?
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}

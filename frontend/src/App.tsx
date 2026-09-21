import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode
} from "react";
import { Link, NavLink, Navigate, Outlet, Route, Routes, useNavigate, useParams } from "react-router-dom";
import CategoriesPageView from "./pages/CategoriesPage";
import DashboardPageView from "./pages/DashboardPage";
import LoginPageView from "./pages/LoginPage";
import RegisterPageView from "./pages/RegisterPage";
import TransactionDetailPageView from "./pages/TransactionDetailPage";
import TransactionsPageView from "./pages/TransactionsPage";

const AUTH_STORAGE_KEY = "expense-dashboard-auth";

type UserRole = "user" | "admin";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthSession {
  token: string;
  user: AuthUser;
}

interface AuthContextValue {
  session: AuthSession | null;
  signIn: (nextSession: AuthSession) => void;
  signOut: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

function saveAuthSession(session: AuthSession | null) {
  if (session) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(loadAuthSession);

  function signIn(nextSession: AuthSession) {
    setSession(nextSession);
    saveAuthSession(nextSession);
  }

  function signOut() {
    setSession(null);
    saveAuthSession(null);
  }

  return (
    <AuthContext.Provider
      value={{ session, signIn, signOut, isAuthenticated: Boolean(session?.token) }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function AppShell() {
  const { isAuthenticated, signOut } = useAuth();

  return (
    <>
      <header className="topbar">
        <div className="page topbar-inner">
          <Link to="/" className="brand-link" aria-label="Expense Tracker dashboard">
            <span className="brand-mark">$</span>
            <span>Expense Tracker</span>
          </Link>

          <nav className="topnav" aria-label="Primary navigation">
            {isAuthenticated ? (
              <>
                <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : undefined)}>
                  Dashboard
                </NavLink>
                <NavLink
                  to="/categories"
                  className={({ isActive }) => (isActive ? "active" : undefined)}
                >
                  Categories
                </NavLink>
                <NavLink
                  to="/transactions"
                  className={({ isActive }) => (isActive ? "active" : undefined)}
                >
                  Transactions
                </NavLink>
              </>
            ) : (
              <>
                <NavLink
                  to="/login"
                  className={({ isActive }) => (isActive ? "active" : undefined)}
                >
                  Login
                </NavLink>
                <NavLink
                  to="/register"
                  className={({ isActive }) => (isActive ? "active" : undefined)}
                >
                  Register
                </NavLink>
              </>
            )}
            {isAuthenticated ? (
              <button type="button" className="topnav-button" onClick={signOut}>
                Logout
              </button>
            ) : null}
          </nav>
        </div>
      </header>

      <Outlet />
    </>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPageView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <CategoriesPageView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <TransactionsPageView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions/:id"
            element={
              <ProtectedRoute>
                <TransactionDetailPageView />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPageView />} />
          <Route path="/register" element={<RegisterPageView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

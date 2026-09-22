import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";

const AUTH_STORAGE_KEY = "expense-dashboard-auth";

const { axiosInstance } = vi.hoisted(() => {
  const axiosInstance = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    },
    request: vi.fn()
  };

  return { axiosInstance };
});

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => axiosInstance),
    isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError)
  }
}));

function renderApp(initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>
  );
}

function createJsonResponse<T>(body: T, ok = true, status = 200) {
  return {
    ok,
    status,
    data: body,
    json: async () => body
  } as unknown as Response;
}

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosInstance.request.mockReset();
    localStorage.clear();
  });

  test("redirects unauthenticated users from dashboard to login", async () => {
    renderApp(["/"]);

    expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(
      screen.getByText(/Sign in with your email and password to manage expense transactions and budgets/i)
    ).toBeInTheDocument();
  });

  test("shows navigation for authenticated users", async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: "test-token",
        user: { id: "user-1", name: "Test User", email: "test@example.com", role: "user" }
      })
    );

    axiosInstance.request.mockImplementation((config) => {
      const route = config.url;

      if (route === "/api/transactions") {
        return Promise.resolve({ data: [], status: 200 });
      }

      if (route === "/api/summary?month=2026-09") {
        return Promise.resolve({
          data: { totals: { income: 0, expenses: 0, balance: 0 } },
          status: 200
        });
      }

      if (route === "/api/trends?months=6") {
        return Promise.resolve({ data: { trends: [] }, status: 200 });
      }

      if (route === "/api/dashboard") {
        return Promise.resolve({
          data: { totals: { transactions: 0, users: 1, categories: 0 }, recentTransactions: [] },
          status: 200
        });
      }

      if (route === "/api/categories") {
        return Promise.resolve({ data: [], status: 200 });
      }

      return Promise.reject(new Error(`Unhandled axios path: ${String(route)}`));
    });

    renderApp(["/"]);

    expect(await screen.findByRole("heading", { name: "Expense Tracker" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Categories" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Transactions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
    expect(screen.getByText("Test User · user")).toBeInTheDocument();
  });

  test("accepts login form input and submits credentials", async () => {
    axiosInstance.request.mockRejectedValueOnce(new Error("network"));

    renderApp(["/login"]);

    const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: "alex.household@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "ChangeMe123!" } });

    expect(emailInput.value).toBe("alex.household@example.com");
    expect(passwordInput.value).toBe("ChangeMe123!");

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(axiosInstance.request).toHaveBeenCalledTimes(1);
    });

    const loginCall = axiosInstance.request.mock.calls[0][0];
    expect(loginCall.url).toBe("/api/auth/login");
    expect(loginCall.method).toBe("POST");
    expect(JSON.parse(String(loginCall.data))).toEqual({
      email: "alex.household@example.com",
      password: "ChangeMe123!"
    });
  });

  test("accepts register form input and submits payload", async () => {
    axiosInstance.request.mockRejectedValueOnce(new Error("network"));

    renderApp(["/register"]);

    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
    const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    const roleSelect = screen.getByLabelText("Role") as HTMLSelectElement;

    fireEvent.change(nameInput, { target: { value: "Alex Rivera" } });
    fireEvent.change(emailInput, { target: { value: "alex.household@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "ChangeMe123!" } });
    fireEvent.change(roleSelect, { target: { value: "admin" } });

    expect(nameInput.value).toBe("Alex Rivera");
    expect(emailInput.value).toBe("alex.household@example.com");
    expect(passwordInput.value).toBe("ChangeMe123!");
    expect(roleSelect.value).toBe("admin");

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(axiosInstance.request).toHaveBeenCalledTimes(1);
    });

    const registerCall = axiosInstance.request.mock.calls[0][0];
    expect(registerCall.url).toBe("/api/auth/register");
    expect(registerCall.method).toBe("POST");
    expect(JSON.parse(String(registerCall.data))).toEqual({
      name: "Alex Rivera",
      email: "alex.household@example.com",
      password: "ChangeMe123!",
      role: "admin"
    });
  });

  test("renders dashboard data for an authenticated user", async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: "test-token",
        user: { id: "user-1", name: "Test User", email: "test@example.com", role: "user" }
      })
    );

    axiosInstance.request.mockImplementation((config) => {
      const route = config.url;

      if (route === "/api/transactions") {
        return Promise.resolve({
          data: [
            {
              id: "tx-1",
              type: "expense",
              amount: 45.25,
              category: "Groceries",
              categoryId: "cat-1",
              ownerUserId: "user-1",
              description: "Weekly shopping",
              date: "2026-09-18T00:00:00.000Z"
            }
          ],
          status: 200
        });
      }

      if (route === "/api/summary?month=2026-09") {
        return Promise.resolve({
          data: { totals: { income: 2500, expenses: 45.25, balance: 2454.75 } },
          status: 200
        });
      }

      if (route === "/api/trends?months=6") {
        return Promise.resolve({
          data: { trends: [{ month: "2026-09", income: 2500, expenses: 45.25, balance: 2454.75 }] },
          status: 200
        });
      }

      if (route === "/api/dashboard") {
        return Promise.resolve({
          data: { totals: { transactions: 1, users: 1, categories: 2 }, recentTransactions: [] },
          status: 200
        });
      }

      if (route === "/api/categories") {
        expect(config.headers.Authorization).toBe("Bearer test-token");
        return Promise.resolve({
          data: [
            {
              id: "cat-1",
              name: "Groceries",
              color: "#10b981",
              description: "Food",
              ownerUserId: "user-1",
              updatedAt: "2026-09-18T00:00:00.000Z"
            }
          ],
          status: 200
        });
      }

      return Promise.reject(new Error(`Unhandled axios path: ${String(route)}`));
    });

    renderApp(["/"]);

    expect(await screen.findByRole("heading", { name: "Expense Tracker" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Transactions" })).toBeInTheDocument();
    const transactionsCard = screen.getByText("Total Transactions").closest("article");
    const categoriesCard = screen.getByText("Total Categories").closest("article");

    expect(transactionsCard).not.toBeNull();
    expect(categoriesCard).not.toBeNull();

    expect(await screen.findByText("Weekly shopping")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(transactionsCard as HTMLElement).getByText("1")).toBeInTheDocument();
      expect(within(categoriesCard as HTMLElement).getByText("1")).toBeInTheDocument();
    });
    expect((await screen.findAllByText("$2,455")).length).toBeGreaterThan(0);
  });

  test("renders categories page and submits a new category", async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: "test-token",
        user: { id: "user-1", name: "Test User", email: "test@example.com", role: "user" }
      })
    );

    axiosInstance.request
      .mockResolvedValueOnce({
        data: [
          {
            id: "cat-1",
            name: "Groceries",
            color: "#10b981",
            description: "Food",
            updatedAt: "2026-09-18T00:00:00.000Z"
          }
        ],
        status: 200
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "tx-1",
            type: "income",
            amount: 180,
            category: "Interest",
            categoryId: null,
            description: "Savings interest",
            date: "2026-09-11T00:00:00.000Z"
          }
        ],
        status: 200
      })
      .mockResolvedValueOnce({
        data: {
          id: "cat-2",
          name: "Travel",
          type: "expense",
          color: "#f97316",
          description: "Trips",
          updatedAt: "2026-09-20T00:00:00.000Z"
        },
        status: 201
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "cat-1",
            name: "Groceries",
            type: "expense",
            color: "#10b981",
            description: "Food",
            updatedAt: "2026-09-18T00:00:00.000Z"
          },
          {
            id: "cat-2",
            name: "Travel",
            type: "expense",
            color: "#f97316",
            description: "Trips",
            updatedAt: "2026-09-20T00:00:00.000Z"
          }
        ],
        status: 200
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "tx-1",
            type: "income",
            amount: 180,
            category: "Interest",
            categoryId: null,
            description: "Savings interest",
            date: "2026-09-11T00:00:00.000Z"
          }
        ],
        status: 200
      });

    renderApp(["/categories"]);

    expect(await screen.findByRole("heading", { name: "Manage Expense & Income Categories" })).toBeInTheDocument();
    expect(await screen.findByText("Groceries")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("New Category Name"), { target: { value: "Travel" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Trips" } });
      fireEvent.change(document.querySelector('input[type="color"]') as HTMLInputElement, {
        target: { value: "#f97316" }
      });
    fireEvent.click(screen.getByRole("button", { name: "Save Category" }));

    await waitFor(() => {
      expect(axiosInstance.request).toHaveBeenCalledTimes(5);
    });

    const postCall = axiosInstance.request.mock.calls[2][0];
    expect(postCall.url).toBe("/api/categories");
    expect(postCall.method).toBe("POST");
    expect(postCall.headers.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(String(postCall.data))).toEqual({
      name: "Travel",
      type: "expense",
      color: "#f97316",
      description: "Trips"
    });

    expect(await screen.findByText("Travel")).toBeInTheDocument();
  });

  test("renders transactions page and creates a transaction", async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: "test-token",
        user: { id: "user-1", name: "Test User", email: "test@example.com", role: "user" }
      })
    );

    const initialTransactions = [
      {
        id: "tx-1",
        type: "expense",
        amount: 42.5,
        category: "Groceries",
        categoryId: "cat-1",
        description: "Weekly shopping",
        date: "2026-09-18T00:00:00.000Z"
      }
    ];

    const categories = [
      {
        id: "cat-1",
        name: "Groceries",
        type: "expense",
        color: "#10b981",
        description: "Food",
        updatedAt: "2026-09-18T00:00:00.000Z"
      },
      {
        id: "cat-2",
        name: "Salary",
        type: "income",
        color: "#2563eb",
        description: "Income",
        updatedAt: "2026-09-19T00:00:00.000Z"
      }
    ];

    const createdTransaction = {
      id: "tx-2",
      type: "income",
      amount: 1200,
      category: "Salary",
      categoryId: "cat-2",
      description: "Payday",
      date: "2026-09-20T00:00:00.000Z"
    };

    axiosInstance.request
      .mockResolvedValueOnce({ data: initialTransactions, status: 200 })
      .mockResolvedValueOnce({ data: categories, status: 200 })
      .mockResolvedValueOnce({ data: createdTransaction, status: 201 })
      .mockResolvedValueOnce({ data: [...initialTransactions, createdTransaction], status: 200 })
      .mockResolvedValueOnce({ data: categories, status: 200 });

    renderApp(["/transactions"]);

    expect(await screen.findByRole("heading", { name: "Manage Transactions" })).toBeInTheDocument();
    expect(await screen.findByText("Weekly shopping")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "income" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "1200" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "cat-2" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Payday" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Transaction" }));

    await waitFor(() => {
      expect(axiosInstance.request).toHaveBeenCalledTimes(5);
    });

    const postCall = axiosInstance.request.mock.calls[2][0];
    expect(postCall.url).toBe("/api/transactions");
    expect(postCall.method).toBe("POST");
    expect(JSON.parse(String(postCall.data))).toMatchObject({
      type: "income",
      amount: 1200,
      category: "Salary",
      categoryId: "cat-2",
      description: "Payday",
      date: expect.any(String)
    });

    expect(await screen.findByText("Payday")).toBeInTheDocument();
    const transactionRows = screen.getAllByRole("row");
    expect(within(transactionRows[1]).getByText("Payday")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "View" }).length).toBeGreaterThan(0);
  });
});

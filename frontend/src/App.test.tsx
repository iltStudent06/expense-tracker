import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";

const AUTH_STORAGE_KEY = "expense-dashboard-auth";

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
    json: async () => body
  } as Response;
}

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  test("redirects unauthenticated users from dashboard to login", async () => {
    renderApp(["/"]);

    expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(
      screen.getByText(/Sign in with your email and password to manage expense transactions and budgets/i)
    ).toBeInTheDocument();
  });

  test("renders dashboard data for an authenticated user", async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: "test-token",
        user: { id: "user-1", name: "Test User", email: "test@example.com", role: "user" }
      })
    );

    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockImplementation((path: string | URL | Request, options: RequestInit = {}) => {
      if (path === "/api/transactions") {
        return Promise.resolve(
          createJsonResponse([
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
          ])
        );
      }

      if (path === "/api/summary?month=2026-09") {
        return Promise.resolve(
          createJsonResponse({
            totals: { income: 2500, expenses: 45.25, balance: 2454.75 }
          })
        );
      }

      if (path === "/api/trends?months=6") {
        return Promise.resolve(
          createJsonResponse({
            trends: [{ month: "2026-09", income: 2500, expenses: 45.25, balance: 2454.75 }]
          })
        );
      }

      if (path === "/api/dashboard") {
        return Promise.resolve(
          createJsonResponse({
            totals: { transactions: 1, users: 1, categories: 2 },
            recentTransactions: []
          })
        );
      }

      if (path === "/api/categories") {
        const headers = new Headers(options.headers);
        expect(headers.get("Authorization")).toBe("Bearer test-token");
        return Promise.resolve(
          createJsonResponse([
            {
              id: "cat-1",
              name: "Groceries",
              color: "#10b981",
              description: "Food",
              ownerUserId: "user-1",
              updatedAt: "2026-09-18T00:00:00.000Z"
            },
            {
              id: "cat-2",
              name: "Utilities",
              color: "#2563eb",
              description: "Bills",
              ownerUserId: "user-2",
              updatedAt: "2026-09-19T00:00:00.000Z"
            }
          ])
        );
      }

      return Promise.reject(new Error(`Unhandled fetch path: ${String(path)}`));
    });

    renderApp(["/"]);

    expect(
      await screen.findByRole("heading", { name: /Expense Tracker \/ Budget Dashboard/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Transactions" })).toBeInTheDocument();
    const transactionsCard = screen.getByText("Total Transactions").closest("article");
    const categoriesCard = screen.getByText("Total Categories").closest("article");

    expect(transactionsCard).not.toBeNull();
    expect(categoriesCard).not.toBeNull();

    expect(within(transactionsCard as HTMLElement).getByText("1")).toBeInTheDocument();
    expect(within(categoriesCard as HTMLElement).getByText("1")).toBeInTheDocument();
    expect(await screen.findByText("Weekly shopping")).toBeInTheDocument();
    expect((await screen.findAllByText("$2,454.75")).length).toBeGreaterThan(0);
  });

  test("renders categories page and submits a new category", async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: "test-token",
        user: { id: "user-1", name: "Test User", email: "test@example.com", role: "user" }
      })
    );

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        createJsonResponse([
          {
            id: "cat-1",
            name: "Groceries",
            color: "#10b981",
            description: "Food",
            updatedAt: "2026-09-18T00:00:00.000Z"
          }
        ])
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          id: "cat-2",
          name: "Travel",
          color: "#f97316",
          description: "Trips",
          updatedAt: "2026-09-20T00:00:00.000Z"
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse([
          {
            id: "cat-1",
            name: "Groceries",
            color: "#10b981",
            description: "Food",
            updatedAt: "2026-09-18T00:00:00.000Z"
          },
          {
            id: "cat-2",
            name: "Travel",
            color: "#f97316",
            description: "Trips",
            updatedAt: "2026-09-20T00:00:00.000Z"
          }
        ])
      );

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    renderApp(["/categories"]);

    expect(
      await screen.findByRole("heading", { name: "Manage Categories" })
    ).toBeInTheDocument();

    expect(await screen.findByText("Groceries")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Travel" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Trips" } });
    fireEvent.change(screen.getByLabelText("Color"), { target: { value: "#f97316" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Category" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    const postCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(postCall[0]).toBe("/api/categories");
    expect(postCall[1].method).toBe("POST");
    expect(new Headers(postCall[1].headers).get("Authorization")).toBe("Bearer test-token");
    expect(JSON.parse(String(postCall[1].body))).toEqual({
      name: "Travel",
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
        color: "#10b981",
        description: "Food",
        updatedAt: "2026-09-18T00:00:00.000Z"
      },
      {
        id: "cat-2",
        name: "Salary",
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

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(initialTransactions))
      .mockResolvedValueOnce(createJsonResponse(categories))
      .mockResolvedValueOnce(createJsonResponse(createdTransaction))
      .mockResolvedValueOnce(createJsonResponse([...initialTransactions, createdTransaction]))
      .mockResolvedValueOnce(createJsonResponse(categories));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    renderApp(["/transactions"]);

    expect(
      await screen.findByRole("heading", { name: "Manage Transactions" })
    ).toBeInTheDocument();
    expect(await screen.findByText("Weekly shopping")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "income" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "1200" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Salary" } });
    fireEvent.change(screen.getByLabelText("Linked Category"), { target: { value: "cat-2" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Payday" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Transaction" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(5);
    });

    const postCall = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(postCall[0]).toBe("/api/transactions");
    expect(postCall[1].method).toBe("POST");
    expect(JSON.parse(String(postCall[1].body))).toMatchObject({
      type: "income",
      amount: 1200,
      category: "Salary",
      categoryId: "cat-2",
      description: "Payday",
      date: expect.any(String)
    });

    expect(await screen.findByText("Payday")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "View" }).length).toBeGreaterThan(0);
  });
});

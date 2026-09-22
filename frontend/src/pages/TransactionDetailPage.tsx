import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getErrorMessage, request } from "../lib/api";

interface CategoryDetails {
  name?: string;
  color?: string;
  description?: string;
}

interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  categoryId: string | null;
  ownerUserId?: string | null;
  description: string;
  date: string;
  createdAt?: string | null;
  enteredBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  categoryDetails?: CategoryDetails | null;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount || 0);
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

export default function TransactionDetailPage() {
  const navigate = useNavigate();
  const { id: transactionId = "" } = useParams();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTransaction() {
      setLoading(true);
      setError("");

      try {
        const data = await request<Transaction>(`/api/transactions/${transactionId}`);
        setTransaction(data);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    }

    void loadTransaction();
  }, [transactionId]);

  return (
    <main className="page">
      <section className="panel">
        <p className="eyebrow">Transaction Detail</p>
        <h1>Transaction Overview</h1>
        <p className="section-copy">
          Review a single record with its linked category, amount, date, and descriptive context.
        </p>
      </section>

      <section className="panel">
        <button type="button" onClick={() => navigate(-1)}>
          Back
        </button>
      </section>

      {loading ? <p>Loading...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {transaction ? (
        <section className="grid grid-2">
          <article className="panel">
            <h2>Record Details</h2>
            <p>
              <strong>Type:</strong> <span className={`status-badge ${transaction.type}`}>{transaction.type}</span>
            </p>
            <p><strong>Amount:</strong> {formatCurrency(transaction.amount)}</p>
            <p><strong>Date:</strong> {new Date(transaction.date).toLocaleDateString()}</p>
            <p><strong>Entered By:</strong> {transaction.enteredBy?.name ?? "—"}</p>
            <p>
              <strong>Timestamp:</strong>{" "}
              {transaction.createdAt
                ? new Date(transaction.createdAt).toLocaleString("en-US", {
                    year: "numeric",
                    month: "numeric",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit"
                  })
                : "—"}
            </p>
            <p><strong>Description:</strong> {transaction.description || "—"}</p>
          </article>

          <article className="panel">
            <h2>Related Category</h2>
            <p>
              <strong>Name:</strong>{" "}
              <span
                className="category-badge"
                style={getCategoryBadgeStyle(transaction.categoryDetails?.color)}
              >
                {transaction.categoryDetails?.name ?? transaction.category}
              </span>
            </p>
            <p><strong>Description:</strong> {transaction.categoryDetails?.description ?? "—"}</p>
          </article>
        </section>
      ) : null}
    </main>
  );
}

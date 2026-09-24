import { Router } from "express";
import { requireAuth, getAuthUserId } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { CategoryModel } from "../models/Category.js";
import { TransactionModel } from "../models/Transaction.js";
import { User as UserModel } from "../models/User.js";
import { buildTransactionQuery, toMonthKey, toPublicTransaction } from "./helpers.js";

const router = Router();

router.get(
  "/summary",
  requireAuth,
  asyncHandler(async (req, res) => {
    const ownerUserId = getAuthUserId(req);
    const documents = await TransactionModel.find(
      buildTransactionQuery({ month: req.query.month, category: req.query.category, ownerUserId })
    ).lean();

    let totalIncome = 0;
    let totalExpenses = 0;
    const expensesByCategory: Record<string, number> = {};
    const incomeByCategory: Record<string, number> = {};

    for (const entry of documents) {
      if (entry.type === "income") {
        totalIncome += entry.amount;
        incomeByCategory[entry.category] = (incomeByCategory[entry.category] ?? 0) + entry.amount;
      } else {
        totalExpenses += entry.amount;
        expensesByCategory[entry.category] = (expensesByCategory[entry.category] ?? 0) + entry.amount;
      }
    }

    res.status(200).json({
      month: typeof req.query.month === "string" ? req.query.month : "all",
      totals: {
        income: Number(totalIncome.toFixed(2)),
        expenses: Number(totalExpenses.toFixed(2)),
        balance: Number((totalIncome - totalExpenses).toFixed(2))
      },
      byCategory: {
        income: Object.fromEntries(
          Object.entries(incomeByCategory).map(([key, value]) => [key, Number(value.toFixed(2))])
        ),
        expenses: Object.fromEntries(
          Object.entries(expensesByCategory).map(([key, value]) => [key, Number(value.toFixed(2))])
        )
      },
      transactionCount: documents.length
    });
  })
);

router.get(
  "/trends",
  requireAuth,
  asyncHandler(async (req, res) => {
    const ownerUserId = getAuthUserId(req);
    const monthsParam = Number(req.query.months ?? 6);
    const months = Number.isInteger(monthsParam) && monthsParam > 0 ? monthsParam : 6;

    const now = new Date();
    const order: string[] = [];
    for (let offset = months - 1; offset >= 0; offset -= 1) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
      const monthKey = `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, "0")}`;
      order.push(monthKey);
    }

    const documents = await TransactionModel.find({ ownerUserId }).lean();
    const trendMap = new Map(
      order.map((key) => [key, { month: key, income: 0, expenses: 0, balance: 0 }])
    );

    for (const entry of documents) {
      const key = toMonthKey(entry.date);
      if (!key || !trendMap.has(key)) {
        continue;
      }

      const bucket = trendMap.get(key)!;
      if (entry.type === "income") {
        bucket.income += entry.amount;
      } else {
        bucket.expenses += entry.amount;
      }
      bucket.balance = bucket.income - bucket.expenses;
    }

    const trends = order.map((key) => {
      const value = trendMap.get(key)!;
      return {
        month: value.month,
        income: Number(value.income.toFixed(2)),
        expenses: Number(value.expenses.toFixed(2)),
        balance: Number(value.balance.toFixed(2))
      };
    });

    res.status(200).json({ months, trends });
  })
);

router.get(
  "/dashboard",
  requireAuth,
  asyncHandler(async (req, res) => {
    const ownerUserId = getAuthUserId(req);
    const user = await UserModel.findById(ownerUserId).lean();
    const isAdmin = user?.role === "admin";

    const [transactionCount, categoryCount, recentDocuments, statusCounts, userCount] = await Promise.all([
      TransactionModel.countDocuments({ ownerUserId }),
      CategoryModel.countDocuments({ ownerUserId }),
      TransactionModel.find({ ownerUserId }).sort({ date: -1 }).limit(5).lean(),
      TransactionModel.aggregate([
        { $match: { ownerUserId } },
        { $group: { _id: "$type", count: { $sum: 1 } } }
      ]),
      isAdmin ? UserModel.countDocuments() : Promise.resolve(0)
    ]);

    const totals: Record<string, number> = {
      transactions: transactionCount,
      categories: categoryCount
    };

    if (isAdmin) {
      totals.users = userCount as number;
    }

    res.status(200).json({
      totals,
      groupedCounts: Object.fromEntries(statusCounts.map((entry: { _id: string; count: number }) => [entry._id, entry.count])),
      recentTransactions: recentDocuments.map(toPublicTransaction)
    });
  })
);

export default router;

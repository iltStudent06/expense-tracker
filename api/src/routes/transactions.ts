import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth, getAuthUserId } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { parseObjectId } from "../middleware/validate.js";
import { CategoryModel } from "../models/Category.js";
import { TransactionModel } from "../models/Transaction.js";
import { User } from "../models/User.js";
import { buildTransactionQuery, normalizeTransaction, toPublicCategory, toPublicTransaction } from "./helpers.js";

const router = Router();

async function ensureExistingCategory(categoryId: mongoose.Types.ObjectId | undefined) {
  if (!categoryId) {
    return null;
  }

  const category = await CategoryModel.findOne({
    _id: categoryId
  }).lean();

  return category;
}

async function populateTransactionCategory(document: {
  _id: { toString(): string };
  type: "income" | "expense";
  amount: number;
  category: string;
  categoryId?: mongoose.Types.ObjectId | null;
  ownerUserId: mongoose.Types.ObjectId;
  description?: string;
  date: Date;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const [category, owner] = await Promise.all([
    document.categoryId ? CategoryModel.findById(document.categoryId).lean() : Promise.resolve(null),
    User.findById(document.ownerUserId).select({ _id: 1, name: 1, email: 1 }).lean()
  ]);

  return {
    ...toPublicTransaction(document),
    createdAt: document.createdAt ? new Date(document.createdAt).toISOString() : null,
    categoryDetails: category ? toPublicCategory(category) : null,
    enteredBy: owner
      ? {
          id: owner._id.toString(),
          name: owner.name,
          email: owner.email
        }
      : null
  };
}

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const ownerUserId = getAuthUserId(req);
    if (!ownerUserId) {
      return res.status(401).json({ error: "authorization token required" });
    }

    const normalized = normalizeTransaction(req.body ?? {});
    if ("error" in normalized) {
      return res.status(400).json({ error: normalized.error });
    }

    if (normalized.value.categoryId) {
      const category = await ensureExistingCategory(normalized.value.categoryId);
      if (!category) {
        return res.status(400).json({ error: "linked category not found" });
      }
    }

    const created = await TransactionModel.create({
      ...normalized.value,
      ownerUserId
    });

    return res.status(201).json(toPublicTransaction(created));
  })
);

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const ownerUserId = getAuthUserId(req);
    if (!ownerUserId) {
      return res.status(401).json({ error: "authorization token required" });
    }

    const isAdmin = req.user?.role === "admin";

    const documents = await TransactionModel.find(
      buildTransactionQuery({
        type: req.query.type,
        category: req.query.category,
        month: req.query.month,
        ownerUserId: isAdmin ? null : ownerUserId
      })
    )
      .sort({ date: -1 })
      .lean();

    res.status(200).json(documents.map(toPublicTransaction));
  })
);

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const ownerUserId = getAuthUserId(req);
    if (!ownerUserId) {
      return res.status(401).json({ error: "authorization token required" });
    }

    const parsed = parseObjectId(String(req.params.id), "transaction id");
    if ("error" in parsed) {
      return res.status(400).json({ error: parsed.error });
    }

    const isAdmin = req.user?.role === "admin";

    const document = await TransactionModel.findById(parsed.value).lean();
    if (!document) {
      return res.status(404).json({ error: "transaction not found" });
    }

    if (!isAdmin && document.ownerUserId.toString() !== ownerUserId) {
      return res.status(403).json({ error: "you do not have permission to view this transaction" });
    }

    return res.status(200).json(await populateTransactionCategory(document));
  })
);

router.put(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const ownerUserId = getAuthUserId(req);
    if (!ownerUserId) {
      return res.status(401).json({ error: "authorization token required" });
    }

    const parsed = parseObjectId(String(req.params.id), "transaction id");
    if ("error" in parsed) {
      return res.status(400).json({ error: parsed.error });
    }

    const normalized = normalizeTransaction(req.body ?? {});
    if ("error" in normalized) {
      return res.status(400).json({ error: normalized.error });
    }

    const isAdmin = req.user?.role === "admin";

    const existing = await TransactionModel.findOne(
      isAdmin
        ? { _id: parsed.value }
        : {
            _id: parsed.value,
            ownerUserId
          }
    ).lean();

    if (!existing) {
      return res.status(404).json({ error: "transaction not found" });
    }

    if (normalized.value.categoryId) {
      const category = await ensureExistingCategory(normalized.value.categoryId);
      if (!category) {
        return res.status(400).json({ error: "linked category not found" });
      }
    }

    const updated = await TransactionModel.findOneAndUpdate(
      isAdmin
        ? {
            _id: parsed.value
          }
        : {
            _id: parsed.value,
            ownerUserId
          },
      { $set: normalized.value },
      { returnDocument: "after", runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: "transaction not found" });
    }

    return res.status(200).json(toPublicTransaction(updated));
  })
);

router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const ownerUserId = getAuthUserId(req);
    if (!ownerUserId) {
      return res.status(401).json({ error: "authorization token required" });
    }

    const parsed = parseObjectId(String(req.params.id), "transaction id");
    if ("error" in parsed) {
      return res.status(400).json({ error: parsed.error });
    }

    const isAdmin = req.user?.role === "admin";

    const removed = await TransactionModel.findOneAndDelete(
      isAdmin
        ? { _id: parsed.value }
        : {
            _id: parsed.value,
            ownerUserId
          }
    ).lean();
    if (!removed) {
      return res.status(404).json({ error: "transaction not found" });
    }

    return res.status(200).json(toPublicTransaction(removed));
  })
);

export default router;

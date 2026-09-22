import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth, getAuthUserId } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { parseObjectId } from "../middleware/validate.js";
import { CategoryModel } from "../models/Category.js";
import { TransactionModel } from "../models/Transaction.js";
import { buildTransactionQuery, normalizeTransaction, toPublicCategory, toPublicTransaction } from "./helpers.js";

const router = Router();

async function ensureOwnedCategory(categoryId: mongoose.Types.ObjectId | undefined, ownerUserId: string) {
  if (!categoryId) {
    return null;
  }

  const category = await CategoryModel.findOne({
    _id: categoryId,
    ownerUserId
  }).lean();

  return category;
}

async function populateTransactionCategory(document: {
  _id: { toString(): string };
  type: "income" | "expense";
  amount: number;
  category: string;
  categoryId?: mongoose.Types.ObjectId | null;
  description?: string;
  date: Date;
}) {
  if (!document.categoryId) {
    return toPublicTransaction(document);
  }

  const category = await CategoryModel.findById(document.categoryId).lean();
  return {
    ...toPublicTransaction(document),
    categoryDetails: category ? toPublicCategory(category) : null
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
      const category = await ensureOwnedCategory(normalized.value.categoryId, ownerUserId);
      if (!category) {
        return res.status(400).json({ error: "linked category not found for authenticated user" });
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

    const documents = await TransactionModel.find(
      buildTransactionQuery({
        type: req.query.type,
        category: req.query.category,
        month: req.query.month,
        ownerUserId
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

    const document = await TransactionModel.findOne({
      _id: parsed.value,
      ownerUserId
    }).lean();
    if (!document) {
      return res.status(404).json({ error: "transaction not found" });
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

    const existing = await TransactionModel.findOne({
      _id: parsed.value,
      ownerUserId
    }).lean();

    if (!existing) {
      return res.status(404).json({ error: "transaction not found" });
    }

    if (normalized.value.categoryId) {
      const category = await ensureOwnedCategory(normalized.value.categoryId, ownerUserId);
      if (!category) {
        return res.status(400).json({ error: "linked category not found for authenticated user" });
      }
    }

    const updated = await TransactionModel.findOneAndUpdate(
      {
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

    const removed = await TransactionModel.findOneAndDelete({
      _id: parsed.value,
      ownerUserId
    }).lean();
    if (!removed) {
      return res.status(404).json({ error: "transaction not found" });
    }

    return res.status(200).json(toPublicTransaction(removed));
  })
);

export default router;

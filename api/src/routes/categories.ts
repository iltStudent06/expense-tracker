import { Router } from "express";
import { requireAuth, getAuthUserId } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { parseObjectId } from "../middleware/validate.js";
import { CategoryModel } from "../models/Category.js";
import { buildCategoryQuery, normalizeCategoryPayload, toPublicCategory } from "./helpers.js";

const router = Router();

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const ownerUserId = getAuthUserId(req);
    if (!ownerUserId) {
      return res.status(401).json({ error: "authorization token required" });
    }

    const normalized = normalizeCategoryPayload(req.body ?? {});
    if ("error" in normalized) {
      return res.status(400).json({ error: normalized.error });
    }

    const existingCategory = await CategoryModel.findOne({
      name: normalized.value.name,
      ownerUserId
    }).lean();

    if (existingCategory) {
      return res.status(409).json({ error: "category already exists" });
    }

    const created = await CategoryModel.create({
      ...normalized.value,
      ownerUserId
    });

    return res.status(201).json(toPublicCategory(created));
  })
);

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const ownerUserId = getAuthUserId(req);
    const isAdmin = req.user?.role === "admin";

    const documents = await CategoryModel.find(
      buildCategoryQuery({ name: req.query.name, ownerUserId: isAdmin ? null : ownerUserId })
    )
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json(documents.map(toPublicCategory));
  })
);

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = parseObjectId(String(req.params.id), "category id");
    if ("error" in parsed) {
      return res.status(400).json({ error: parsed.error });
    }

    const ownerUserId = getAuthUserId(req);
    const isAdmin = req.user?.role === "admin";

    const document = await CategoryModel.findById(parsed.value).lean();
    if (!document) {
      return res.status(404).json({ error: "category not found" });
    }

    if (!isAdmin && document.ownerUserId.toString() !== ownerUserId) {
      return res.status(403).json({ error: "you do not have permission to view this category" });
    }

    return res.status(200).json(toPublicCategory(document));
  })
);

router.put(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = parseObjectId(String(req.params.id), "category id");
    if ("error" in parsed) {
      return res.status(400).json({ error: parsed.error });
    }

    const normalized = normalizeCategoryPayload(req.body ?? {});
    if ("error" in normalized) {
      return res.status(400).json({ error: normalized.error });
    }

    const ownerUserId = getAuthUserId(req);
    if (!ownerUserId) {
      return res.status(401).json({ error: "authorization token required" });
    }

    const existing = await CategoryModel.findById(parsed.value).lean();
    if (!existing) {
      return res.status(404).json({ error: "category not found" });
    }

    const isOwner = existing.ownerUserId.toString() === ownerUserId;
    const isAdmin = req.user?.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "you do not have permission to update this category" });
    }

    const updated = await CategoryModel.findByIdAndUpdate(
      parsed.value,
      { $set: normalized.value },
      { returnDocument: "after", runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: "category not found" });
    }

    return res.status(200).json(toPublicCategory(updated));
  })
);

router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = parseObjectId(String(req.params.id), "category id");
    if ("error" in parsed) {
      return res.status(400).json({ error: parsed.error });
    }

    const ownerUserId = getAuthUserId(req);
    if (!ownerUserId) {
      return res.status(401).json({ error: "authorization token required" });
    }

    const category = await CategoryModel.findById(parsed.value).lean();
    if (!category) {
      return res.status(404).json({ error: "category not found" });
    }

    const isOwner = category.ownerUserId.toString() === ownerUserId;
    const isAdmin = req.user?.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "admin role required to delete other users' categories" });
    }

    const removed = await CategoryModel.findByIdAndDelete(parsed.value).lean();
    if (!removed) {
      return res.status(404).json({ error: "category not found" });
    }

    return res.status(200).json(toPublicCategory(removed));
  })
);

export default router;

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod;
let app;
let closeDatabaseConnection;
let authToken;
let secondUserToken;
let adminToken;
let categoryId;
let transactionId;

before(async () => {
  mongod = await MongoMemoryServer.create();

  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret";
  process.env.MONGO_URI = mongod.getUri("expense_dashboard_test");
  process.env.MONGO_DB = "expense_dashboard_test";
  process.env.MONGO_COLLECTION = "transactions";
  process.env.MONGO_USERS_COLLECTION = "users";
  process.env.MONGO_CATEGORIES_COLLECTION = "categories";

  const apiModule = await import("../api/src/app.ts");
  app = apiModule.default;
  closeDatabaseConnection = apiModule.closeDatabaseConnection;
});

after(async () => {
  if (closeDatabaseConnection) {
    await closeDatabaseConnection();
  }

  if (mongod) {
    await mongod.stop();
  }
});

describe("Expense Dashboard API", () => {
  test("registers a user and returns a token", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Test User",
      email: "test@example.com",
      password: "secret123",
      role: "user"
    });

    assert.equal(response.status, 201);
    assert.ok(response.body.token);
    assert.equal(response.body.user.email, "test@example.com");
    authToken = response.body.token;
  });

  test("rejects invalid login payloads", async () => {
    const invalidEmailResponse = await request(app).post("/api/auth/login").send({
      email: "not-an-email",
      password: "secret123"
    });

    assert.equal(invalidEmailResponse.status, 400);
    assert.equal(invalidEmailResponse.body.error, "email must be valid");

    const shortPasswordResponse = await request(app).post("/api/auth/login").send({
      email: "test@example.com",
      password: "123"
    });

    assert.equal(shortPasswordResponse.status, 400);
    assert.equal(shortPasswordResponse.body.error, "password must be at least 6 characters");
  });

  test("rejects protected transaction creation without auth", async () => {
    const response = await request(app).post("/api/transactions").send({
      type: "expense",
      amount: 18.25,
      category: "Lunch",
      description: "Unauthorized request",
      date: "2026-09-21"
    });

    assert.equal(response.status, 401);
    assert.equal(response.body.error, "authorization token required");
  });

  test("rejects transaction reads without auth", async () => {
    const listResponse = await request(app).get("/api/transactions");
    assert.equal(listResponse.status, 401);
    assert.equal(listResponse.body.error, "authorization token required");

    const detailResponse = await request(app).get("/api/transactions/507f1f77bcf86cd799439011");
    assert.equal(detailResponse.status, 401);
    assert.equal(detailResponse.body.error, "authorization token required");
  });

  test("creates a category for the authenticated user", async () => {
    const response = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Groceries",
        color: "#10b981",
        description: "Food and household purchases"
      });

    assert.equal(response.status, 201);
    assert.equal(response.body.name, "Groceries");
    assert.equal(response.body.color, "#10b981");
    categoryId = response.body.id;
  });

  test("creates, updates, and fetches a linked transaction", async () => {
    const createResponse = await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        type: "expense",
        amount: 42.5,
        category: "Groceries",
        categoryId,
        description: "Weekly shopping",
        date: "2026-09-18"
      });

    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.body.categoryId, categoryId);
    transactionId = createResponse.body.id;

    const updateResponse = await request(app)
      .put(`/api/transactions/${transactionId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        type: "expense",
        amount: 50,
        category: "Groceries",
        categoryId,
        description: "Weekly shopping and snacks",
        date: "2026-09-18"
      });

    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.body.amount, 50);
    assert.equal(updateResponse.body.description, "Weekly shopping and snacks");

    const getResponse = await request(app)
      .get(`/api/transactions/${transactionId}`)
      .set("Authorization", `Bearer ${authToken}`);

    assert.equal(getResponse.status, 200);
    assert.equal(getResponse.body.categoryDetails?.id, categoryId);
    assert.equal(getResponse.body.categoryDetails?.name, "Groceries");

    const listResponse = await request(app)
      .get("/api/transactions")
      .set("Authorization", `Bearer ${authToken}`);

    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.length, 1);
    assert.equal(listResponse.body[0].id, transactionId);
  });

  test("prevents one user from reading another user's transaction", async () => {
    const registerResponse = await request(app).post("/api/auth/register").send({
      name: "Second User",
      email: "second@example.com",
      password: "secret123",
      role: "user"
    });

    assert.equal(registerResponse.status, 201);
    secondUserToken = registerResponse.body.token;

    const detailResponse = await request(app)
      .get(`/api/transactions/${transactionId}`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    assert.equal(detailResponse.status, 404);
    assert.equal(detailResponse.body.error, "transaction not found");

    const listResponse = await request(app)
      .get("/api/transactions")
      .set("Authorization", `Bearer ${secondUserToken}`);

    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.length, 0);

    const updateResponse = await request(app)
      .put(`/api/transactions/${transactionId}`)
      .set("Authorization", `Bearer ${secondUserToken}`)
      .send({
        type: "expense",
        amount: 80,
        category: "Groceries",
        categoryId,
        description: "Unauthorized edit",
        date: "2026-09-18"
      });

    assert.equal(updateResponse.status, 404);
    assert.equal(updateResponse.body.error, "transaction not found");

    const deleteResponse = await request(app)
      .delete(`/api/transactions/${transactionId}`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    assert.equal(deleteResponse.status, 404);
    assert.equal(deleteResponse.body.error, "transaction not found");
  });

  test("returns dashboard totals and category collection data", async () => {
    const categoriesResponse = await request(app).get("/api/categories");
    assert.equal(categoriesResponse.status, 200);
    assert.equal(categoriesResponse.body.length, 1);
    assert.equal(categoriesResponse.body[0].id, categoryId);

    const dashboardResponse = await request(app).get("/api/dashboard");
    assert.equal(dashboardResponse.status, 200);
    assert.equal(dashboardResponse.body.totals.users, 2);
    assert.equal(dashboardResponse.body.totals.categories, 1);
    assert.equal(dashboardResponse.body.totals.transactions, 1);
    assert.equal(dashboardResponse.body.recentTransactions[0].id, transactionId);
  });

  test("enforces role-based access control on category deletion", async () => {
    // Create an admin user
    const adminRegisterResponse = await request(app).post("/api/auth/register").send({
      name: "Admin User",
      email: "admin@example.com",
      password: "secret123",
      role: "admin"
    });

    assert.equal(adminRegisterResponse.status, 201);
    adminToken = adminRegisterResponse.body.token;

    // Create a category as admin
    const adminCategoryResponse = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Admin Category",
        color: "#ef4444",
        description: "Category owned by admin"
      });

    assert.equal(adminCategoryResponse.status, 201);
    const adminCategoryId = adminCategoryResponse.body.id;

    // Create a category as regular user
    const userCategoryResponse = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "User Category",
        color: "#3b82f6",
        description: "Category owned by regular user"
      });

    assert.equal(userCategoryResponse.status, 201);
    const userCategoryId = userCategoryResponse.body.id;

    // Regular user should NOT be able to delete admin's category (403)
    const unauthorizedDeleteResponse = await request(app)
      .delete(`/api/categories/${adminCategoryId}`)
      .set("Authorization", `Bearer ${authToken}`);

    assert.equal(unauthorizedDeleteResponse.status, 403);
    assert.equal(unauthorizedDeleteResponse.body.error, "admin role required to delete other users' categories");

    // Regular user SHOULD be able to delete their own category
    const ownDeleteResponse = await request(app)
      .delete(`/api/categories/${userCategoryId}`)
      .set("Authorization", `Bearer ${authToken}`);

    assert.equal(ownDeleteResponse.status, 200);
    assert.equal(ownDeleteResponse.body.id, userCategoryId);

    // Admin should be able to delete any category (even another user's)
    const adminDeleteResponse = await request(app)
      .delete(`/api/categories/${adminCategoryId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(adminDeleteResponse.status, 200);
    assert.equal(adminDeleteResponse.body.id, adminCategoryId);

    // Verify both are deleted
    const getAdminCat = await request(app).get(`/api/categories/${adminCategoryId}`);
    assert.equal(getAdminCat.status, 404);

    const getUserCat = await request(app).get(`/api/categories/${userCategoryId}`);
    assert.equal(getUserCat.status, 404);
  });

  test("logs in and deletes seeded test records", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "test@example.com",
      password: "secret123"
    });

    assert.equal(loginResponse.status, 200);
    assert.ok(loginResponse.body.token);

    const deleteTransactionResponse = await request(app)
      .delete(`/api/transactions/${transactionId}`)
      .set("Authorization", `Bearer ${loginResponse.body.token}`);
    assert.equal(deleteTransactionResponse.status, 200);

    // Original category owner can delete their own category
    const deleteCategoryResponse = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set("Authorization", `Bearer ${loginResponse.body.token}`);
    assert.equal(deleteCategoryResponse.status, 200);
  });
});

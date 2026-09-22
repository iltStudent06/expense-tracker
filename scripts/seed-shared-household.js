import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiBaseUrl = process.env.API_URL ?? "http://localhost:4000";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const seedDir = process.env.SEED_DIR ?? "seed/shared-household";
const dryRun = process.env.DRY_RUN === "1";

function resolveFromRepo(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(repoRoot, filePath);
}

const usersFile = resolveFromRepo(process.env.SEED_USERS_FILE ?? path.join(seedDir, "users.json"));
const categoriesFile = resolveFromRepo(
  process.env.SEED_CATEGORIES_FILE ?? path.join(seedDir, "categories.json")
);

const registerEndpoint = `${apiBaseUrl.replace(/\/$/, "")}/api/auth/register`;
const loginEndpoint = `${apiBaseUrl.replace(/\/$/, "")}/api/auth/login`;
const categoriesEndpoint = `${apiBaseUrl.replace(/\/$/, "")}/api/categories`;
const transactionsEndpoint = `${apiBaseUrl.replace(/\/$/, "")}/api/transactions`;

async function loadArrayJson(filePath, label) {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`${label} file must contain a JSON array: ${filePath}`);
  }

  return parsed;
}

function toSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getTransactionFileForUser(user) {
  const envKey = `SEED_TX_FILE_${toSlug(user.email).replace(/-/g, "_").toUpperCase()}`;
  if (process.env[envKey]) {
    return resolveFromRepo(process.env[envKey]);
  }

  const emailPrefix = String(user.email).split("@")[0]?.split(".")[0] ?? "";
  const fallbackName = String(user.name ?? "").split(" ")[0] ?? "";
  const slug = toSlug(emailPrefix || fallbackName || "user");

  return resolveFromRepo(path.join(seedDir, `transactions-${slug}.json`));
}

async function parseResponsePayload(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function registerOrLogin(user) {
  const registerResponse = await fetch(registerEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user)
  });

  const registerPayload = await parseResponsePayload(registerResponse);

  if (registerResponse.status === 201) {
    return { token: registerPayload.token, mode: "registered" };
  }

  if (registerResponse.status !== 409) {
    throw new Error(
      `Failed to register ${user.email} (${registerResponse.status}): ${JSON.stringify(registerPayload)}`
    );
  }

  const loginResponse = await fetch(loginEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password: user.password })
  });

  const loginPayload = await parseResponsePayload(loginResponse);

  if (!loginResponse.ok) {
    throw new Error(
      `Failed to login ${user.email} (${loginResponse.status}): ${JSON.stringify(loginPayload)}`
    );
  }

  return { token: loginPayload.token, mode: "logged-in" };
}

async function fetchUserCategories(token) {
  const response = await fetch(categoriesEndpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const payload = await parseResponsePayload(response);
  if (!response.ok) {
    throw new Error(`Failed to fetch categories (${response.status}): ${JSON.stringify(payload)}`);
  }

  return payload;
}

function buildCategoryIdMap(categories) {
  const map = new Map();
  for (const category of categories) {
    if (typeof category?.name === "string" && typeof category?.id === "string") {
      map.set(category.name.trim().toLowerCase(), category.id);
    }
  }

  return map;
}

async function ensureCategories(token, seedCategories) {
  const existing = await fetchUserCategories(token);
  const existingNames = new Set(
    existing
      .map((item) => (typeof item?.name === "string" ? item.name.trim().toLowerCase() : ""))
      .filter(Boolean)
  );

  for (const category of seedCategories) {
    const name = typeof category?.name === "string" ? category.name.trim().toLowerCase() : "";
    if (!name || existingNames.has(name)) {
      continue;
    }

    const createResponse = await fetch(categoriesEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(category)
    });

    const createPayload = await parseResponsePayload(createResponse);

    if (createResponse.status === 201 || createResponse.status === 409) {
      existingNames.add(name);
      continue;
    }

    throw new Error(
      `Failed to create category ${category.name} (${createResponse.status}): ${JSON.stringify(createPayload)}`
    );
  }

  return buildCategoryIdMap(await fetchUserCategories(token));
}

async function createTransaction(token, transaction, categoryIdMap) {
  const normalizedCategory = String(transaction.category ?? "").trim().toLowerCase();
  const categoryId = categoryIdMap.get(normalizedCategory);

  const payload = {
    ...transaction,
    ...(categoryId ? { categoryId } : {})
  };

  const response = await fetch(transactionsEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const body = await parseResponsePayload(response);
  if (!response.ok) {
    throw new Error(
      `Failed transaction ${transaction.type}/${transaction.category}/${transaction.date} (${response.status}): ${JSON.stringify(body)}`
    );
  }
}

async function main() {
  const users = await loadArrayJson(usersFile, "Users");
  const categories = await loadArrayJson(categoriesFile, "Categories");

  const plan = [];
  for (const user of users) {
    const txFile = getTransactionFileForUser(user);
    const transactions = await loadArrayJson(txFile, `Transactions for ${user.email}`);
    plan.push({ user, txFile, transactions });
  }

  if (dryRun) {
    const totalTransactions = plan.reduce((sum, entry) => sum + entry.transactions.length, 0);
    console.log("Dry run summary");
    console.log(`- API URL: ${apiBaseUrl}`);
    console.log(`- Users: ${plan.length}`);
    console.log(`- Categories per user: ${categories.length}`);
    console.log(`- Total transactions: ${totalTransactions}`);
    for (const entry of plan) {
      console.log(`  - ${entry.user.email}: ${entry.transactions.length} from ${entry.txFile}`);
    }
    return;
  }

  let createdTransactions = 0;

  for (const entry of plan) {
    const { token, mode } = await registerOrLogin(entry.user);
    const categoryIdMap = await ensureCategories(token, categories);

    for (const transaction of entry.transactions) {
      await createTransaction(token, transaction, categoryIdMap);
      createdTransactions += 1;
    }

    console.log(
      `Seeded ${entry.transactions.length} transactions for ${entry.user.email} (${mode}; source ${entry.txFile})`
    );
  }

  console.log(`Shared household seed complete: ${createdTransactions} transactions created`);
}

main().catch((error) => {
  console.error(`Shared household seed failed: ${error.message}`);
  process.exit(1);
});

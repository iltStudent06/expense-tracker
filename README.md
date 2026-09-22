# Expense Tracker / Budget Dashboard

Full-stack capstone project with:

- a custom landing page (`/`)
- a React + TypeScript SPA (`/app`)
- an Express + TypeScript API
- MongoDB persistence
- Docker and Kubernetes deployment assets
- GitHub Actions CI and API deployment workflow

## Current architecture

- **Frontend**: React 18, TypeScript, Vite 5, React Router
- **Backend**: Express, TypeScript, Mongoose, JWT auth
- **Database**: MongoDB 7
- **Container runtime**: Docker / Docker Compose
- **Orchestration**: Kubernetes manifests under `k8s/`

## Repository layout

- `api/src/` backend TypeScript source
- `api/package.json` backend package manifest
- `api/tsconfig.json` backend TypeScript config
- `api/.env.example` backend environment template
- `test/` backend integration tests
- `frontend/src/` frontend application source
- `client/public/landing.html` static landing page
- `scripts/seed-transactions.js` seed utility script
- `k8s/` Kubernetes manifests
- `.github/workflows/` CI and deployment workflows

## Prerequisites

- Node.js 20+
- npm
- Docker (optional)
- Kubernetes cluster + `kubectl` (optional)

## Environment variables (API)

Copy and update:

```bash
cp api/.env.example api/.env
```

Default values in `api/.env.example`:

- `MONGO_URI`
- `MONGO_DB`
- `JWT_SECRET`
- `PORT`

## Run locally (without Docker)

### 1) Start MongoDB

You need a MongoDB instance reachable by `MONGO_URI`.

Example using Docker:

```bash
docker run --rm -d \
  --name expense-mongo \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=expense_user \
  -e MONGO_INITDB_ROOT_PASSWORD=expense_pass \
  mongo:7
```

### 2) Start backend API

From `api` directory:

```bash
cd api
npm install
npm run dev
```

API runs on `http://localhost:4000` by default.

Health check:

```bash
curl http://localhost:4000/health
```

### 3) Start frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server runs on `http://localhost:5173`.

Notes:

- Vite dev proxy forwards `/api` to `http://localhost:4000`.
- Frontend build is configured with Vite base `/app/`.
- Landing page URL: `http://localhost:5173/landing.html`
- React SPA URL: `http://localhost:5173/app/`

## App routes

### Frontend routes

- `/` dashboard (protected)
- `/categories` categories management (protected)
- `/transactions/:id` transaction detail (protected)
- `/login`
- `/register`

### API routes

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/categories`
- `GET /api/categories/:id`
- `POST /api/categories` (auth required)
- `PUT /api/categories/:id` (auth required)
- `DELETE /api/categories/:id` (admin required or owner)
- `GET /api/transactions`
- `GET /api/transactions/:id`
- `POST /api/transactions` (auth required)
- `PUT /api/transactions/:id` (auth required)
- `DELETE /api/transactions/:id` (auth required, owner only)
- `GET /api/summary`
- `GET /api/trends`
- `GET /api/dashboard`

## Authentication behavior

- JWT is returned by register/login endpoints.
- Write routes for categories and transactions require:

```text
Authorization: Bearer <token>
```

- If `JWT_SECRET` is not set, API falls back to a development default secret. Set a strong value for non-dev environments.

## Role-based access control

The application enforces role-based authorization on protected routes:

### User roles

- `user` — Regular user. Can create, read, update, and delete their own resources only.
- `admin` — Administrator. Can read and delete any user's resources in addition to their own.

### Protected operations

**Category operations:**
- **Read (GET /api/categories, GET /api/categories/:id)** — Requires authentication. Regular users can view only their own categories; admins can view all categories.
- **Create (POST /api/categories)** — Requires authentication. Any user can create categories.
- **Update (PUT /api/categories/:id)** — Requires authentication and ownership. Users can only update their own.
- **Delete (DELETE /api/categories/:id)** — Requires either:
  - Owner (user who created the category), OR
  - Admin role

  Non-owners receive `403 Forbidden` with error: `"admin role required to delete other users' categories"`

**Transaction operations:**
- **Read (GET /api/transactions, GET /api/transactions/:id)** — Requires authentication. Regular users can view only their own transactions; admins can view all transactions.
- **Create/Update/Delete** — Requires authentication and ownership. Users can only modify their own transactions; admins cannot bypass ownership.

### Dashboard visibility

- **Total users** — Displayed only to admins in the UI.
- **Total transactions** and **total categories** — Displayed as the signed-in user's own counts for regular users, and as full totals for admins.

### Role assignment

Users can register with a role, defaulting to `user`. Admin users must be created or promoted outside the normal registration flow (e.g., direct database seeding or admin operations).

## Testing and type checking

### Backend (repo root)

```bash
cd api
npm run typecheck
npm test
```

### Frontend

```bash
cd frontend
npm run typecheck
npm test
npm run build
```

## Docker

### API image

```bash
docker build -t expense-dashboard-api .
```

### Frontend image

```bash
docker build -f frontend/Dockerfile -t expense-dashboard-frontend .
```

## Docker Compose (full stack)

Run:

```bash
docker compose up --build
```

Run detached:

```bash
docker compose up --build -d
```

Stop:

```bash
docker compose down
```

Stop and remove DB volume:

```bash
docker compose down -v
```

Default ports:

- Frontend: `8080` (host) → `80` (container)
- API: `3000` (host) → `3000` (container)
- MongoDB: `27018` (host) → `27017` (container)

Compose environment overrides:

- `FRONTEND_PORT`
- `API_PORT`
- `MONGO_PORT`
- `NODE_ENV`
- `PORT`
- `MONGO_DB`
- `MONGO_INITDB_ROOT_USERNAME`
- `MONGO_INITDB_ROOT_PASSWORD`

## Kubernetes

Manifests provided:

- `k8s/namespace.yaml`
- `k8s/expense-mongo.yaml`
- `k8s/expense-api-deployment.yaml`
- `k8s/expense-api-service.yaml`
- `k8s/expense-frontend-deployment.yaml`
- `k8s/expense-frontend-service.yaml`
- `k8s/expense-ingress.yaml`
- `k8s/expense-api-secret.example.yaml`

### Apply order

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/expense-api-secret.example.yaml
kubectl apply -f k8s/expense-mongo.yaml
kubectl apply -f k8s/expense-api-deployment.yaml
kubectl apply -f k8s/expense-api-service.yaml
kubectl apply -f k8s/expense-frontend-deployment.yaml
kubectl apply -f k8s/expense-frontend-service.yaml
kubectl apply -f k8s/expense-ingress.yaml
```

### Quick checks

```bash
kubectl get all -n expense-dashboard
kubectl rollout status deployment/expense-api -n expense-dashboard --timeout=300s
kubectl rollout status deployment/expense-frontend -n expense-dashboard --timeout=300s
kubectl rollout status deployment/expense-mongo -n expense-dashboard --timeout=300s
```

## GitHub Actions workflows

- `ci.yml`
  - backend install/typecheck/tests/docker build
  - frontend install/typecheck/tests/build/docker build
- `deploy-api.yml`
  - builds/scans/pushes API image
  - deploys API to EKS and updates `expense-api` image
- `deploy-frontend.yml`
  - builds/scans/pushes frontend image from `frontend/Dockerfile`
  - deploys the frontend to EKS and updates `expense-frontend` image
  - verifies rollout success with `kubectl rollout status`

### Required GitHub Actions configuration

The deployment workflows expect these repository settings:

The deployment workflows are currently pinned to AWS region `us-east-1`.
The deployment workflows are currently pinned to EKS cluster `expense-dashboard-capstone`.
The deployment workflows are currently pinned to Kubernetes namespace `expense-dashboard`.
The deployment workflows are currently pinned to ECR repositories `capstone-api` and `capstone-frontend`.
The deployment workflows are currently pinned to IAM role `arn:aws:iam::180294218913:role/github-actions-expense-tracker-deploy` for GitHub Actions OIDC authentication.

### Frontend deployment workflow

The frontend deployment workflow can be started manually or by pushing a release tag that matches `v*`.

At deploy time it will:

- authenticate to AWS with OIDC
- build the frontend image from `frontend/Dockerfile`
- scan the image with Trivy
- push the image to Amazon ECR
- apply the frontend Kubernetes manifests
- update the `expense-frontend` deployment image
- wait for rollout success and print the frontend pod status

## Seed script status

`scripts/seed-transactions.js` posts directly to `POST /api/transactions` without auth headers.

Because that endpoint currently requires JWT authentication, the seed script will fail with `401` unless the API auth requirements are changed or the script is updated to include an auth token.

## Additional docs

- `DEPLOYMENT.md` detailed deployment notes
- `ARCHITECTURE.md` architecture summary

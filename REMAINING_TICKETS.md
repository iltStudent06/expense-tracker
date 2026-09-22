# Remaining Capstone Tickets

Audit date: 2026-09-21

This ticket list is based on a repository review. Items are split into:

- **Completed tickets**: work that has been implemented in the current branch and is kept here for visibility.
- **Confirmed repo gaps**: work that still appears unfinished in source control.
- **Operational/final-delivery tickets**: work that may be done outside the repo, but is not yet documented or provable from the repository alone.

---

## Completed tickets

### ✅ CAP-001 — Add a dedicated transactions list page — COMPLETE
**Status**
Completed in the current branch. The app now includes a protected `/transactions` route, a Transactions nav link, and a working transaction list/create/edit/delete UI with tests.

**Implementation evidence**
- Protected route and nav link added in [frontend/src/App.tsx](frontend/src/App.tsx).
- Frontend test coverage added in [frontend/src/App.test.tsx](frontend/src/App.test.tsx).

**Acceptance criteria met**
- Protected `/transactions` route exists.
- Transactions are shown in a table/list with key fields.
- Main app shell links to the transactions page.
- Each transaction links to its detail page.
- Create/edit/delete actions are available in the UI.
- Frontend test coverage was added for the new page.

---

## Confirmed repo gaps

### ✅ CAP-002 — Enforce role-based access control — COMPLETE
**Status**
Completed in the current branch and intentionally left in this section per request, marked complete in place.

**Implementation evidence**
- Reusable auth and role middleware implemented in [api/src/middleware/auth.ts](api/src/middleware/auth.ts).
- Ownership-aware and admin-aware access rules implemented in [api/src/routes/categories.ts](api/src/routes/categories.ts) and [api/src/routes/transactions.ts](api/src/routes/transactions.ts).
- API test coverage added in [api/test/api.test.js](api/test/api.test.js).
- RBAC behavior documented in [README.md](README.md).

**Acceptance criteria met**
- Introduce reusable role-check middleware.
- Protect meaningful actions with role-restricted or admin-aware access.
- Return `403` for authenticated users without required access.
- Add API tests for allowed and denied scenarios.
- Document role-restricted behavior and route expectations.

---

### CAP-003 — Complete final README content
**Description**
The README is strong on setup and architecture, but it is still missing some final-delivery items called out in the capstone rubric.

**Evidence**
- No live deployment URL is documented.
- No team member names/responsibilities section is present.
- The top-level feature list could be made explicit for presentation/review.
- See [README.md](README.md).

**Acceptance criteria**
- Add the public deployment URL.
- Add a team roster with each member’s responsibilities/contributions.
- Add a concise feature list section for the finished application.
- Keep or refine the local Docker Compose run instructions.
- Confirm README reflects the final routes, deployment flow, and known environment variables.

---

### ✅ CAP-004 — Automate frontend deployment to ECR/EKS — COMPLETE
**Status**
Completed in the current branch. The repo now includes a dedicated frontend deployment workflow for ECR/EKS with rollout verification and supporting documentation.

**Implementation evidence**
- Frontend deployment workflow added in [/.github/workflows/deploy-frontend.yml](.github/workflows/deploy-frontend.yml).
- Workflow builds, scans, pushes, and deploys the frontend image, then verifies rollout with `kubectl rollout status`.
- Required GitHub Actions secrets and variables documented in [README.md](README.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

**Acceptance criteria met**
- Add a GitHub Actions workflow that builds and pushes the frontend image to ECR.
- Update the `expense-frontend` deployment image automatically.
- Document required GitHub secrets/variables.
- Verify rollout success in the workflow output.

---

### ✅ CAP-005 — Align the frontend auth client with the written rubric
**Status**
Completed in the current branch. The frontend now uses a shared Axios client with automatic JWT attachment and centralized auth-error handling.

**Implementation evidence**
- Shared Axios client added in [frontend/src/lib/api.ts](frontend/src/lib/api.ts).
- Request interceptor attaches the bearer token automatically.
- Response interceptor clears expired/unauthorized sessions consistently.
- Frontend auth and CRUD tests updated and validated in [frontend/src/App.test.tsx](frontend/src/App.test.tsx).
- Dependency added in [frontend/package.json](frontend/package.json).

**Acceptance criteria met**
- Add a shared Axios client.
- Attach the JWT automatically with a request interceptor.
- Handle auth failures consistently in one place.
- Update the app to use the shared client for API requests.
- Confirm existing auth and CRUD flows still work.

**Priority note**
This is a rubric-alignment ticket and is now complete in the current branch.

---

## Operational / final-delivery tickets

### ✅ CAP-006 — Provision production secrets and verify cluster configuration — COMPLETE
**Status**
Completed in the current branch and validated operationally in the EKS environment.

**Implementation evidence**
- The real Kubernetes secret was created outside source control in namespace `expense-dashboard` using the documented `expense-api-secrets` keys.
- The API and MongoDB deployments were restarted and verified healthy after secret-backed startup.
- Secure secret creation and deployment prerequisites are documented in [DEPLOYMENT.md](DEPLOYMENT.md).

**Acceptance criteria met**
- Create the real Kubernetes secret outside source control.
- Verify the API deployment reads the required secret values successfully.
- Confirm pods are healthy after secret injection.
- Document the secure secret creation process in deployment notes or README.

---

### CAP-007 — Verify the live public deployment end-to-end
**Description**
The repo contains Docker and Kubernetes assets, but the repository alone does not prove that the live EKS deployment is currently working.

**Current status note**
- Backend and frontend deployments have been rolled out successfully in EKS and pod health has been verified.
- The public frontend URL is now verified and reachable.
- Remaining proof points are the ingress hostname and any final browser demo screenshots or presentation artifacts.

**Status**
Mostly complete; live public URL verification passed.

**Acceptance criteria**
- Public URL loads the landing page at `/`.
- Public URL loads the React app at `/app`.
- Auth, dashboard data, and CRUD operations work in the live environment.
- Frontend and API pods are healthy in Kubernetes.
- The final public URL is added to the README.

---

### CAP-008 — Rehearse the final presentation
**Description**
Presentation readiness is part of the capstone deliverable and is not represented in source code.

**Acceptance criteria**
- Create a timed 10-minute demo outline and a 5-minute Q&A prep list.
- Assign speaking roles so every team member presents.
- Include: landing page, auth flow, CRUD flow, dashboard, architecture, and deployment overview.
- Practice using the live URL rather than localhost.
- Prepare a backup demo path in case the live environment is slow.

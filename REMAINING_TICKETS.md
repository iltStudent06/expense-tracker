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

### CAP-004 — Automate frontend deployment to ECR/EKS
**Description**
CI builds the frontend image, but the only deployment workflow in the repo targets the API. The frontend deployment still looks manual.

**Evidence**
- CI builds the frontend Docker image.
- The existing deployment workflow is API-only.
- Kubernetes already has a frontend deployment manifest waiting for an image update path.
- See [/.github/workflows/ci.yml](.github/workflows/ci.yml), [/.github/workflows/deploy-api.yml](.github/workflows/deploy-api.yml), and [k8s/expense-frontend-deployment.yaml](k8s/expense-frontend-deployment.yaml).

**Acceptance criteria**
- Add a GitHub Actions workflow that builds and pushes the frontend image to ECR.
- Update the `expense-frontend` deployment image automatically, or create one full-stack deployment workflow.
- Document required GitHub secrets/variables.
- Verify rollout success in the workflow output.

---

### CAP-005 — Align the frontend auth client with the written rubric
**Description**
Authentication works with a custom `fetch` wrapper, but the capstone instructions explicitly call for Axios interceptors.

**Evidence**
- Frontend requests are made through a custom `request()` helper using `fetch`.
- No Axios dependency is present in the frontend package.
- See [frontend/src/App.tsx](frontend/src/App.tsx) and [frontend/package.json](frontend/package.json).

**Acceptance criteria**
- Add a shared Axios client.
- Attach the JWT automatically with a request interceptor.
- Handle auth failures consistently in one place.
- Update the app to use the shared client for API requests.
- Confirm existing auth and CRUD flows still work.

**Priority note**
This is a **rubric-alignment** ticket. If the instructor is grading by behavior rather than library choice, it may be optional; if they are grading literally against the written spec, it should be completed.

---

## Operational / final-delivery tickets

### CAP-006 — Provision production secrets and verify cluster configuration
**Description**
The repo includes an example secret manifest, but production secrets should be created securely outside source control and verified in the cluster.

**Evidence**
- The repo contains [k8s/expense-api-secret.example.yaml](k8s/expense-api-secret.example.yaml), not a production-ready secret workflow.

**Acceptance criteria**
- Create the real Kubernetes secret outside source control.
- Verify the API deployment reads the required secret values successfully.
- Confirm pods are healthy after secret injection.
- Document the secure secret creation process in deployment notes or README.

---

### CAP-007 — Verify the live public deployment end-to-end
**Description**
The repo contains Docker and Kubernetes assets, but the repository alone does not prove that the live EKS deployment is currently working.

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

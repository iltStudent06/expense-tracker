# Deployment Guide

## Current deployment shape

The project currently runs in two main ways:

1. Local Docker Compose for full-stack validation
	- Nginx frontend container
	- Express API container
	- MongoDB container

2. Kubernetes manifests for the full app routing layer
	- `Namespace`
	- MongoDB `Deployment` + `Service` + `PersistentVolumeClaim`
	- API `Deployment`
	- API `Service`
	- frontend `Deployment`
	- frontend `Service`
	- `Ingress`
	- example `Secret`

Docker Compose remains the fastest local path. The Kubernetes manifests now cover the full stack, including in-cluster MongoDB, namespace setup, frontend public exposure, and optional ingress routing.

## Application routes and ports

### Docker Compose routes

- Landing page: `http://localhost:9000/`
- React app: `http://localhost:9000/app/`
- Login: `http://localhost:9000/app/login`
- Register: `http://localhost:9000/app/register`
- Categories: `http://localhost:9000/app/categories`
- API: `http://localhost:3000`
- Health: `http://localhost:3000/health`

### Default Compose ports

- Frontend host port: `9000` when started with `FRONTEND_PORT=9000`
- API host port: `3000`
- MongoDB host port: `27018`

## Local deployment with Docker Compose

From the repository root:

```bash
FRONTEND_PORT=9000 docker compose up --build -d
```

This starts:

- the Nginx frontend container
- the Express API container
- the MongoDB container

To rebuild only the frontend after UI changes:

```bash
FRONTEND_PORT=9000 docker compose up --build -d frontend
```

To rebuild only the API after backend changes:

```bash
docker compose up --build -d api
```

To stop the stack:

```bash
docker compose down
```

To stop and remove the database volume:

```bash
docker compose down -v
```

## Smoke test checklist after deployment

After the stack starts, verify:

1. `GET /health` returns `200`
2. the landing page loads at `/`
3. the React app loads at `/app/`
4. login and register pages load
5. a user can sign in
6. dashboard data loads
7. categories page loads and can create a category

Examples:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/dashboard
```

## Authentication in deployed environments

The API now includes JWT authentication.

Required auth routes:

- `POST /api/auth/register`
- `POST /api/auth/login`

Protected write routes require:

```text
Authorization: Bearer <token>
```

Protected routes include:

- `POST /api/transactions`
- `PUT /api/transactions/:id`
- `DELETE /api/transactions/:id`
- `POST /api/categories`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`

Important production note:

- do not rely on the development fallback JWT secret
- provide a real `JWT_SECRET` through environment variables or Kubernetes secrets

## Tests before deployment

Run backend tests from the repository root:

```bash
npm test
```

Run frontend tests:

```bash
cd frontend
npm test
```

Recommended pre-deploy sequence:

```bash
npm test
cd frontend && npm test && npm run build
```

## Kubernetes deployment notes

The repository currently includes these API manifests:

- [k8s/namespace.yaml](k8s/namespace.yaml)
- [k8s/expense-storageclass.yaml](k8s/expense-storageclass.yaml)
- [k8s/expense-mongo.yaml](k8s/expense-mongo.yaml)
- [k8s/expense-api-deployment.yaml](k8s/expense-api-deployment.yaml)
- [k8s/expense-api-service.yaml](k8s/expense-api-service.yaml)
- [k8s/expense-frontend-deployment.yaml](k8s/expense-frontend-deployment.yaml)
- [k8s/expense-frontend-service.yaml](k8s/expense-frontend-service.yaml)
- [k8s/expense-ingress.yaml](k8s/expense-ingress.yaml)
- [k8s/expense-api-secret.example.yaml](k8s/expense-api-secret.example.yaml)

### What the manifests currently do

- deploy 2 API replicas
- deploy 2 frontend replicas
- deploy MongoDB inside the cluster with persistent storage
- create an EKS Auto Mode EBS `StorageClass` for persistent volumes
- expose the API internally through a `ClusterIP` service
- expose the frontend publicly through a `LoadBalancer` service
- use readiness and liveness probes on `/health`
- use frontend health checks on `/`
- pull MongoDB credentials and connection settings from a Kubernetes secret
- pull `JWT_SECRET` from a Kubernetes secret
- use a rolling update strategy with `maxUnavailable: 0`
- run the container as a non-root user
- route `/api` to the API service through ingress
- route `/` and `/app` traffic to the frontend service through ingress

### Secret setup

Create the API secret before applying the deployment:

```bash
kubectl create secret generic expense-api-secrets \
	--from-literal=MONGO_ROOT_USERNAME='expense_user' \
	--from-literal=MONGO_ROOT_PASSWORD='expense_pass' \
	--from-literal=MONGO_URI='mongodb://expense_user:expense_pass@expense-mongo:27017/expense_dashboard?authSource=admin' \
  --from-literal=MONGO_DB='expense_dashboard' \
  --from-literal=MONGO_COLLECTION='transactions' \
	--from-literal=JWT_SECRET='<long-random-secret>' \
	-n expense-dashboard
```

Or copy and edit the example file first:

```bash
cp k8s/expense-api-secret.example.yaml /tmp/expense-api-secret.yaml
# edit values
kubectl apply -f /tmp/expense-api-secret.yaml
```

### Apply the manifests

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/expense-storageclass.yaml
kubectl apply -f k8s/expense-mongo.yaml
kubectl apply -f k8s/expense-api-deployment.yaml
kubectl apply -f k8s/expense-api-service.yaml
kubectl apply -f k8s/expense-frontend-deployment.yaml
kubectl apply -f k8s/expense-frontend-service.yaml
kubectl apply -f k8s/expense-ingress.yaml
kubectl rollout status deployment/expense-mongo -n expense-dashboard --timeout=180s
kubectl rollout status deployment/expense-api -n expense-dashboard --timeout=180s
kubectl rollout status deployment/expense-frontend -n expense-dashboard --timeout=180s
```

To test the API locally from the cluster without an ingress yet:

```bash
kubectl port-forward service/expense-api 3000:80
```

To test the frontend locally from the cluster without ingress:

```bash
kubectl port-forward service/expense-frontend 9000:80
```

### Kubernetes limitations right now

The current Kubernetes config does not yet include:

- TLS setup
- autoscaling rules

So the current k8s setup is full-stack and deployable, but TLS and autoscaling would still be the next production hardening steps.

## Frontend deployment plan

The frontend is currently production-ready in Docker because it is built by Vite and served by Nginx.

The repository now also includes an automated frontend deployment workflow at [.github/workflows/deploy-frontend.yml](.github/workflows/deploy-frontend.yml).

### Current runtime behavior

- `/` serves the landing page
- `/app/` serves the React app
- `/api/` proxies requests to the Express API

### Recommended Kubernetes approach for the frontend

The repository now includes:

1. a frontend `Deployment`
2. a frontend `Service`
3. an `Ingress` that routes:
	- `/` to the frontend service
	- `/app/` to the frontend service
	- `/api/` to the API service

This ingress-based route is the intended production entrypoint for the app.

### Why this is the preferred setup

- keeps the API service internal as `ClusterIP`
- lets the ingress controller handle public traffic
- preserves the same path-based routing already used in Docker Compose
- makes TLS and domain routing easier later

Because the frontend container image still includes a Docker Compose-oriented `/api/` proxy, the EKS deployment should be accessed through the Kubernetes ingress or ingress load balancer, not by browsing directly to the frontend service load balancer.

### Suggested frontend rollout flow

1. trigger `deploy-frontend.yml` manually or by pushing a `v*` tag
2. build and tag the frontend image from `frontend/Dockerfile`
3. scan the image with Trivy
4. push it to the configured Amazon ECR repository
5. apply/update the frontend `Deployment`, `Service`, and `Ingress`
6. update the `expense-frontend` image with `kubectl set image`
7. wait for `kubectl rollout status` success and inspect frontend pods

### GitHub Actions configuration for frontend deployment

The frontend deployment workflow is currently pinned to AWS region `us-east-1`.
The deployment workflows are currently pinned to EKS cluster `expense-dashboard-capstone`.
The deployment workflows are currently pinned to Kubernetes namespace `expense-dashboard`.
The frontend deployment workflow is currently pinned to ECR repository `capstone-frontend`.
The deployment workflows are currently pinned to IAM role `arn:aws:iam::180294218913:role/github-actions-expense-tracker-deploy` for GitHub Actions OIDC authentication.

### Link the AWS account to the GitHub repository

The deployment workflows use GitHub Actions OIDC. That means GitHub does not need long-lived AWS access keys in the repository. Instead, GitHub requests a short-lived AWS token by assuming an IAM role.

Repository scope for this project:

- GitHub repository: `iltStudent06/expense-tracker`
- AWS region: `us-east-1`
- EKS cluster: `expense-dashboard-capstone`
- Kubernetes namespace: `expense-dashboard`
- API ECR repository: `capstone-api`
- Frontend ECR repository: `capstone-frontend`

#### 1. Create the GitHub OIDC identity provider in AWS IAM

In AWS Console:

1. Open IAM.
2. Go to Identity providers.
3. Add provider.
4. Provider type: `OpenID Connect`.
5. Provider URL: `https://token.actions.githubusercontent.com`.
6. Audience: `sts.amazonaws.com`.

If this provider already exists in the account, reuse it.

#### 2. Create an IAM role for GitHub Actions

Create a role that trusts the GitHub OIDC provider and allows this repository to assume it.

Recommended trust policy:

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Principal": {
				"Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
			},
			"Action": "sts:AssumeRoleWithWebIdentity",
			"Condition": {
				"StringEquals": {
					"token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
				},
				"StringLike": {
					"token.actions.githubusercontent.com:sub": "repo:iltStudent06/expense-tracker:*"
				}
			}
		}
	]
}
```

If you want to lock deployment down further later, you can narrow the `sub` condition to specific branches or tags.

#### 3. Attach AWS permissions to that role

The role needs permission to:

- push images to ECR repositories `capstone-api` and `capstone-frontend`
- read the EKS cluster description for `expense-dashboard-capstone`
- use `kubectl` against the cluster after AWS authentication succeeds

At minimum, the IAM policy should allow these AWS API actions:

- `ecr:GetAuthorizationToken`
- `ecr:BatchCheckLayerAvailability`
- `ecr:InitiateLayerUpload`
- `ecr:UploadLayerPart`
- `ecr:CompleteLayerUpload`
- `ecr:PutImage`
- `ecr:BatchGetImage`
- `ecr:DescribeRepositories`
- `eks:DescribeCluster`

#### 4. Grant that IAM role access to the EKS cluster

AWS IAM permission alone is not enough for `kubectl`. The role also needs Kubernetes access inside the EKS cluster.

Use one of these approaches:

- create an EKS access entry for the role, or
- map the role in the cluster auth configuration if your cluster still uses that older pattern

The role must be allowed to create/update resources in namespace `expense-dashboard`.

#### 5. Confirm the workflow role ARN

The repository workflows now reference the deploy role ARN directly in code:

```text
arn:aws:iam::180294218913:role/github-actions-expense-tracker-deploy
```

So no GitHub Actions secret is required for the role ARN unless you choose to move it back into repository secrets later.

#### 6. First deploy prerequisite for the API

The workflows can create namespace `expense-dashboard` automatically because they apply [k8s/namespace.yaml](k8s/namespace.yaml).

However, the API deployment also depends on the Kubernetes secret `expense-api-secrets`, which is namespaced. That secret must exist in `expense-dashboard` before the API pods can start successfully.

The API deployment workflow applies the in-cluster MongoDB manifest automatically before rolling out the API.

Safe first-deploy order:

1. create the namespace once with `kubectl apply -f k8s/namespace.yaml`
2. create `expense-api-secrets` in namespace `expense-dashboard`
3. run the API deployment workflow
4. run the frontend deployment workflow

#### 7. Quick verification checklist

Before triggering the workflows, verify:

- the IAM OIDC provider exists
- the workflow role ARN still matches the created IAM role
- ECR repositories `capstone-api` and `capstone-frontend` exist
- EKS cluster `expense-dashboard-capstone` exists
- an ingress controller that supports class `nginx` is installed in the cluster
- namespace `expense-dashboard` exists or can be created
- API secret `expense-api-secrets` exists in namespace `expense-dashboard`

### Important routing note

In Kubernetes, external `/api` traffic should go through ingress directly to the API service.

That means the recommended access path is through the ingress hostname or load balancer, not through direct frontend service exposure for normal end-user traffic.

## Production deployment plan

At a high level:

1. Run tests locally or in CI
2. Build an immutable Docker image
3. Scan the image for vulnerabilities
4. Push the image to a registry such as Amazon ECR
5. Update the Kubernetes deployment to the new image tag
6. Wait for rollout success
7. Run post-deploy health and API checks

## Chosen target and trade-offs

### Docker Compose on a single host

Pros:

- fastest to set up
- lowest complexity
- good for demos and small environments

Cons:

- manual scaling
- weaker high availability story
- more manual ops work

### EKS / Kubernetes

Pros:

- rolling updates
- better scaling model
- better orchestration and health recovery

Cons:

- more infrastructure complexity
- higher cost
- more secrets/networking configuration work

## Secrets handling in production

Production secrets should not be committed.

Recommended pattern:

- secret manager or CI secret store
- injected into Kubernetes `Secret` objects or runtime environment variables
- consumed by the container at startup

Required sensitive values include:

- `MONGO_URI`
- `JWT_SECRET`
- any future cloud credentials or third-party API keys

## Scaling guidance

Scale horizontally when:

- request volume increases
- API latency rises under concurrent load
- health checks stay good but throughput needs grow

Scale vertically when:

- each process needs more CPU or memory
- workloads are heavier per request
- you are still at low replica counts and want simpler capacity growth first

## Cost considerations

Typical cloud cost drivers:

- container registry storage
- cluster compute
- load balancers
- logging and metrics
- managed secret storage
- managed database costs if MongoDB is hosted externally

Ways to reduce cost:

1. expire old container images
2. reduce log retention where safe
3. keep non-production environments small
4. scale replicas based on actual traffic
5. avoid oversized worker nodes

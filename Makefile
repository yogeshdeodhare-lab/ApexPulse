# ─────────────────────────────────────────────────────────────────────────────
# APEX Pulse — Makefile
# All targets use variables at the top so nothing is hard-coded.
# Override from command line: make docker-push IMAGE=myregistry.io/apex-pulse TAG=1.2.3
# ─────────────────────────────────────────────────────────────────────────────

IMAGE   ?= apex-pulse
TAG     ?= latest
NS      ?= apex-pulse

.PHONY: help dev build start typecheck \
        db-push db-seed db-migrate db-reset db-studio \
        docker-build docker-push docker-up docker-down docker-logs \
        k8s-apply k8s-delete k8s-status k8s-logs \
        auth-hash install clean

help:
	@echo "APEX Pulse — available targets:"
	@echo ""
	@echo "  Development"
	@echo "    make dev             Start Next.js dev server"
	@echo "    make build           Production build"
	@echo "    make start           Start production server (requires build)"
	@echo "    make typecheck       Run tsc --noEmit"
	@echo "    make install         npm install"
	@echo ""
	@echo "  Database"
	@echo "    make db-push         Prisma db push (dev — no migration history)"
	@echo "    make db-seed         Run seed script"
	@echo "    make db-migrate      Prisma migrate deploy (production)"
	@echo "    make db-reset        Force reset + re-seed (dev only)"
	@echo "    make db-studio       Open Prisma Studio"
	@echo ""
	@echo "  Auth"
	@echo "    make auth-hash       Interactively hash a password for a DB user"
	@echo ""
	@echo "  Docker"
	@echo "    make docker-build    Build image (IMAGE=$(IMAGE):$(TAG))"
	@echo "    make docker-push     Push image to registry"
	@echo "    make docker-up       Start services via docker compose"
	@echo "    make docker-down     Stop services"
	@echo "    make docker-logs     Tail app logs"
	@echo ""
	@echo "  Kubernetes"
	@echo "    make k8s-apply       Apply all manifests to namespace $(NS)"
	@echo "    make k8s-delete      Delete all resources in namespace $(NS)"
	@echo "    make k8s-status      Show pods, services, and ingress"
	@echo "    make k8s-logs        Tail app pod logs"

# ── Development ───────────────────────────────────────────────────────────────

install:
	npm install

dev:
	npm run dev

build:
	npm run build

start:
	npm run start

typecheck:
	npm run typecheck

# ── Database ──────────────────────────────────────────────────────────────────

db-push:
	npx prisma db push

db-seed:
	npm run db:seed

db-migrate:
	npx prisma migrate deploy

db-reset:
	npx prisma db push --force-reset && npm run db:seed

db-studio:
	npx prisma studio

# ── Auth ──────────────────────────────────────────────────────────────────────

auth-hash:
	npm run auth:hash-password

# ── Docker ────────────────────────────────────────────────────────────────────

docker-build:
	docker build -t $(IMAGE):$(TAG) .

docker-push:
	docker push $(IMAGE):$(TAG)

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f app

# ── Kubernetes ────────────────────────────────────────────────────────────────

k8s-apply:
	kubectl apply -f k8s/namespace.yaml
	kubectl apply -f k8s/configmap.yaml
	kubectl apply -f k8s/secret.yaml
	kubectl apply -f k8s/deployment.yaml
	kubectl apply -f k8s/service.yaml

k8s-delete:
	kubectl delete namespace $(NS) --ignore-not-found

k8s-status:
	kubectl get pods,svc,ingress -n $(NS)

k8s-logs:
	kubectl logs -n $(NS) -l app=apex-pulse --tail=100 -f

# ── Utility ───────────────────────────────────────────────────────────────────

clean:
	rm -rf .next node_modules

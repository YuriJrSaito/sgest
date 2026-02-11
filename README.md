# SGest Backend

API REST para gerenciamento de usuarios, autenticacao, convites, produtos, kits, permissoes e notificacoes.

Este README foi refeito para refletir o estado atual do projeto.

## Stack

- Node.js
- TypeScript
- Fastify
- PostgreSQL
- Redis
- Docker e Docker Compose
- tsyringe (DI)
- Jest + Supertest (testes)

## Requisitos

- Node.js 24 (recomendado para ambiente local)
- npm
- Docker e Docker Compose

## Setup rapido

1. Instale dependencias:

```bash
npm install
```

2. Crie o arquivo de ambiente:

```bash
cp .env.example .env
```

3. Suba o ambiente completo com Docker:

```bash
docker compose up -d
```

4. Verifique a saude da API:

```bash
curl http://localhost:3005/health
```

## Portas no Docker Compose

- Backend API: `http://localhost:3005`
- Frontend Next.js: `http://localhost:3000`
- Nginx: `http://localhost:8080`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Execucao em desenvolvimento

### Opcao A: tudo em Docker

```bash
docker compose up -d
docker compose logs -f app
```

### Opcao B: app local + banco/cache em Docker

1. Suba apenas dependencias:

```bash
docker compose up -d postgres redis
```

2. Ajuste `.env` para ambiente local (exemplo):

```env
DB_HOST=localhost
REDIS_HOST=localhost
```

3. Rode a API localmente:

```bash
npm run dev
```

## Variaveis de ambiente obrigatorias

Validadas em `src/config/env.ts`:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `FRONTEND_URL`

Use `.env.example` como base.

## Scripts principais

```bash
npm run dev                 # tsx watch (desenvolvimento)
npm run build               # compila TypeScript
npm start                   # executa build em dist

npm test                    # todos os testes
npm run test:unit           # testes unitarios
npm run test:integration    # testes de integracao
npm run test:coverage       # cobertura

npm run guardrails:arch     # regras arquiteturais
npm run db:sync             # sincronizacao db (shell)
npm run db:sync:win         # sincronizacao db (powershell)
npm run db:reset            # reset db (shell)
npm run db:reset:win        # reset db (powershell)
```

## Rotas principais

### Health

- `GET /health`

### Auth (`/api/auth`)

- `POST /login`
- `POST /refresh`
- `POST /logout`
- `POST /logout-all`
- `GET /profile`
- `PUT /profile`
- `POST /change-password`
- `GET /sessions`
- `DELETE /sessions/:sessionId`
- `GET /audit/login-history`
- `GET /audit/history`
- `GET /audit/stats`

### Outros modulos

- `/api/users`
- `/api/invites`
- `/api/products`
- `/api/kits`
- `/api/kit-items`
- `/api/permissions`
- `/api/notifications`

Para contratos detalhados, consulte os schemas em `src/modules/*/schemas.ts`.

## Estrutura resumida

```text
src/
  config/
  middlewares/
  modules/
    auth/
    invites/
    kits/
    notifications/
    permissions/
    product/
    users/
  types/
  utils/
```

## Banco e dados iniciais

- Scripts SQL em `docker-init/` sao executados automaticamente na primeira inicializacao do volume do Postgres.
- Para reinicializar totalmente os dados:

```bash
docker compose down -v
docker compose up -d
```

## Qualidade e arquitetura

- Guardrails arquiteturais em `scripts/architecture-guardrails.mjs`
- Documentacao arquitetural e de processo e mantida internamente (fora do repositorio publico)

## Troubleshooting rapido

- API nao sobe em Docker:
  - verifique `docker compose logs -f app`
  - confirme variaveis obrigatorias no `.env`
- Erro de conexao no banco:
  - confira `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Falhas em testes de integracao:
  - rode `npm test -- --runInBand`
  - confira configuracao de `src/__tests__/globalSetup.ts`

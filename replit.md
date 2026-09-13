# Master Class

Plateforme interactive d’enseignement pour administrer les utilisateurs, les classes et les modules VittaScience.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/master-class` — application web React/Vite et parcours administrateur
- `artifacts/api-server` — API Express, protection Clerk et données de démonstration
- `lib/api-spec/openapi.yaml` — contrat API source de vérité
- `lib/db/src/schema/index.ts` — schéma PostgreSQL Drizzle

## Architecture decisions

- Clerk gère la session navigateur; l’API vérifie la session côté serveur avant les routes admin.
- La création de compte public est désactivée : l’administrateur crée les comptes Clerk des enseignants et étudiants depuis la gestion des utilisateurs.
- Les mots de passe ne sont jamais stockés dans Master Class; ils sont transmis à Clerk uniquement lors de la création du compte.
- Les contrats sont définis dans OpenAPI puis générés en hooks React Query et schémas Zod.
- Les affectations sont modélisées comme des relations classe–enseignant, classe–étudiants et classe–modules.
- Les modules conservent les liens officiels VittaScience pour préparer l’ouverture des éditeurs et activités.

## Product

L’administrateur peut consulter les indicateurs de son établissement, gérer les utilisateurs et les classes, affecter un enseignant, plusieurs étudiants et plusieurs modules à chaque classe, et parcourir le catalogue VittaScience.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Après toute modification de `lib/api-spec/openapi.yaml`, relancer le codegen avant le typecheck du frontend.
- Le seed de démonstration est idempotent et s’exécute au démarrage de l’API uniquement si la base est vide.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

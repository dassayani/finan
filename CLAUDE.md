# Orça — SaaS de Controle Financeiro Pessoal

> **Atenção:** Este projeto usa Next.js 16.x e React 19, com Tailwind 4. APIs, convenções e estrutura de arquivos diferem do que está no training data. Leia `node_modules/next/dist/docs/` antes de escrever código Next.js. Heed deprecation notices.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16.2.6 — App Router |
| UI | React 19.2.4 + Tailwind 4 (`@import "tailwindcss"`, não `@tailwind base`) |
| ORM | Prisma 7 + `@prisma/adapter-pg` (driver adapter, não o default) |
| Banco | PostgreSQL via Supabase |
| Auth | NextAuth v4 + `@auth/prisma-adapter` (credentials + Google OAuth) |
| Forms | react-hook-form v7 + Zod v4 |
| Gráficos | Recharts 3 |
| Datas | date-fns v4 |
| Testes | Vitest + @testing-library/react |
| Fontes | Space Grotesk (display/números) + Plus Jakarta Sans (corpo) |

## Comandos

```bash
npm run dev              # servidor local
npm run build            # prisma generate + next build
npm run test             # vitest run
npm run test:watch       # vitest watch
npm run test:realdb      # testes de integração com banco real (RUN_REAL_DB_TESTS=1)
npx prisma migrate dev   # criar e aplicar migration
npx prisma studio        # visualizar banco
npx prisma generate      # regenerar client (já roda no postinstall)
```

## Estrutura

```
src/
  app/
    (auth)/           # login, register — sem sidebar
    (dashboard)/      # mes, dashboard, creditos, debito, assinaturas, bancos, investimentos, transactions
    api/              # route handlers — um diretório por recurso
  components/
    ui/               # componentes genéricos (botão, input, modal…)
    dashboard/        # componentes de tela específicos
    layout/           # sidebar, header, nav
    providers/        # SessionProvider, etc.
  lib/
    constants.ts      # BANKS, CATEGORIES, formatBRL, getMonthName
    prisma.ts         # singleton do PrismaClient
  types/
prisma/
  schema.prisma       # fonte de verdade do banco
```

## Design System

**CSS vars** em `src/app/globals.css` — use vars, não valores hardcoded.

```
Cores semânticas:   --pos (#0E9F6E)  --neg (#DC4B4B)  --warn (#C98A1E)  --accent (#15543D)
Superfícies:        --canvas --surface --surface-2 --surface-3
Texto:              --ink  --ink-2  --ink-3
Bordas:             --line  --line-2
```

**Bancos** — 7 bancos com CSS vars próprias (`--b-{key}`, `--b-{key}-soft`, `--b-{key}-on`):
`caixa` `bb` `itau` `nubank` `picpay` `inter` `mp`

**Categorias** — 14 chaves em `CATEGORIES` (`src/lib/constants.ts`):
`casa` `alim` `imprev` `transp` `saude` `pet` `assin` `lazer` `compras` `trab` `viagem` `reserva` `tarifas` `reemb`

**Formatação monetária:** sempre use `formatBRL()` de `src/lib/constants.ts`.

**Números:** adicione a classe `.num` (font-variant-numeric: tabular-nums) em valores monetários.

## Tailwind 4 — diferenças importantes

- Import: `@import "tailwindcss"` (não `@tailwind base/components/utilities`)
- Temas via CSS vars, não via `tailwind.config.js`
- Plugins de forma diferente — verificar docs antes de adicionar

## Prisma 7 — diferenças importantes

- Usa driver adapter (`@prisma/adapter-pg`) — o `PrismaClient` é instanciado com `new Pg.Pool()`
- `prisma.config.ts` na raiz define a configuração
- Sem `DATABASE_URL` direto no schema — URL vai no adapter via env

## Git Hooks (Husky)

| Hook | Quando | O que roda |
|------|--------|-----------|
| `pre-commit` | todo `git commit` | `npm test` |
| `pre-push` | todo `git push` | `npm test` + `npm run test:realdb` (se `RUN_REAL_DB_TESTS`, `TEST_DIRECT_URL` ou `DATABASE_URL` estiverem definidas) |

Nunca use `--no-verify` para pular os hooks. Se um teste falhar antes do commit, corrija o teste.

## Regras do projeto

- **Não** use `any` no TypeScript
- **Não** use `db.Decimal` diretamente no frontend — converta para `number` na API
- **Não** mocke o banco em testes que validam queries — use `test:realdb`
- **Não** hardcode cores de banco ou categoria — use `BANKS[key].color` ou `CATEGORIES[key].color`
- **Não** crie migration sem antes revisar o schema inteiro — relações têm cascades
- Auth: o `userId` da sessão vem de `session.user.id` (NextAuth) — sempre filtrar queries por `userId`

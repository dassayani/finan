# SmartWallet+ (codinome "Orça") — SaaS de Controle Financeiro Pessoal

> **Atenção:** Este projeto usa Next.js 16.x e React 19, com Tailwind 4. APIs, convenções e estrutura de arquivos diferem do que está no training data. Leia `node_modules/next/dist/docs/` antes de escrever código Next.js. Heed deprecation notices.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16.2.6 — App Router |
| UI | React 19.2.4 + Tailwind 4 (`@import "tailwindcss"`, não `@tailwind base`) |
| Ícones | `OrcaIcon` (SVG inline próprio) — **não use lucide-react nos componentes** |
| ORM | Prisma 7 + `@prisma/adapter-pg` (driver adapter, não o default) |
| Banco | PostgreSQL via Supabase |
| Auth | NextAuth v4 + `@auth/prisma-adapter` (credentials + Google OAuth) |
| Forms | react-hook-form v7 + Zod v4 |
| Gráficos | Recharts 3 |
| Datas | date-fns v4 |
| Testes | Vitest + @testing-library/react (instalada; testes de componente ainda não existem) |
| Fontes | Space Grotesk (display/números) + Plus Jakarta Sans (corpo) |

## Comandos

```bash
npm run dev              # servidor local
npm run build            # prisma generate + next build
npm run test             # vitest run (unit + integration mockada)
npm run test:watch       # vitest watch
npm run test:realdb      # testes com banco real (RUN_REAL_DB_TESTS=1)
npx prisma migrate dev   # criar e aplicar migration (requer DIRECT_URL)
npx prisma studio        # visualizar banco
npx prisma generate      # regenerar client (já roda no postinstall)
npx tsc --noEmit         # checar tipos (build ignora erros — ver next.config.ts)
```

## Estrutura

```
src/
  app/
    (auth)/               # login, register — sem sidebar
    (dashboard)/          # dashboard, creditos, debito, assinaturas,
    │                     # bancos, investimentos, transactions
    │                     # /mes redireciona para /dashboard (views unificadas)
    api/                  # route handlers — um diretório por recurso
    globals.css           # FONTE DE VERDADE do design system: CSS vars + utility classes
    layout.tsx            # root layout (fontes, providers)
  components/
    ui/                   # botão, input, modal, OrcaIcon, MonthPill, BankBadge, PayToggle…
    dashboard/            # componentes de tela específicos
    transactions/         # transaction-form, transaction-list
    layout/               # sidebar (colapsável, persiste em localStorage)
    providers/            # SessionProvider
  lib/
    constants.ts          # BANKS, CATEGORIES, formatBRL, getMonthName
    utils.ts              # cn() (clsx+twMerge), formatDate() — NÃO use formatCurrency() daqui
    network.ts            # fetchWithTimeoutAndRetry() — use para fetch client-side com retry
    prisma.ts             # singleton PrismaClient com PrismaPg adapter
    auth.ts               # authOptions (NextAuth)
    hooks/                # use-dashboard-mensal, use-dashboard-anual
  types/
    index.ts
    next-auth.d.ts        # extensão: session.user.id tipado como string
    dashboard.ts          # tipos da API de dashboard
prisma/
  schema.prisma           # fonte de verdade do banco
prisma.config.ts          # configura qual URL usar nas migrations
tests/
  api/                    # testes de integração com Prisma mockado (vi.hoisted)
  api-real/               # testes com banco real (test:realdb)
  contracts/              # contract tests
  lib/                    # unit tests de lib
  setup.ts                # env vars para NextAuth nos testes
docs/
  merge-gates.md          # CI/CD e proteção de branch no GitHub
```

## Sistema de ícones — OrcaIcon

O projeto tem sistema próprio de ícones SVG. **Nunca use `lucide-react` diretamente nos componentes.** Use `OrcaIcon`:

```tsx
import { OrcaIcon } from "@/components/ui/orca-icon";
<OrcaIcon name="wallet" size={18} style={{ color: "var(--accent)" }} />
```

**Ícones disponíveis:**
`dashboard` `calendar` `arrowDown` `arrowUp` `trend` `wallet` `close` `card` `repeat` `plus` `chevL` `chevR` `check` `users` `filter` `pie` `edit` `dots` `trash` `coins` `flame` `music` `play` `tv` `logout` `headphones` `star` `globe` `book` `cloud` `phone` `game` `wifi` `settings` `upload`

> Se precisar de um ícone fora dessa lista, adicione o path SVG em `src/components/ui/orca-icon.tsx`.

## Design System — CSS utility classes

**O design system vive em `src/app/globals.css`.** São classes CSS customizadas — não Tailwind. Use-as antes de escrever estilos inline.

### Layout

| Classe | Uso |
|--------|-----|
| `.content` | wrapper de conteúdo de página (`padding: 26px 30px`) |
| `.topbar` / `.topbar-l` / `.topbar-r` | barra superior de página |
| `.r-grid-sidebar` | grid 320px + 1fr (análise + razão) |
| `.r-grid-preview` | grid 1fr + 360px |
| `.r-grid-dash` | grid 1.6fr + 1fr |
| `.r-grid-credits` | grid 1.1fr + .9fr |
| `.r-grid-2col` | grid 1fr + 1fr |
| `.r-grid-banks` | grid 2 colunas para cards de banco |
| `.r-kpi-2/3/4/5` | grids de KPIs com gap |
| `.r-months-grid` | 12 colunas para calendário mensal |
| `.field-row-2` / `.field-row-3` | grids de formulário (colapsam no mobile) |

### Componentes base

| Classe | Uso |
|--------|-----|
| `.card` | container branco com borda e sombra |
| `.card-pad` | `.card` + `padding: 20px` |
| `.card-head` | cabeçalho de card com flex + border-bottom |
| `.card-title` | título de card (Space Grotesk, bold) |
| `.kpi` | card KPI com padding específico |
| `.kpi-label` / `.kpi-val` / `.kpi-val.sm` / `.kpi-delta` | subelementos de KPI |
| `.btn` / `.btn-primary` / `.btn-ghost` / `.btn-icon` | botões |
| `.seg` | segmented control (tabs inline) |
| `.row` / `.row-l` / `.row-name` / `.row-meta` | linha de lista |
| `.bar` | barra de progresso (`<div class="bar"><span style="width:X%" /></div>`) |
| `.chip` | tag/etiqueta pequena |
| `.status.paid` / `.status.pending` | badge de status |
| `.pay-toggle` / `.pay-toggle.is-paid` | toggle de pagamento |
| `.section-label` | label de seção (uppercase, tracking) |
| `.field` | wrapper de campo de formulário |
| `.orça-input` | input estilizado do projeto |
| `.num` | `font-variant-numeric: tabular-nums` — **sempre usar em valores monetários** |
| `.muted` | cor `--ink-3` |
| `.amt.pos` / `.amt.neg` / `.amt.muted` | valor monetário colorido |
| `.tag-fixo` / `.tag-var` | tags de tipo de despesa |
| `.switch` / `.switch.on` | toggle switch |
| `.crumb` | breadcrumb no topbar |
| `.page-title` | título principal de página |
| `.divider` | separador horizontal |

### Sidebar

Colapsável — estado persiste em `localStorage("sidebar-collapsed")`. Auto-colapsa no mobile (`< 768px`). Quando colapsado, aplica `body.sidebar-collapsed`, que ajusta `.sidebar-offset`.

## Design System — CSS vars

**Em `src/app/globals.css`.** Use vars, nunca valores hardcoded.

```
Semânticas:  --pos (#0E9F6E)  --neg (#DC4B4B)  --warn (#C98A1E)  --accent (#15543D)
Soft:        --pos-soft  --neg-soft  --warn-soft  --accent-soft
Superfícies: --canvas  --surface  --surface-2  --surface-3
Texto:       --ink  --ink-2  --ink-3
Bordas:      --line  --line-2
Raios:       --r-xs  --r-sm  --r-md  --r-lg  --r-xl
Sombras:     --shadow-sm  --shadow-md  --shadow-lg
Fontes:      --font-display (Space Grotesk)  --font-body (Plus Jakarta Sans)
```

**Bancos fixos** — CSS vars `--b-{key}` / `--b-{key}-soft` / `--b-{key}-on`:
`caixa` `bb` `itau` `nubank` `picpay` `inter` `mp`

**Bancos customizados** — modelo `CustomBank` no schema, APIs em `/api/custom-banks`. Não confundir com o enum `BankKey`. No formulário de despesas, o seletor usa prefixo: `std:{bankKey}` para bancos fixos, `cst:{customBankId}` para bancos customizados.

**Categorias** — 14 chaves em `CATEGORIES` (`src/lib/constants.ts`):
`casa` `alim` `imprev` `transp` `saude` `pet` `assin` `lazer` `compras` `trab` `viagem` `reserva` `tarifas` `reemb`

## Formatação e utilitários

- **Moeda:** `formatBRL(value)` de `src/lib/constants.ts` — com sinal: `formatBRL(value, { sign: true })`
- **Não use:** `formatCurrency()` de `utils.ts` — usa `Intl.NumberFormat`, gera resultado diferente do restante do projeto (símbolo, espaçamento)
- **Classes CSS:** `cn(...classes)` de `src/lib/utils.ts` para combinar condicionalmente
- **Datas locais:** use `parseLocalDate(str)` e `formatLocalDate(date)` para evitar UTC day-shift. Essas funções estão duplicadas em `creditos`, `debito`, `assinaturas` — ao criar nova página que manipule datas, extraia para `src/lib/utils.ts`.
- **Fetch com retry:** `fetchWithTimeoutAndRetry()` de `src/lib/network.ts` (timeout 8s, 2 retries, exponential backoff)
- **Valores monetários:** adicione `.num` para tabular-nums

## Tailwind 4 — diferenças importantes

- Import: `@import "tailwindcss"` (não `@tailwind base/components/utilities`)
- Temas via CSS vars, não via `tailwind.config.js`
- A maioria dos estilos do projeto são classes CSS customizadas em `globals.css`, não Tailwind

## Prisma 7 — diferenças importantes

- Usa driver adapter `PrismaPg` de `@prisma/adapter-pg`
- `prisma.ts` conecta com `DIRECT_URL ?? DATABASE_URL` — o adapter pg não suporta pgbouncer (6543)
- `prisma.config.ts` usa `DIRECT_URL` para migrations (session mode, porta 5432)
- Sem `DATABASE_URL` no schema — URL vai no adapter via env
- **Não** use `db.Decimal` no frontend — converta para `number` na API
- **Não** crie migration sem revisar o schema inteiro — há cascades em User → todos os modelos

### Salary / Bonus — encoding especial de mês

| Tipo | Mês no DB | Significado |
|------|-----------|-------------|
| Template base | `month: 0, year: 0` | Salário padrão (sem mês) |
| PLR junho | `month: 1406` | PLR_BASE (1400) + payMonth |
| Décimo dezembro | `month: 1312` | DECIMO_BASE (1300) + payMonth |

## APIs — Comportamentos não-óbvios

### `/api/transactions`

- **POST batch:** aceita `[...items]` ou `{ items: [...] }` — retorna HTTP 207 em falha parcial
  ```json
  { "mode": "batch", "total": 5, "successCount": 4, "failedCount": 1, "failures": [...] }
  ```
- **DELETE por grupo:** `?groupId=xxx` — deleta todas as parcelas do grupo
- **DELETE por banco:** `?bank=nubank&month=6&year=2026` — deleta todas as transações do banco naquele mês
- **PATCH por banco:** `?bank=nubank&month=6&year=2026` — atualiza `isPaid` em bulk

### `/api/salary`

- `GET ?month=0&year=0` retorna o template base
- `GET ?month=6&year=2026` retorna `{ template, monthSalary, effective, source }` — `effective` é o salário que deve ser usado (mês atual > mês anterior > template)

### `/api/bonus`

- Gerencia PLR e Décimo Terceiro usando o modelo `Salary` com meses encodados
- POST também cria automaticamente uma `Transaction` de INCOME com `groupId = bonus-{type}-{year}-{payMonth}-{userId}`

### `/api/bank-closing-balance`

Retorna o saldo de fechamento de cada banco no fim do mês solicitado.

**Fórmula:** `inicial + entradas - saídas - fees - paidBillExpenses + paidBillEstornos`

- `inicial` = valor em `BankBalance` para aquele mês (0 se não houver registro)
- Retorna `null` para bancos **sem atividade** no mês (não retorna 0) — o chamador decide carry-forward
- Suporta bancos customizados: resposta usa o `id` do `CustomBank` como chave, não o `BankKey`
- `?month=6&year=2026` — parâmetros obrigatórios

### `/api/bank-entries` — DELETE modos

- `?groupId=xxx` — deleta pelo groupId
- `?descriptionBase=Aluguel[&bank=nubank][&customBankId=xxx]` — fallback para entradas sem groupId:
  - Parcelas: deleta onde `description LIKE 'Aluguel %'`
  - Mensais/únicos: deleta onde `description = 'Aluguel'`
  - Filtro de banco é opcional

## Testes

### Arquitetura

```
tests/
  lib/          # unit tests (ex.: network.test.ts)
  api/          # integração com Prisma mockado (sem banco real)
  contracts/    # contract tests: validam o shape das respostas com Zod
  api-real/     # integração com banco real (describeRealDb / test:realdb)
  setup.ts      # env vars do NextAuth injetadas antes dos testes
```

`vitest.config.ts` — `environment: "node"`, `globals: true`, alias `@` → `src/`, `setupFiles: ["./tests/setup.ts"]`.

### Padrão de mock nos testes de integração

Todos os arquivos de `tests/api/` usam o mesmo padrão com `vi.hoisted()`:

```ts
const { prismaMock, getServerSessionMock } = vi.hoisted(() => ({
  prismaMock: {
    transaction: { create: vi.fn(), findMany: vi.fn() },
    // ... somente os métodos usados no teste
  },
  getServerSessionMock: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/auth",  () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

// imports das route handlers DEPOIS dos mocks
import { POST } from "@/app/api/transactions/route";
```

> `vi.hoisted()` é necessário porque o Vitest eleva `vi.mock()` para o topo do arquivo. Os mocks precisam estar disponíveis antes dos imports das routes.

### Padrão real-db (`tests/api-real/`)

```ts
const runRealDb = process.env.RUN_REAL_DB_TESTS === "1";
const describeRealDb = runRealDb ? describe : describe.skip;

describeRealDb("nome", () => {
  let userId = "";

  beforeEach(async () => {
    const user = await prisma.user.create({ data: { email: `test-${Date.now()}@example.com`, name: "Test" } });
    userId = user.id;
    getServerSessionMock.mockResolvedValue({ user: { id: userId } });
  });

  afterEach(async () => {
    if (userId) { await prisma.user.delete({ where: { id: userId } }); userId = ""; }
  });
});
```

- `TEST_DIRECT_URL` — se definida, é copiada para `DIRECT_URL` no início do arquivo. Use quando o banco de testes usa URL diferente do banco de dev.
- `RUN_REAL_DB_TESTS=1` ativa os testes; sem ela, `describe.skip` pula silenciosamente.

### Contract tests (`tests/contracts/`)

Usam um schema Zod para validar o shape das respostas batch de forma agnóstica à lógica:

```ts
const batchContractSchema = z.object({
  mode: z.literal("batch"),
  total: z.number().int().nonnegative(),
  successCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  created: z.array(z.object({ index: z.number(), id: z.string() })),
  failures: z.array(z.object({ index: z.number(), error: z.string().min(1) })),
});
```

Invariante: `successCount + failedCount === total`.

### O que está coberto vs o que falta

| Área | Status |
|------|--------|
| bank-balances, bank-entries, bank-fees, bank-configs | ✅ integração + auth matrix |
| custom-banks, custom-bank-fees, custom-bank-balances | ✅ auth matrix |
| bank-closing-balance | ✅ integração mockada + real-db |
| transactions POST (single + batch) | ✅ integração |
| network.ts (`fetchWithTimeoutAndRetry`) | ✅ unit |
| transactions GET / DELETE / PATCH | ❌ sem testes |
| salary, bonus | ❌ sem testes |
| subscriptions, investments | ❌ sem testes |
| dashboard API | ❌ sem testes |
| componentes UI (React) | ❌ @testing-library/react instalada mas sem uso |

## Build — TypeScript

`next.config.ts` tem `ignoreBuildErrors: true` — erros de TypeScript **não** bloqueiam o build do Vercel. A checagem de tipos deve ser feita localmente:

```bash
npx tsc --noEmit
```

## Git Hooks (Husky)

| Hook | Quando | O que roda |
|------|--------|-----------|
| `pre-commit` | todo `git commit` | `npm test` |
| `pre-push` | todo `git push` | `npm test` + `npm run test:realdb` (se `RUN_REAL_DB_TESTS`, `TEST_DIRECT_URL` ou `DATABASE_URL` estiverem definidas) |

Nunca use `--no-verify` para pular os hooks. Se um teste falhar, corrija o teste.

## Regras do projeto

- **Não** use `any` no TypeScript
- **Não** use `db.Decimal` diretamente no frontend — converta para `number` na API
- **Não** mocke o banco em testes que validam queries — use `test:realdb`
- **Não** hardcode cores de banco ou categoria — use `BANKS[key].color` ou `CATEGORIES[key].color`
- **Não** crie migration sem antes revisar o schema inteiro — relações têm cascades
- **Não** use `formatCurrency()` de `utils.ts` — use `formatBRL()` de `constants.ts`
- **Não** use `lucide-react` diretamente em componentes — use `OrcaIcon`
- Auth: o `userId` vem de `session.user.id` (NextAuth) — sempre filtrar queries por `userId`
- Toda route handler API deve verificar `session.user.id` antes de qualquer query

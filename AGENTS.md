<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SmartWallet+ — Guia rápido para agentes

## O que é este projeto

SaaS de controle financeiro pessoal. Usuários registram receitas, despesas (fixas, variáveis, faturas), assinaturas com divisão entre membros, investimentos e saldos de banco. O dashboard unifica visão mensal e anual. O backend é Next.js App Router + Prisma 7 + PostgreSQL (Supabase).

---

## Avisos críticos — leia antes de qualquer código

### 1. Ícones — use OrcaIcon, NÃO lucide-react

O projeto tem sistema próprio de SVG em `src/components/ui/orca-icon.tsx`. `lucide-react` está instalada mas **não é usada nos componentes**.

```tsx
import { OrcaIcon } from "@/components/ui/orca-icon";
<OrcaIcon name="wallet" size={18} />
```

Ícones disponíveis: `dashboard` `calendar` `arrowDown` `arrowUp` `trend` `wallet` `close` `card` `repeat` `plus` `chevL` `chevR` `check` `users` `filter` `pie` `edit` `dots` `trash` `coins` `flame` `music` `play` `tv` `logout` `headphones` `star` `globe` `book` `cloud` `phone` `game` `wifi` `settings` `upload`

Para novo ícone: adicione o path SVG em `src/components/ui/orca-icon.tsx`.

### 2. CSS — utility classes customizadas, não Tailwind

O design system é em `src/app/globals.css` com classes CSS customizadas. Prefira-as a estilos inline.

**Classes essenciais:**
- Layout: `.content` `.topbar` `.topbar-l` `.topbar-r`
- Grids de página: `.r-grid-sidebar` `.r-grid-preview` `.r-grid-dash` `.r-grid-2col` `.r-grid-banks`
- KPIs: `.r-kpi-2` `.r-kpi-3` `.r-kpi-4` `.r-kpi-5`
- Componentes: `.card` `.card-pad` `.card-head` `.card-title` `.kpi` `.btn` `.btn-primary` `.btn-ghost` `.btn-icon` `.seg` `.row` `.bar` `.chip` `.status.paid` `.status.pending` `.field` `.orça-input`
- Texto/valor: `.num` (tabular-nums — obrigatório em valores monetários) `.muted` `.amt.pos` `.amt.neg`

**CSS vars — nunca hardcode valores:**
```
--pos --neg --warn --accent e variantes -soft
--canvas --surface --surface-2 --surface-3
--ink --ink-2 --ink-3
--line --line-2
--r-xs --r-sm --r-md --r-lg --r-xl
--shadow-sm --shadow-md --shadow-lg
--font-display --font-body
--b-{bankKey} --b-{bankKey}-soft --b-{bankKey}-on
```

### 3. Datas — evite UTC day-shift

Datas vindas do banco são strings ISO com hora. Ao exibir ou editar, use o padrão local das páginas:

```ts
function parseLocalDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);   // local, sem UTC shift
}
function formatLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
```

---

## Convenções essenciais

| O que fazer | Como fazer |
|-------------|-----------|
| Formatar moeda | `formatBRL(v)` / `formatBRL(v, { sign: true })` de `src/lib/constants.ts` |
| Combinar classes | `cn(...classes)` de `src/lib/utils.ts` |
| Fetch com retry | `fetchWithTimeoutAndRetry()` de `src/lib/network.ts` |
| Cores de banco | `BANKS[key].color` ou `var(--b-{key})` |
| Cores de categoria | `CATEGORIES[key].color` |

**Nunca:** `formatCurrency()` de `utils.ts` (duplicata incompleta).

---

## Auth e segurança

```ts
const session = await getServerSession(authOptions);
if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
// sempre filtrar por userId em toda query
where: { userId: session.user.id, ... }
```

- `session.user.id` está tipado via `src/types/next-auth.d.ts`
- **Nunca** retornar dados sem filtrar por `userId`

---

## Banco de dados

- Prisma 7 com driver adapter `PrismaPg` (não modo padrão)
- `src/lib/prisma.ts` conecta com `DIRECT_URL ?? DATABASE_URL`
- Para migrations: `DIRECT_URL` (porta 5432, session mode) — pgbouncer não suporta o adapter
- Valores `Decimal` do Prisma **devem** ser convertidos para `number` antes de retornar ao frontend
- **Não** crie migrations sem revisar `prisma/schema.prisma` inteiro — todos os modelos têm `onDelete: Cascade` via `userId`

---

## Bancos — dois tipos distintos

| Tipo | Onde vive | Identificador |
|------|-----------|---------------|
| Banco fixo | enum `BankKey` no schema | `"caixa"` `"bb"` `"itau"` `"nubank"` `"picpay"` `"inter"` `"mp"` |
| Banco customizado | modelo `CustomBank` no DB | UUID (`id`) |

No formulário de despesas, o seletor codifica o valor: `std:{bankKey}` ou `cst:{customBankId}`.

---

## APIs — comportamentos não-óbvios

### POST `/api/transactions` — batch
```json
// Aceita array direto ou objeto com items:
[{ "description": "...", "amount": 100, ... }]
{ "items": [...] }

// Resposta HTTP 207 em falha parcial:
{ "mode": "batch", "total": 5, "successCount": 4, "failedCount": 1, "failures": [...] }
```

### DELETE `/api/transactions`
- `?groupId=xxx` — remove todas as parcelas do grupo
- `?bank=nubank&month=6&year=2026` — remove tudo do banco naquele mês

### PATCH `/api/transactions`
- `?bank=nubank&month=6&year=2026` — atualiza `isPaid` em bulk

### GET `/api/salary`
- `?month=0&year=0` → retorna o template base do salário
- `?month=6&year=2026` → retorna `{ template, monthSalary, effective, source }`; use `effective` para o valor vigente

### `/api/bonus`
- Gerencia PLR e Décimo Terceiro usando modelo `Salary` com meses encodados (`1400+payMonth` para PLR, `1300+payMonth` para Décimo)
- POST também cria/atualiza uma `Transaction` de INCOME vinculada

### GET `/api/bank-closing-balance`
- `?month=6&year=2026` — obrigatório
- Fórmula: `inicial + entradas - saídas - fees - paidBillExpenses + paidBillEstornos`
- Retorna **`null`** para banco sem atividade no mês (não retorna 0) — o front decide carry-forward
- Resposta inclui custom banks usando o `id` do `CustomBank` como chave (não `BankKey`)

### DELETE `/api/bank-entries`
- `?groupId=xxx` — deleta pelo grupo de parcelas
- `?descriptionBase=Nome[&bank=nubank]` — fallback para entradas sem groupId (parceladas: `LIKE 'Nome %'`; únicas: `= 'Nome'`)

---

## Testes

```bash
npm run test           # unit + integração com Prisma mockado
npm run test:realdb    # tests/api-real/ com banco real (RUN_REAL_DB_TESTS=1)
npx tsc --noEmit       # checagem de tipos (build ignora erros — next.config.ts)
```

### Como mockar Prisma nos testes de integração

```ts
const { prismaMock, getServerSessionMock } = vi.hoisted(() => ({
  prismaMock: { transaction: { create: vi.fn() } }, // só os métodos usados
  getServerSessionMock: vi.fn(),
}));
vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/auth",  () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
// imports das routes DEPOIS dos vi.mock()
import { POST } from "@/app/api/transactions/route";
```

> `vi.hoisted()` é necessário — Vitest eleva `vi.mock()` para antes dos imports. Sem isso, a route importa o Prisma real antes do mock ser aplicado.

### Como escrever testes real-db

```ts
const describeRealDb = process.env.RUN_REAL_DB_TESTS === "1" ? describe : describe.skip;
describeRealDb("nome", () => {
  let userId = "";
  beforeEach(async () => {
    const user = await prisma.user.create({ data: { email: `t-${Date.now()}@x.com`, name: "T" } });
    userId = user.id;
    getServerSessionMock.mockResolvedValue({ user: { id: userId } });
  });
  afterEach(async () => {
    if (userId) { await prisma.user.delete({ where: { id: userId } }); userId = ""; }
  });
});
```

- `TEST_DIRECT_URL` — URL alternativa para banco de testes; se definida, substitui `DIRECT_URL`
- Cleanup via `user.delete` funciona porque todos os modelos têm `onDelete: Cascade` em `userId`

### O que NÃO tem teste ainda

`transactions GET/DELETE/PATCH` · `salary` · `bonus` · `subscriptions` · `investments` · `dashboard API` · componentes UI

---

## Pages — App Router

```
(auth)/login                  # login
(auth)/register               # registro
(dashboard)/dashboard         # dashboard mensal + anual unificados
(dashboard)/mes               # redireciona para /dashboard
(dashboard)/creditos          # receitas (+ salário mensal + bônus)
(dashboard)/debito            # despesas (fixas, variáveis, faturas)
(dashboard)/bancos            # saldos, entradas/saídas, taxas por banco
(dashboard)/assinaturas       # assinaturas com membros e rateio
(dashboard)/investimentos     # carteira de investimentos
(dashboard)/transactions      # lista geral de transações
```

O layout `(dashboard)/layout.tsx` faz `getServerSession` server-side e redireciona para `/login` se não autenticado.

---

## Git

- Hooks pre-commit: `npm test` — nunca use `--no-verify`
- Hook pre-push: `npm test` + (se banco disponível) `npm run test:realdb`
- CI em `.github/workflows/` — merge na main requer todos os checks passando

# Plano Financeiro

Aplicação web de gestão financeira pessoal, desenvolvida com Next.js 14 (App Router), Prisma ORM e PostgreSQL (Supabase). Interface totalmente em português brasileiro, responsiva para desktop e mobile.

---

## Contexto da Aplicação

O **Plano Financeiro** é um sistema SaaS de orçamento pessoal que permite ao usuário controlar receitas, despesas, investimentos, assinaturas compartilhadas e saldo bancário mês a mês. Toda a lógica financeira é por usuário autenticado — não há dados compartilhados entre usuários.

### Conceitos centrais

| Conceito | Descrição |
|---|---|
| **Transação** | Registro de entrada (INCOME) ou saída (EXPENSE) com data, valor, categoria e banco |
| **Tipo de despesa** | FIXED (boleto/PIX fixo), VARIABLE (gasto avulso) ou BANK_BILL (fatura de cartão de crédito) |
| **Categoria** | 14 categorias pré-definidas com cor (casa, alimentação, saúde, transporte, etc.) |
| **Banco** | 7 bancos padrão brasileiros + bancos customizados criados pelo usuário |
| **Mês de referência** | Toda a tela de Visão do Mês, Bancos e Dashboard trabalha por `month`/`year` |
| **Saldo bancário** | Snapshot mensal por banco (inicial + entradas − saídas − tarifas − fatura do cartão) |
| **Holerite** | Registro mensal de salário CLT com proventos e descontos; modelo base que se herda mês a mês |
| **Assinatura** | Serviço recorrente que pode ser dividido entre pessoas, com rastreio de pagamento por membro por mês |

---

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | 14+ |
| Linguagem | TypeScript | 5.x |
| ORM | Prisma | 7.x |
| Banco de dados | PostgreSQL (Supabase) | — |
| Autenticação | NextAuth.js | 4.24 |
| Validação | Zod | 4.x |
| Estilo | CSS global customizado (sem framework de UI) | — |
| Fontes | Space Grotesk (display) + Plus Jakarta Sans (body) | — |
| Hash de senha | bcryptjs (12 rounds) | — |

> O projeto usa **CSS puro** em `src/app/globals.css` com variáveis CSS para cores, raios e sombras — sem Tailwind nem CSS Modules nas páginas.

---

## Estrutura de Pastas

```
financeflow/
├── prisma/
│   └── schema.prisma          # Todos os modelos do banco
├── src/
│   ├── app/
│   │   ├── (auth)/            # Rotas públicas: /login, /register
│   │   ├── (dashboard)/       # Rotas protegidas (autenticação obrigatória)
│   │   │   ├── dashboard/     # Dashboard mensal e anual
│   │   │   ├── mes/           # Visão do mês — lançamentos por bloco
│   │   │   ├── creditos/      # Receitas: salário, bônus, outros créditos
│   │   │   ├── debito/        # Lançar despesa (fatura, fixo, variável)
│   │   │   ├── bancos/        # Saldo bancário por mês
│   │   │   ├── assinaturas/   # Assinaturas compartilhadas
│   │   │   └── investimentos/ # Carteira de investimentos
│   │   ├── api/               # Todos os endpoints REST
│   │   ├── globals.css        # CSS global, design tokens, componentes
│   │   └── layout.tsx         # Root layout com providers
│   ├── components/
│   │   ├── layout/sidebar.tsx # Sidebar colapsável com navegação
│   │   └── ui/                # Componentes reutilizáveis (Modal, OrcaIcon, BankBadge, etc.)
│   └── lib/
│       ├── auth.ts            # Configuração NextAuth (Google + Credentials)
│       ├── prisma.ts          # Instância singleton do Prisma client
│       └── constants.ts       # BANKS, CATEGORIES, formatBRL
```

---

## Modelos do Banco de Dados

### User / Autenticação
```prisma
User          id, name, email, password (bcrypt), emailVerified, image
Account       OAuth provider (Google)
Session       Sessões JWT
```

### Transações
```prisma
Transaction
  id, userId, description, amount (Decimal 12,2)
  type: INCOME | EXPENSE
  expenseType: FIXED | VARIABLE | BANK_BILL | null
  category: string (chave de CATEGORIES)
  bank: string (chave de BANKS) | null
  date: DateTime
  notes: string | null
  isPaid: boolean (default false)
  installments: Int | null       -- número total de parcelas
  installmentIndex: Int | null   -- índice desta parcela (1-based)
  groupId: string | null         -- agrupa parcelamentos e salários
```

> Convenção de `groupId`:
> - Parcelamentos: `grp-{timestamp}`
> - Salário CLT: `salary-{userId}`
> - Bônus (PLR/Décimo): `bonus-{type}-{year}-{payMonth}-{userId}`

### Salário / Holerite
```prisma
Salary
  userId, month, year           -- month=0, year=0 = modelo base
  baseAmount, netAmount         -- bruto e líquido
  payDay: Int | null            -- dia de pagamento
  items: SalaryItem[]

SalaryItem
  name, amount
  type: PROVENTO | DESCONTO
  order: Int                    -- ordenação na exibição
```

> Bônus (PLR e Décimo Terceiro) são armazenados na mesma tabela `Salary` com codificação de mês:
> - PLR: `month = 1400 + payMonth` (ex: PLR em junho = 1406)
> - Décimo: `month = 1300 + payMonth`

### Bancos
```prisma
BankFee       userId, bank, name, amount, billingDay
BankBalance   userId, bank, month, year, balance     -- unique(userId, bank, month, year)
BankEntry     userId, bank | customBankId, description, amount, type (INCOME|EXPENSE), month, year

CustomBank         userId, name, short (2-3 chars), color (hex)
CustomBankFee      customBankId, name, amount, billingDay
CustomBankBalance  customBankId, month, year, balance
```

### Assinaturas
```prisma
Subscription
  userId, name, brand (hex), icon, total, account, period (mensal|anual), startDate

SubscriptionMember
  subscriptionId, name, share, isOwner

SubscriptionPayment
  memberId, month, year, paidAt   -- unique(memberId, month, year)
```

### Investimentos
```prisma
Investment
  userId, name, type, institution (BankKey|null)
  value (Decimal 12,2), returnRate (Decimal 6,4), monthlyAdd (Decimal 12,2)
```

---

## API Endpoints

Todos os endpoints requerem sessão autenticada (NextAuth). Retornam JSON. Erros retornam `{ error: string }`.

### Autenticação
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Cadastro com nome, email, senha |
| * | `/api/auth/[...nextauth]` | Handlers NextAuth (signin, signout, callback) |

### Transações
| Método | Rota | Params / Body |
|---|---|---|
| GET | `/api/transactions` | `month`, `year`, `type`, `expenseType`, `bank`, `isPaid`, `groupId` |
| POST | `/api/transactions` | Corpo completo da transação |
| DELETE | `/api/transactions` | `groupId` (exclui grupo) ou `groupId&year` (exclui salários do ano) |
| PUT | `/api/transactions/[id]` | Atualização completa |
| PATCH | `/api/transactions/[id]` | Atualização parcial (ex: `{ isPaid: true }`) |
| GET | `/api/credits` | `month`, `year` — retorna INCOME transactions |

### Dashboard
| Método | Rota | Params |
|---|---|---|
| GET | `/api/dashboard` | `month`, `year`, `excl` (categorias excluídas, separadas por vírgula) |

Resposta: `{ stats: { totalIncome, totalExpense, balance, transactionCount }, categoryData[], expenseTypeData }`

### Salário e Bônus
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/salary` | `month`, `year` — retorna `{ template, monthSalary, effective, source }` |
| POST | `/api/salary` | Cria/atualiza salário (month=0/year=0 = template). Envolto em `prisma.$transaction()` |
| DELETE | `/api/salary/[id]` | Remove override mensal |
| GET | `/api/bonus` | `year`, `month` — retorna `{ plr, decimo }` |
| POST | `/api/bonus` | Cria/atualiza bônus. Envolto em `prisma.$transaction()` |
| DELETE | `/api/bonus` | `type`, `year`, `payMonth` |

### Bancos (padrão)
| Método | Rota | Descrição |
|---|---|---|
| GET/POST | `/api/bank-balances` | Lista ou cria/atualiza saldo (upsert por bank+month+year) |
| DELETE | `/api/bank-balances/[id]` | Remove saldo |
| GET/POST | `/api/bank-fees` | Lista ou cria tarifa bancária |
| DELETE | `/api/bank-fees/[id]` | Remove tarifa |
| GET/POST | `/api/bank-entries` | `month`, `year` — lista ou cria lançamento manual |
| DELETE | `/api/bank-entries/[id]` | Remove lançamento |

### Bancos Customizados
| Método | Rota | Descrição |
|---|---|---|
| GET/POST | `/api/custom-banks` | Lista ou cria banco customizado (com fees e saldo inicial opcionais) |
| PUT/DELETE | `/api/custom-banks/[id]` | Atualiza ou exclui (cascade em fees, balances, entries) |
| GET/POST | `/api/custom-bank-balances` | Saldos de bancos customizados |
| DELETE | `/api/custom-bank-balances/[id]` | — |
| GET/POST | `/api/custom-bank-fees` | Tarifas de bancos customizados |
| DELETE | `/api/custom-bank-fees/[id]` | — |

### Assinaturas
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/subscriptions` | `month`, `year` — retorna assinaturas com `paidAt` e `paidCount` por membro |
| POST | `/api/subscriptions` | Cria assinatura com membros |
| PUT | `/api/subscriptions/[id]` | Atualiza (preserva histórico de pagamentos). Envolto em `prisma.$transaction()` |
| PATCH | `/api/subscriptions/[id]` | Toggle pagamento: `{ memberId, paid, month, year }`. Verifica ownership |
| DELETE | `/api/subscriptions/[id]` | Exclui assinatura e todo o histórico |

### Investimentos
| Método | Rota | Descrição |
|---|---|---|
| GET/POST | `/api/investments` | Lista (ordenado por value desc) ou cria |
| PUT/DELETE | `/api/investments/[id]` | Atualiza ou exclui |

---

## Páginas Frontend

| Rota | Página | Descrição |
|---|---|---|
| `/login` | Login | Autenticação por email/senha ou Google |
| `/register` | Registro | Cadastro de nova conta |
| `/dashboard` | Dashboard | KPIs mensais/anuais, gastos por categoria, distribuição por tipo, saldo mês a mês |
| `/mes` | Visão do Mês | Lançamentos agrupados por bloco (Receitas, Fixos, Variáveis, Faturas por banco). Filtros por categoria e status. Atualização otimista ao marcar como pago |
| `/creditos` | Créditos | Holerite CLT com modelo base, bônus (PLR/Décimo) e outros recebimentos |
| `/debito` | Lançar Débito | Formulário com 3 modos: Fatura/Cartão (parcelas editáveis), Gasto Fixo, Gasto Variável. Preview ao vivo |
| `/bancos` | Bancos | Saldo mensal por banco, tarifas, entradas/saídas manuais, encadeamento de saldo anterior mês a mês |
| `/assinaturas` | Assinaturas | Gerenciamento de serviços recorrentes compartilhados, KPIs, histórico de pagamentos por membro, adimplência acumulada |
| `/investimentos` | Investimentos | Carteira com alocação por classe, rentabilidade projetada e aporte mensal |

---

## Constantes de Negócio

### Bancos Padrão (`BANKS`)
```typescript
caixa  → Caixa Econômica Federal  (#0B57A4)
bb     → Banco do Brasil          (#F7D117)
itau   → Itaú                     (#EC7000)
nubank → Nubank                   (#820AD1)
picpay → PicPay                   (#1FB85F)
inter  → Inter                    (#FF9A4D)
mp     → Mercado Pago             (#4AB9F0)
```

### Categorias (`CATEGORIES`)
```typescript
casa     → Casa/Moradia        compras  → Compras pessoais
alim     → Alimentação         trab     → Trabalho/Estudo
imprev   → Imprevistos         viagem   → Viagens
transp   → Transporte          reserva  → Reserva/Investim.
saude    → Saúde               tarifas  → Tarifas/Impostos
pet      → Pet                 reemb    → Reembolso
assin    → Assinaturas
lazer    → Lazer/Bem-estar
```

### `formatBRL(value, { sign? })`
Formata número para moeda brasileira: `1234.56` → `R$ 1.234,56`. Com `sign: true` adiciona `+` para positivos.

---

## Lógica de Negócio Relevante

### Saldo bancário
```
saldoConta = saldoInicial + entradas − saídas − tarifas − faturaLíquidaCartão
faturaLíquidaCartão = totalFaturas − estornos
```
- `saldoInicial` = balance salvo pelo usuário para o mês, ou saldo de fechamento do mês anterior
- Saldo de fechamento do mês anterior = saldo inicial prevMonth + entradas − saídas − tarifas − fatura
- Encadeamento mês a mês via botão "Carregar saldo do mês anterior" (salva `BankBalance` no DB)
- Meses futuros: campo de saldo inicial fica em branco; botão aparece quando mês anterior tem dados

### Herança do holerite
1. Busca `Salary` com `month=targetMonth, year=targetYear` (override específico do mês)
2. Fallback para `month=prevMonth, year=prevYear` (herdado do mês anterior)
3. Fallback para `month=0, year=0` (template base)
- Ao salvar o template, o mês atual é automaticamente confirmado criando a transação INCOME de salário

### Visão do Mês — blocos
- **Receitas**: transactions INCOME com `bank=null`
- **Gastos Fixos**: transactions EXPENSE com `expenseType=FIXED`
- **Gastos Variáveis**: transactions EXPENSE com `expenseType=VARIABLE`
- **Faturas por banco**: transactions EXPENSE com `expenseType=BANK_BILL` agrupadas por `bank`
- **Estornos/créditos**: transactions INCOME com `bank !== null` (aparecem dentro do card do banco na Visão do Mês e são descontados da fatura na tela Bancos)
- Cabeçalho de cada bloco exibe valor **pendente** (total − pago), atualizado ao marcar como pago
- Atualização otimista: estado local atualiza imediatamente, API confirma em background

### Parcelamentos
- Cada parcela é uma `Transaction` separada com mesma `groupId` (`grp-{timestamp}`)
- `installments` = número total de parcelas, `installmentIndex` = parcela atual (1-based)
- Data de cada parcela = data da compra + N meses
- Exclusão disponível: só esta parcela OU todas do grupo

### Assinaturas compartilhadas
- `isOwner=true` = a conta do usuário (minha parte)
- Outros membros: registram quanto devem pagar e quando pagaram
- `SubscriptionPayment` armazena histórico completo por membro/mês/ano
- Adimplência acumulada: calcula `meses decorridos × cota` vs `pagamentos realizados`
- Para assinaturas anuais: considera apenas anos completos decorridos

---

## Configuração do Ambiente

### Variáveis de ambiente (`.env`)
```bash
# PostgreSQL (Supabase ou outro)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?pgbouncer=true"

# NextAuth
NEXTAUTH_SECRET="string-aleatoria-segura"  # openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (opcional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

### Scripts disponíveis
```bash
npm run dev      # Servidor de desenvolvimento (porta 3000)
npm run build    # Build de produção
npm run start    # Inicia servidor de produção
npm run lint     # ESLint

npx prisma migrate dev    # Aplica migrações no banco
npx prisma db push        # Sincroniza schema sem criar migration
npx prisma studio         # Interface visual do banco de dados
```

### Instalação
```bash
git clone https://github.com/dassayani/finan.git
cd finan
npm install
cp .env.example .env      # configurar variáveis
npx prisma db push
npm run dev
```

---

## Design System

O app usa um design system próprio em `globals.css` sem dependências externas:

### Variáveis CSS
```css
--accent        /* cor principal (azul) */
--pos           /* verde (receita/pago) */
--neg           /* vermelho (despesa/pendente) */
--warn          /* amarelo/laranja (atenção) */
--surface       /* fundo dos cards */
--surface-2     /* fundo secundário (mais claro) */
--surface-3     /* fundo terciário */
--line          /* bordas principais */
--line-2        /* bordas internas */
--ink           /* texto principal */
--ink-2         /* texto secundário */
--ink-3         /* texto muted */
--font-display  /* Space Grotesk — títulos e valores */
--font-body     /* Plus Jakarta Sans — texto geral */
--r-sm / --r-md / --r-lg  /* border-radius tokens */
```

### Classes utilitárias principais
| Classe | Uso |
|---|---|
| `.card`, `.card-pad` | Cards com borda e sombra |
| `.btn`, `.btn-primary`, `.btn-ghost` | Botões padrão |
| `.orça-input`, `.orça-input.num` | Inputs de formulário |
| `.kpi`, `.kpi-val.sm` | Cards de KPI |
| `.status.paid`, `.status.pending` | Badges de status de pagamento |
| `.nav-item`, `.nav-item.active` | Itens da sidebar |
| `.r-grid-sidebar`, `.r-grid-preview` | Grids responsivos de página |
| `.r-kpi-3`, `.r-kpi-4`, `.r-kpi-5` | Grids de KPI responsivos |

---

## Responsividade

Breakpoint principal: `max-width: 767px` (mobile).

Comportamento no mobile:
- Sidebar reduzida para 64px (icon-only) automaticamente, sem toggle
- Todos os grids de página viram coluna única (`r-grid-*`)
- KPIs exibem 2 por linha (`r-kpi-*`)
- Padding do `topbar` e `content` reduzido (30px → 12px cada lado)
- Grid de 12 meses do dashboard vira 4 colunas (3 linhas × 4 meses)
- Preferência de colapso da sidebar persiste via `localStorage`

---

## Segurança

- Todas as rotas de API verificam `session.user.id` antes de qualquer operação
- Todas as queries incluem `userId: session.user.id` no `where` para isolamento total por usuário
- Operações críticas (salary+transaction, bonus+transaction, subscription updates) executadas dentro de `prisma.$transaction()` para atomicidade — sem race conditions
- Validação de entrada via Zod em todos os endpoints POST/PUT
- Senha armazenada com bcryptjs (12 rounds), nunca retornada na API
- PATCH de pagamento de assinatura verifica ownership antes de aceitar `memberId` externo

---

## Repositório

**GitHub:** https://github.com/dassayani/finan
**Branch principal:** `main`
**Deploy recomendado:** Vercel + Supabase (PostgreSQL)

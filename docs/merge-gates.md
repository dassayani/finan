# Portas de Qualidade Para Merge e Push

Este repositório agora possui duas camadas de proteção de qualidade:

- Bloqueio local de push com hook pre-push do Husky.
- Bloqueio remoto de merge com checks obrigatórios do GitHub Actions.

## 1) Bloqueio local de push (já configurado)

O hook pre-push em .husky/pre-push executa:

- npm run test
- npm run test:realdb (somente quando uma destas variáveis de ambiente existir: RUN_REAL_DB_TESTS, TEST_DIRECT_URL ou DATABASE_URL)

Isso impede pushes locais quando os testes falham.

## 2) Proteção de branch no GitHub (obrigatória para merge)

Prefira usar Branch Rulesets.

Use a regra clássica de branch apenas como alternativa, caso o repositório ou o plano não exponha Rulesets da forma esperada.

Configure isso no GitHub:

1. Abra o repositório em Settings > Rules > Rulesets.
2. Crie um ruleset com target somente para a branch main.
3. Se a interface mostrar campo de target, use um padrão de branch igual a main.
4. Se a interface não mostrar esse campo, salve o ruleset apenas quando ele estiver associado a Branches e depois confirme que o padrão aplicado é main.
5. Ative "Require a pull request before merging".
6. Ative "Require status checks to pass before merging".
7. Marque estes checks como obrigatórios:
   - Unit + Integration + UI + Contracts
   - Real DB Integration
8. Opcionalmente, ative também:
   - Require branches to be up to date before merging.
   - Require conversation resolution before merging.

Se você optar pela proteção clássica de branch, o equivalente fica em Settings > Branches.

Se o GitHub da sua conta não exibir a configuração de target por branch no Rulesets, use a proteção clássica em Settings > Branches e aplique a regra diretamente na main.

## Observações

- O workflow fica em .github/workflows/tests.yml.
- Se quem contribui no projeto não roda banco localmente, o pre-push local ainda executa a suíte padrão.
- Os testes com banco real continuam sendo exigidos no merge por meio dos status checks obrigatórios.

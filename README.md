# Controle de Viandas

Aplicação web para controlar o processo semanal de pedidos de viandas de uma empresa.

Este repositório é **independente**: não reutiliza código, banco, `.env` ou configurações de outros projetos.

A fonte de verdade funcional e técnica é o arquivo [`PROJECT_SPEC.md`](./PROJECT_SPEC.md).

## Stack

- React + TypeScript + Vite
- React Router
- Tailwind CSS
- Lucide Icons
- React Hook Form + Zod
- Supabase (Auth, PostgreSQL, Storage, RLS, Edge Functions)
- Deploy do frontend: **GitHub Pages** (Actions) ou Vercel (SPA estática)

## Status atual

**Fase 10 — Polimento concluída.**

Inclui histórico admin com filtros, auditoria, filtros de funcionários, histórico financeiro no detalhe do funcionário, estados de loading/erro/vazio nas telas principais e preparação de deploy.

### Secrets necessários (Supabase → Edge Functions)

- `OPENAI_API_KEY` (IA do cardápio)
- `OPENAI_VISION_MODEL` (opcional; padrão `gpt-4o-mini`)
- `APP_BASE_URL` (opcional; fallback para links de convite)

## Requisitos locais

- Node.js 20+ (recomendado)
- npm 10+
- Projeto Supabase exclusivo deste app

## Instalação

```bash
npm install
cp .env.example .env
```

No Windows (PowerShell):

```powershell
npm install
Copy-Item .env.example .env
```

Preencha no `.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_APP_BASE_URL` (local: `http://localhost:5173`)

## Variáveis de ambiente

| Variável | Onde | Descrição |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend / Actions secret | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend / Actions secret | Chave publicável |
| `VITE_APP_BASE_URL` | Frontend | URL base para links/convites (no Pages o workflow define) |
| `VITE_BASE_PATH` | Build (opcional) | Base do Vite; no Pages: `/NomeDoRepo/` |
| `OPENAI_API_KEY` | Edge Function secret | Extração de cardápio (Fase 9) |
| `OPENAI_VISION_MODEL` | Edge Function secret | Modelo Vision (opcional) |

Nunca versionar `.env` real. Nunca colocar service role no frontend.

## Criar o primeiro administrador

1. Rode o frontend (`npm run dev`).
2. Abra `/setup`.
3. Informe nome, telefone e PIN de 6 dígitos.
4. Isso só funciona se ainda **não** existir nenhum admin.
5. Depois, use `/login` normalmente.

## Funcionários e convites

No painel admin (`/admin/funcionarios`):

1. Cadastre o funcionário.
2. Copie a mensagem de convite.
3. Envie manualmente pelo WhatsApp.
4. O funcionário abre `/primeiro-acesso/:token` e define o PIN.
5. Para esquecimento de PIN: **Redefinir acesso**.

## PIX

Configure em `/admin/configuracoes`: chave PIX, nome do recebedor e cidade. O payload EMV e o QR são gerados no frontend a partir dessas configurações.

## IA do cardápio

1. Defina `OPENAI_API_KEY` nos secrets da Edge Function.
2. Em `/admin/cardapio/:weekId`, envie a foto do cardápio.
3. Revise e confirme antes de gravar (revisão obrigatória).
4. Se a IA falhar, use o cadastro manual.

## Execução local

```bash
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

Verificações:

```bash
npm run lint
npm run typecheck
npm run test:all
npm run verify
npm run format:check
```

`npm run verify` = typecheck + todos os testes unitários + build.

## Estrutura principal

```text
src/
  app/           # router, providers, layouts
  components/
  features/      # auth, employees, billing, payments, menus, orders, ...
  lib/           # supabase, phone, billing, pix, menus, whatsapp, ...
supabase/
  migrations/
  functions/     # bootstrap-admin, create-employee, create-activation, activate-user, extract-menu
  seed.sql
tests/
.github/workflows/deploy-pages.yml
vercel.json      # SPA rewrite (alternativa Vercel)
```

## Migrations

As migrations até a Fase 9 estão em `supabase/migrations/` e devem ser aplicadas no projeto Supabase exclusivo deste app (ex.: `viandas`).

## Deploy (GitHub Pages)

1. Crie o repositório no GitHub e faça o push deste projeto.
2. Em **Settings → Pages → Build and deployment**, escolha **GitHub Actions**.
3. Em **Settings → Secrets and variables → Actions**, crie:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. No push para `master`/`main` (ou em **Actions → Deploy GitHub Pages → Run workflow**), o site sobe em:
   - `https://<usuario>.github.io/<repo>/`
5. No Supabase (Edge Function secrets), alinhe `APP_BASE_URL` com essa URL (para convites).
6. O workflow define `VITE_BASE_PATH=/<repo>/` e gera `404.html` (fallback SPA).

Build local simulando Pages:

```bash
# PowerShell
$env:VITE_BASE_PATH="/Viandas/"
$env:VITE_APP_BASE_URL="https://SEU_USUARIO.github.io/Viandas"
npm run build:pages
```

## Deploy (Vercel — alternativa)

1. Conecte o repositório à Vercel.
2. Framework preset: Vite.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_APP_BASE_URL`.
6. O arquivo `vercel.json` faz rewrite SPA para `index.html`.

A Edge Function `extract-menu` continua no Supabase; não é deployada pelo Pages/Vercel.

## Roadmap

0. Bootstrap
1. Banco e autenticação
2. Configurações e semana
3. Cardápio manual
4. Pedidos
5. Mensagem para restaurante
6. Financeiro base
7. PIX e comprovantes
8. Crédito/débito
9. IA do cardápio
10. Polimento ← **atual (concluída)**

Consulte `PROJECT_SPEC.md` para regras completas.

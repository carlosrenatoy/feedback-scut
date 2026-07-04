# Feedback SCUT

Sistema de feedback educacional para residentes do pronto-socorro infantil do Instituto da Criança (HC-FMUSP).

**Avaliadora principal:** Dra. Ana Carolina Barsaglini Navega (Picci)

## Canais de captura (híbrido)

| Canal | Fluxo | Resultado |
|---|---|---|
| **WhatsApp** (produção) | Áudio → n8n → Whisper → GPT → Google Doc | Doc no Drive |
| **App web** (este repo) | Gravação in-app → Supabase Storage → n8n → Whisper → DeepSeek → JSON estruturado → Relatório completo | Relatório no app + busca/filtros |

Ambos convergem no mesmo banco Supabase.

## Stack

- **Frontend:** Vite + React 19 + TypeScript (`feedback-web/`)
- **Backend/DB:** Supabase — projeto "IA Nutri" (`ewshcwcpfvmujkuqinhk`, sa-east-1)
- **Processamento:** n8n em `primary-production-bb20.up.railway.app`
- **IA:** DeepSeek (`deepseek-chat`) para o app; OpenAI (`gpt-5.4-mini`) para WhatsApp
- **Deploy:** Vercel (`feedback-web-beta.vercel.app`)

## Estrutura do repositório

```
feedback-web/          # App React (Vite + TypeScript)
  src/
    pages/             # Gravar, Acervo, Pessoas, Perfil, Revisões, Revisar, Meus
    db.ts              # IndexedDB (gravações locais offline-first)
    sync.ts            # Upload + polling de status (n8n processa async)
    supabase.ts        # Cliente Supabase (anon key pública)
    auth.tsx           # Auth guard + login (Supabase Auth + RBAC)
supabase/
  migrations/          # SQL das tabelas, triggers e índices
  functions/           # Edge Function process-feedback (DEPRECATED — não usada)
docs/                  # Especificações e mockups
CLAUDE.md              # Instruções para IA (Claude Code / Cursor / Copilot)
```

## Fluxo de dados (app web)

```
1. Gravar.tsx → MediaRecorder → áudio → IndexedDB (offline-first)
2. sync.ts → upload Storage → upsert feedbacks (status=aguardando_sincronizacao)
3. Trigger pg_net → webhook n8n /webhook/feedback-app
4. n8n: valida secret → baixa áudio → converte formato → Whisper → DeepSeek (JSON) → Montar (renderiza texto) → PATCH Supabase
5. App faz polling (checkRemoteStatus) até status=pronto_para_revisao
6. Revisar.tsx: avaliadora edita o relatório completo e libera ao residente
7. Meus.tsx: residente autenticado vê o relatório completo formatado
```

## Relatório — formato padrão

O relatório segue o padrão dos DOCX do canal WhatsApp. Seções fixas:

1. **Cabeçalho** — data, nome, autorizações, passagem, tempo de estágio
2. **Auto análise** — maior qualidade, maior dificuldade, local de melhor performance
3. **Discussão específica de caso** — se houve, resumo e implicações
4. **Análise do médico avaliador** — pontos de mudança, realizou o esperado
5. **Plano de ação proposto** — ações concretas, follow-up
6. **Observação final** — destaque de fechamento (se existir)

A IA gera JSON estruturado com essas seções. O nó "Montar" no n8n renderiza o texto formatado (cabeçalho `FEEDBACK DE RESIDENTE`, seções com divisórias, bullets `•`). O JSON estruturado permite buscas futuras por seção.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` (não commitado):

| Variável | Descrição | Default (fallback) |
|---|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase | `https://ewshcwcpfvmujkuqinhk.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon key (pública) | Embutida no código |

## Auth / RBAC

Login via Supabase Auth (email + senha). Tabelas:
- `emails_autorizados` — allowlist (admin cadastra e-mails com módulo, papel e expiração)
- `permissoes` — permissões efetivas (trigger `handle_new_user` copia da allowlist no signup)
- `perfis` — dados do usuário

RLS ativa nas tabelas `feedbacks`, `pessoas_avaliadas`, `domain_values`. Acesso requer permissão no módulo `feedback` com papel `admin` ou `avaliador`.

## Segurança

- **NUNCA** comitar chaves, tokens ou senhas
- Anon key do Supabase é pública por design (proteção real = RLS)
- Service role key e DB password existem apenas em variáveis de ambiente do n8n e secrets da Vercel
- Arquivos de chave local (`keys*.txt`, `supabase_keys.txt`) estão no `.gitignore`
- Chave da API DeepSeek deve ficar como credencial no n8n, não hardcoded no workflow (⚠️ pendência conhecida)

## Desenvolvimento local

```bash
cd feedback-web
npm install
npm run dev        # http://localhost:5173
npm run build      # Produção → dist/
```

Deploy via Vercel CLI: `vercel deploy --prod`

## URLs importantes

| Serviço | URL |
|---|---|
| App produção | https://feedback-web-beta.vercel.app |
| Supabase Dashboard | https://supabase.com/dashboard/project/ewshcwcpfvmujkuqinhk |
| n8n Dashboard | https://primary-production-bb20.up.railway.app |
| Conversor de áudio | https://audio-converter-production-c46c.up.railway.app/convert |
| GitHub | https://github.com/carlosrenatoy/feedback-scut |

## Pendências conhecidas

- [ ] Mover chave DeepSeek para credential do n8n (está hardcoded no nó HTTP)
- [ ] Edge Function `process-feedback` está obsoleta — remover ou atualizar
- [ ] Migration `20260323031822` referencia projeto Supabase antigo (morto)
- [ ] Busca full-text no Acervo usar índice GIN (`idx_feedbacks_relatorio_gin`)
- [ ] Testes automatizados (atualmente zero)
- [ ] CI/CD via GitHub Actions (hoje deploy manual com Vercel CLI)

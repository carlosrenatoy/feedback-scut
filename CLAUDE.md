# Feedback SCUT

Sistema de feedback educacional para residentes do pronto-socorro infantil do Instituto da Criança (HC-FMUSP).
Avaliadora principal: Dra. Ana Carolina Barsaglini Navega (Picci).

## Regras para qualquer IA / dev que trabalhar neste projeto

1. **NUNCA degrade dados por conveniência.** O relatório completo é a fonte de verdade. Campos estruturados são derivados, não substitutos.
2. **NUNCA quebre o canal WhatsApp.** O workflow "Feedback" (`GayVQWB3UAcwdHPR`) é produção. Testar na cópia antes de mexer.
3. **Sempre manter backward compatibility.** Feedbacks antigos (v1, sem JSON estruturado) devem continuar funcionando no app.
4. **Dados de paciente são sensíveis.** Não comitar áudios, transcrições, DOCX com dados reais.
5. **O banco é Supabase free — pausa após ~7 dias sem tráfego.** Há keep-alive no n8n. Se o app "não abrir", verificar se o projeto Supabase foi pausado.
6. **Todo código de processamento de áudio está no n8n, NÃO no app.** O app só grava e exibe. A Edge Function `process-feedback` está morta — não usar.

## Canais (híbrido)

- **WhatsApp (produção):** áudio → n8n → Whisper → AI Agent (prompt Picci) → Google Doc no Drive. Workflow: `GayVQWB3UAcwdHPR`.
- **App web (`feedback-web`):** gravação in-app → upload Supabase Storage → trigger pg_net → n8n webhook → Whisper → DeepSeek → JSON estruturado → relatório completo → Supabase. Workflow: `yHOUtG3UJNask2og`.

Ambos convergem no mesmo banco Supabase.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Vite + React 19 + TypeScript (`feedback-web/`) |
| Backend/DB | Supabase — projeto "IA Nutri" `ewshcwcpfvmujkuqinhk` (sa-east-1, free) |
| Processamento | n8n em `primary-production-bb20.up.railway.app` |
| IA (WhatsApp) | OpenAI `gpt-5.4-mini` + Postgres Chat Memory |
| IA (App) | DeepSeek `deepseek-chat` (temp 0.1, JSON mode) |
| Deploy | Vercel (`feedback-web-beta.vercel.app`) |
| Auth | Supabase Auth (email+senha) + RBAC (RLS + tabela `permissoes`) |

## Estrutura do repositório

```
feedback-web/          # App React (Vite) — deploy Vercel
  src/
    pages/             # Gravar, Acervo, Pessoas, Perfil, Revisões, Revisar, Meus
    db.ts              # IndexedDB (gravações locais offline-first)
    sync.ts            # Upload + polling de status (n8n processa async)
    supabase.ts        # Cliente Supabase (anon key pública)
    auth.tsx           # Auth guard + login (Supabase Auth + RBAC)
supabase/
  migrations/          # SQL das tabelas, triggers e índices
  functions/           # Edge Function process-feedback (DEPRECATED)
docs/                  # Especificações e mockups
README.md              # Documentação completa do projeto
```

## Fluxo de dados completo (app web)

```
1. Gravar.tsx → MediaRecorder → áudio → IndexedDB (offline-first)
2. sync.ts → upload Storage → upsert feedbacks (status=aguardando_sincronizacao)
3. Trigger pg_net → webhook n8n /webhook/feedback-app
4. n8n: Gate (valida secret) → Baixar áudio → Converter áudio → Whisper → DeepSeek (JSON) → Montar (renderiza texto + extrai tópicos) → PATCH Supabase
5. App faz polling (checkRemoteStatus a cada 5s) até status=pronto_para_revisao
6. Revisar.tsx: avaliadora edita o relatório completo e libera ao residente
7. Meus.tsx: residente autenticado vê o relatório completo formatado
```

## Schema do relatório (JSON estruturado)

A IA (DeepSeek) devolve este JSON. O nó "Montar" renderiza o texto a partir dele.

```json
{
  "cabecalho": { "data", "nome_residente", "autorizacao_audio", "passagem", "tempo_estagio", "autorizacao_feedback" },
  "auto_analise": { "maior_qualidade": [], "maior_dificuldade": [], "local_melhor_performance" },
  "discussao_caso": { "houve_discussao": bool, "nome_paciente", "resumo" },
  "analise_avaliador": { "pontos_mudanca": [], "realizou_esperado" },
  "plano_acao": { "acoes": [], "follow_up" },
  "observacao_final": null,
  "classificacoes": { "perfil_no_momento", "local_assistencial", "tipo_feedback", "tema_especifico", "autonomia", "nota" },
  "confianca_global": 0.0
}
```

Colunas no banco:
- `campos_ia` (jsonb) — o JSON completo (seções estruturadas + campos planos backward compat)
- `relatorio` (text) — texto renderizado no formato "FEEDBACK DE RESIDENTE"
- `relatorio_estruturado` (jsonb) — cópia do JSON para índice GIN e queries
- `transcricao` (text) — texto bruto do Whisper (auditoria)

## Formato do relatório renderizado (padrão DOCX)

```
FEEDBACK DE RESIDENTE
=========================

Feedback Residentes por Ana Carolina Barsaglini Navega (Picci)

Data: ...
Nome do residente: ...
...

AUTO ANÁLISE:
—————————————
Maior qualidade como médico no Pronto Atendimento
• ...
Maior dificuldade como médico no pronto atendimento
• ...
Local do SCUT que performa melhor: ...

DISCUSSÃO ESPECÍFICA DE ALGUM CASO?
———————————————————————————————————

ANÁLISE DO MÉDICO AVALIADOR
———————————————————————————

PLANO DE AÇÃO PROPOSTO
——————————————————————

Observação final
```

## Auth / RBAC

- **Login:** Supabase Auth (email + senha)
- **Allowlist:** tabela `emails_autorizados` (email → modulo → papel → expira_em)
- **Permissões efetivas:** trigger `handle_new_user` copia da allowlist no signup → tabela `permissoes`
- **RLS:** ativa em `feedbacks`, `pessoas_avaliadas`, `domain_values`
- **Papéis:** `admin` (acesso total), `avaliador` (vê e edita feedbacks), residente (vê só os próprios via tela Meus)
- **Cuidado:** NUNCA chamar `supabase` dentro do callback `onAuthStateChange` (deadlock). Usar `setTimeout(..., 0)`.

## APIs / URLs importantes

| Serviço | URL |
|---|---|
| App produção | https://feedback-web-beta.vercel.app |
| Supabase REST | https://ewshcwcpfvmujkuqinhk.supabase.co |
| n8n API | https://primary-production-bb20.up.railway.app/api/v1 |
| Conversor áudio | https://audio-converter-production-c46c.up.railway.app/convert |
| Workflow WhatsApp | `GayVQWB3UAcwdHPR` |
| Workflow App | `yHOUtG3UJNask2og` |
| Notificar residente | `POST /webhook/notificar-residente` |
| GitHub | https://github.com/carlosrenatoy/feedback-scut |

## Comandos úteis

```bash
# Dev
cd feedback-web && npm run dev

# Build & deploy
cd feedback-web && npm run build && vercel deploy --prod

# Listar workflows n8n
curl -H "X-N8N-API-KEY: $KEY" https://primary-production-bb20.up.railway.app/api/v1/workflows

# Acessar banco (psql)
psql "postgresql://postgres.ewshcwcpfvmujkuqinhk@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
```

## Pendências conhecidas

- [ ] Mover chave DeepSeek para credential do n8n (está hardcoded no nó HTTP)
- [ ] Edge Function `process-feedback` está obsoleta — remover ou atualizar
- [ ] Migration `20260323031822` referencia projeto Supabase antigo (morto)
- [ ] Busca full-text no Acervo usar índice GIN (`idx_feedbacks_relatorio_gin`)
- [ ] Testes automatizados (zero)
- [ ] CI/CD via GitHub Actions (hoje deploy manual com Vercel CLI)
- [ ] Migrar n8n de Railway para Hostinger (futuro)
- [ ] Não há proteção contra gravação acidental de áudio sem consentimento

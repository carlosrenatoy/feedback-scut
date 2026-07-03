# Feedback SCUT

Sistema de feedback educacional para residentes do pronto-socorro infantil do Instituto da Criança.

## Canais

- **WhatsApp (produção):** áudio → n8n → Whisper → AI Agent (prompt Picci) → Google Doc no Drive
- **App web (`feedback-web`):** gravação in-app → upload Supabase Storage → trigger → n8n → Whisper → DeepSeek → JSON estruturado → relatório completo → Supabase

## Stack

- **Frontend:** Vite + React + TypeScript (`feedback-web/`)
- **Backend/DB:** Supabase (projeto "IA Nutri" `ewshcwcpfvmujkuqinhk`, sa-east-1)
- **Processamento:** n8n em `primary-production-bb20.up.railway.app` (2 workflows: "Feedback" WhatsApp + "Feedback - App (estruturado)")
- **IA:** DeepSeek (`deepseek-chat`) para o app; OpenAI (`gpt-5.4-mini`) para WhatsApp
- **Deploy:** Vercel (`feedback-web-beta.vercel.app`)

## Estrutura de diretórios

```
feedback-web/          # App React (Vite) — deploy Vercel
  src/
    pages/             # Gravar, Acervo, Pessoas, Perfil, Revisões, Revisar, Meus
    db.ts              # IndexedDB (gravações locais)
    sync.ts            # Upload + polling (n8n processa, app espera)
    supabase.ts        # Cliente Supabase
    auth.tsx           # Guard de autenticação
supabase/              # Migrations + Edge Functions (process-feedback: MORTA, não usada)
docs/                  # Especificações (não efêmeras)
```

## Fluxo do app

1. Gravar.tsx → áudio MediaRecorder → IndexedDB
2. sync.ts → upload Storage `feedbacks_audio` → upsert `feedbacks` (status `aguardando_sincronizacao`)
3. Trigger `trg_processar_feedback` → pg_net → webhook n8n `/webhook/feedback-app`
4. n8n: valida secret → baixa áudio → converte formato → Whisper → **DeepSeek (JSON estruturado)** → "Montar" gera relatório texto + extrai tópicos → PATCH Supabase
5. App faz polling (`checkRemoteStatus`) até `pronto_para_revisao`
6. Revisar.tsx: avaliador edita o relatório completo e libera
7. Meus.tsx: residente vê o relatório completo formatado

## Relatório — padrão oficial

O padrão é o dos DOCX antigos (WhatsApp). Seções na ordem:
1. Cabeçalho (Data, Nome, Autorizações, Passagem, Tempo)
2. **Auto análise** (maior qualidade, maior dificuldade, local de melhor performance)
3. **Discussão específica de algum caso**
4. **Análise do médico avaliador** (comentários, realizou o esperado)
5. **Plano de ação proposto** (ações, follow-up)
6. Observação final

Coluna `feedbacks.relatorio_estruturado` (jsonb) = JSON com cada seção.
Coluna `feedbacks.relatorio` (text) = texto renderizado no formato "FEEDBACK DE RESIDENTE".

## APIs / URLs importantes

- Supabase: `https://ewshcwcpfvmujkuqinhk.supabase.co`
- n8n: `https://primary-production-bb20.up.railway.app`
- App: `https://feedback-web-beta.vercel.app`
- Conversor de áudio: `https://audio-converter-production-c46c.up.railway.app/convert`
- Workflow WhatsApp: `GayVQWB3UAcwdHPR`
- Workflow App: `yHOUtG3UJNask2og`
- Notificar residente: `POST /webhook/notificar-residente`

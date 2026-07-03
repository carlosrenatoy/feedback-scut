import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const openAiKey = Deno.env.get("OPENAI_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function whisperTranscribe(blob: Blob, filename: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", blob, filename);
  fd.append("model", "whisper-1");
  fd.append("language", "pt");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openAiKey}` },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper(${res.status}): ${err}`);
  }
  return (await res.json()).text;
}

async function processAudio(feedbackId: string, audioUrl: string) {
  try {
    await supabase.from("feedbacks")
      .update({ status: "processando_ia" })
      .eq("id", feedbackId);

    // Download do áudio
    const filePath = audioUrl.split('/').pop()!;
    const { data: audioBlob, error: downloadError } = await supabase.storage
      .from('feedbacks_audio')
      .download(filePath);

    if (downloadError || !audioBlob) {
      throw new Error(`Download falhou: ${downloadError?.message}`);
    }

    // Whisper — tenta extensão original, depois fallbacks (cobre WhatsApp/iOS)
    const fallbackExts = ['mp4', 'ogg', 'mp3', 'webm', 'wav'];
    let transcription: string | null = null;
    let lastErr = '';
    for (const ext of [filePath, ...fallbackExts.map(e => filePath.replace(/\.[^.]+$/, `.${e}`))]) {
      try {
        transcription = await whisperTranscribe(audioBlob, ext);
        console.log(`[${feedbackId}] Whisper OK com: ${ext}`);
        break;
      } catch (e: any) {
        lastErr = e.message;
        if (!e.message.includes("Invalid file format")) throw e;
        console.log(`[${feedbackId}] Whisper rejeitou ${ext}, tentando próximo...`);
      }
    }
    if (transcription === null) throw new Error(`Whisper não suportou nenhum formato: ${lastErr}`);

    console.log(`[${feedbackId}] Transcrição: ${transcription.substring(0, 100)}...`);

    // Vocabulário do banco
    const { data: domains } = await supabase.from('domain_values').select('*');
    const perfis = domains?.filter(d => d.category === 'perfil').map(d => d.valor).join(', ');
    const locais = domains?.filter(d => d.category === 'local_assistencial').map(d => d.valor).join(', ');
    const tipos = domains?.filter(d => d.category === 'tipo_feedback').map(d => d.valor).join(', ');
    const temas = domains?.filter(d => d.category === 'tema_especifico').map(d => d.valor).join(', ');

    const prompt = `Você é um assistente de análise de feedback educacional hospitalar.
Analise a transcrição abaixo e extraia os dados em JSON.

Use EXATAMENTE os valores dos vocabulários ao preencher os campos.
Se houver variações, normalize para o valor correto do vocabulário.
Use null APENAS quando não houver NENHUMA evidência no áudio.

Perfis válidos: ${perfis}
Locais assistenciais: ${locais}
Tipos de feedback: ${tipos}
Temas específicos: ${temas}

Retorne APENAS JSON válido (sem Markdown, sem backticks):
{
  "pessoa_avaliada": { "nome_mencionado": "string|null", "confianca": 0.0 },
  "perfil_no_momento": "string|null",
  "passagem": "passagem única|1ª passagem|2ª passagem|3ª passagem|null",
  "local_assistencial": "string|null",
  "tipo_feedback": "string|null",
  "tema_especifico": "string|null",
  "pontos_fortes": ["..."],
  "dificuldades": ["..."],
  "plano_de_acao": ["..."],
  "autonomia_sugerida": "string|null",
  "nota_sugerida": null,
  "campos_incertos": ["..."],
  "confianca_contexto": 0.0
}

Transcrição:
"${transcription}"`;

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!gptRes.ok) {
      const err = await gptRes.text();
      throw new Error(`GPT(${gptRes.status}): ${err}`);
    }

    const gptResult = await gptRes.json();
    const iaData = JSON.parse(gptResult.choices[0].message.content);

    await supabase.from("feedbacks").update({
      transcricao: transcription,
      campos_ia: iaData,
      ia_pessoa_sugerida: iaData.pessoa_avaliada?.nome_mencionado || null,
      ia_pessoa_confianca: iaData.pessoa_avaliada?.confianca || 0,
      perfil_no_momento: iaData.perfil_no_momento,
      passagem: iaData.passagem,
      local_inferido: iaData.local_assistencial,
      tipo_feedback_inferido: iaData.tipo_feedback,
      tema_especifico_inferido: iaData.tema_especifico,
      ia_confianca_contexto: iaData.confianca_contexto || 0,
      status: "pronto_para_revisao",
      ia_versao: "gpt-5.4-mini_2026-03-24",
    }).eq("id", feedbackId);

    console.log(`[${feedbackId}] Concluído.`);

  } catch (err: any) {
    console.error(`[${feedbackId}] Erro:`, err.message);
    // Usa erro_ia para não re-disparar o trigger
    await supabase.from("feedbacks").update({
      status: "erro_ia",
      campos_ia: { erro: err.message },
    }).eq("id", feedbackId);
  }
}

serve(async (req) => {
  const { type, record } = await req.json();

  if (type !== "INSERT" && type !== "UPDATE") return new Response("Ignored");
  if (!record.audio_remoto_url || record.status !== "aguardando_sincronizacao") {
    return new Response("Not ready");
  }

  // Fire and forget — retorna 200 imediatamente, pg_net não sofre timeout
  processAudio(record.id, record.audio_remoto_url).catch(err =>
    console.error(`[${record.id}] Erro não tratado:`, err.message)
  );

  return new Response(
    JSON.stringify({ accepted: true, feedbackId: record.id }),
    { headers: { "Content-Type": "application/json" } }
  );
});

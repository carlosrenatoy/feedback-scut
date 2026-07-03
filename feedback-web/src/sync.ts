import { supabase } from './supabase';
import { getFeedbackLocal, getPendingSync, updateFeedbackLocal } from './db';

// O processamento (transcrição + IA) é disparado por um gatilho no Supabase
// quando a linha entra com status 'aguardando_sincronizacao' — não depende do navegador.

export async function syncFeedback(feedbackId: string): Promise<boolean> {
  const fb = await getFeedbackLocal(feedbackId);
  if (!fb || !fb.audioBlob) return false;

  try {
    await updateFeedbackLocal(feedbackId, { status: 'aguardando_sincronizacao' });

    const ext = fb.audioBlob.type.includes('mp4') ? 'mp4' : fb.audioBlob.type.includes('m4a') ? 'm4a' : 'webm';
    const nomeArquivo = `${feedbackId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('feedbacks_audio')
      .upload(nomeArquivo, fb.audioBlob, {
        contentType: fb.audioBlob.type,
        upsert: true,
      });

    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage
      .from('feedbacks_audio')
      .getPublicUrl(nomeArquivo);

    const { data: userData } = await supabase.auth.getUser();
    const avaliadorId = userData.user?.id ?? null;

    const { error: insertError } = await supabase
      .from('feedbacks')
      .upsert({
        id: feedbackId,
        avaliador_id: avaliadorId,
        audio_remoto_url: urlData.publicUrl,
        status: 'aguardando_sincronizacao',
        data_evento: fb.data_evento,
        origem: 'app',
      });

    if (insertError) throw new Error(insertError.message);

    await updateFeedbackLocal(feedbackId, {
      status: 'aguardando_sincronizacao',
      sincronizado: true,
      audioUri: urlData.publicUrl,
    });

    // O gatilho no Supabase dispara o n8n (transcrição + IA) automaticamente.
    // O app só precisa fazer polling do status (checkRemoteStatus).

    return true;
  } catch (e: any) {
    console.warn('Sync falhou:', e.message);
    await updateFeedbackLocal(feedbackId, { status: 'salvo_local' });
    return false;
  }
}

export async function syncAllPending() {
  const pending = await getPendingSync();
  for (const fb of pending) {
    await syncFeedback(fb.id);
  }
}

export async function checkRemoteStatus(feedbackId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('feedbacks')
    .select('status, campos_ia, ia_pessoa_sugerida, ia_pessoa_confianca, perfil_no_momento, passagem, local_inferido, tipo_feedback_inferido, tema_especifico_inferido, relatorio, transcricao, ia_confianca_contexto')
    .eq('id', feedbackId)
    .single();

  if (error || !data) return null;

  if (data.status === 'processando_ia') {
    await updateFeedbackLocal(feedbackId, { status: 'processando_ia' });
  }

  if (data.status === 'pronto_para_revisao') {
    const camposIa = typeof data.campos_ia === 'string' ? JSON.parse(data.campos_ia) : data.campos_ia;
    await updateFeedbackLocal(feedbackId, {
      status: 'pronto_para_revisao',
      campos_ia: typeof data.campos_ia === 'string' ? data.campos_ia : JSON.stringify(data.campos_ia),
      campos_incertos: camposIa?.campos_incertos || [],
      ia_pessoa_sugerida: data.ia_pessoa_sugerida,
      ia_pessoa_confianca: data.ia_pessoa_confianca,
      perfil_no_momento: data.perfil_no_momento,
      passagem: data.passagem,
      local_inferido: data.local_inferido,
      tipo_feedback_inferido: data.tipo_feedback_inferido,
      tema_especifico_inferido: data.tema_especifico_inferido,
      transcricao: data.transcricao,
      relatorio: (data as any).relatorio || undefined,
      autonomia_sugerida: camposIa?.autonomia_sugerida || null,
      nota_sugerida: camposIa?.nota_sugerida || null,
    });
  }

  return data.status;
}

// Cache de domain_values
let domainCache: { perfis: string[]; locais: string[]; tipos: string[]; temas: string[] } | null = null;

export async function fetchDomainValues() {
  if (domainCache) return domainCache;

  const { data, error } = await supabase
    .from('domain_values')
    .select('category, valor')
    .order('valor');

  if (error || !data) {
    // Fallback hardcoded caso falhe
    return {
      perfis: ['R1','R2','R3','Residente externo','Residente de emergência pediátrica','Residente de emergência geral','Preceptor','Assistente'],
      locais: ['Porta','Retaguarda','Sala de emergência','Triagem','Passagem de plantão','Discussão de caso','Telemedicina','Transporte'],
      tipos: ['Procedimento','Comportamento e postura profissional','Comunicação','Discussão de caso','Evolução e condução clínica','Passagem de plantão','Supervisão e preceptoria'],
      temas: [],
    };
  }

  const result = { perfis: [] as string[], locais: [] as string[], tipos: [] as string[], temas: [] as string[] };
  data.forEach((d: any) => {
    if (d.category === 'perfil') result.perfis.push(d.valor);
    else if (d.category === 'local_assistencial') result.locais.push(d.valor);
    else if (d.category === 'tipo_feedback') result.tipos.push(d.valor);
    else if (d.category === 'tema_especifico') result.temas.push(d.valor);
  });

  domainCache = result;
  return result;
}

// Buscar feedbacks do Supabase para telas que precisam de dados remotos
export async function fetchFeedbacksRemoto() {
  const { data, error } = await supabase
    .from('feedbacks')
    .select('id, status, ia_pessoa_sugerida, perfil_no_momento, passagem, local_inferido, tipo_feedback_inferido, tema_especifico_inferido, campos_ia, campos_revisados, relatorio, transcricao, data_evento, duracao_segundos, liberado_ao_avaliado')
    .order('data_evento', { ascending: false });

  if (error) return [];
  return data || [];
}

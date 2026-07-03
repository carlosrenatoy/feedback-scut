import { useState, useEffect, useRef } from 'react';

function AutoTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="value-box"
      style={{ resize: 'none', overflow: 'hidden', minHeight: 72 }}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}
import { useParams, useNavigate } from 'react-router-dom';
import { getFeedbackLocal, updateFeedbackLocal, deleteFeedbackLocal } from '../db';
import { supabase } from '../supabase';
import { fetchDomainValues } from '../sync';

const PASSAGENS = ['Passagem única', '1ª passagem', '2ª passagem', '3ª passagem', '4ª passagem'];

const NOTIFY_URL = 'https://primary-production-bb20.up.railway.app/webhook/notificar-residente';

// Avisa o residente no WhatsApp (via n8n). Falha silenciosa: não bloqueia o liberar.
async function notificarResidente(feedbackId: string) {
  try {
    const { data: sess } = await supabase.auth.getSession();
    await fetch(NOTIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedbackId, access_token: sess.session?.access_token }),
    });
  } catch (e) {
    console.warn('Notificação ao residente falhou:', e);
  }
}

const STATUS_LABEL: Record<string, string> = {
  aguardando_sincronizacao: 'Aguardando IA',
  processando_ia: 'Processando IA…',
  pronto_para_revisao: 'Pendente revisão',
  revisado: 'Revisado',
  liberado_ao_residente: 'Liberado ao residente',
};

export default function Revisar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [campos, setCampos] = useState<any>({});
  const [incertos, setIncertos] = useState<string[]>([]);
  const [relatorio, setRelatorio] = useState('');
  const [transcricao, setTranscricao] = useState('');
  const [showCampos, setShowCampos] = useState(false);
  const [status, setStatus] = useState('');
  const [, setFbData] = useState<any>(null);
  const [showTranscricao, setShowTranscricao] = useState(false);
  const [editing, setEditing] = useState(false);
  const [domainValues, setDomainValues] = useState<{ perfis: string[]; locais: string[]; tipos: string[]; temas: string[] }>({ perfis: [], locais: [], tipos: [], temas: [] });

  const readOnly = status !== 'pronto_para_revisao' && !editing;

  useEffect(() => {
    fetchDomainValues().then(setDomainValues);
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
    // Always load from Supabase (authoritative source for IA data)
    const { data: remote } = await supabase
      .from('feedbacks')
      .select('*')
      .eq('id', id)
      .single();

    if (remote) {
      loadFromRemote(remote);
    } else {
      // Fallback: local only
      const local = await getFeedbackLocal(id);
      if (local) loadFromData(local);
    }
    setLoading(false);
    })();
  }, [id]);

  function loadFromData(data: any) {
    const ia = data.campos_ia ? (typeof data.campos_ia === 'string' ? JSON.parse(data.campos_ia) : data.campos_ia) : {};
    const revisados = data.campos_revisados ? (typeof data.campos_revisados === 'string' ? JSON.parse(data.campos_revisados) : data.campos_revisados) : null;
    const fonte = revisados || ia;

    setCampos({
      nome_residente: data.ia_pessoa_sugerida || '',
      perfil: data.perfil_no_momento || '',
      passagem: data.passagem || '',
      local: data.local_inferido || '',
      tipo: data.tipo_feedback_inferido || '',
      tema: data.tema_especifico_inferido || '',
      autonomia: fonte.autonomia_sugerida || fonte.autonomia || data.autonomia_sugerida || '',
      pontos_fortes: Array.isArray(fonte.pontos_fortes) ? fonte.pontos_fortes.join('\n• ') : (fonte.pontos_fortes || ''),
      dificuldades: Array.isArray(fonte.dificuldades) ? fonte.dificuldades.join('\n• ') : (fonte.dificuldades || ''),
      plano_de_acao: Array.isArray(fonte.plano_de_acao) ? fonte.plano_de_acao.join('\n• ') : (fonte.plano_de_acao || ''),
      nota: fonte.nota_sugerida ?? fonte.nota ?? data.nota_sugerida ?? '',
      observacoes: fonte.observacoes || fonte.observacoes_avaliador || ia.observacoes || ia.observacoes_avaliador || '',
      relatorio: fonte.relatorio || '',
    });
    setIncertos(data.campos_incertos || ia.campos_incertos || []);
    setRelatorio(data.relatorio || data.transcricao || '');
    setTranscricao(data.transcricao || '');
    setStatus(data.status || '');
    setFbData(data);
  }

  function loadFromRemote(remote: any) {
    const ia = remote.campos_ia ? (typeof remote.campos_ia === 'string' ? JSON.parse(remote.campos_ia) : remote.campos_ia) : {};
    const revisados = remote.campos_revisados ? (typeof remote.campos_revisados === 'string' ? JSON.parse(remote.campos_revisados) : remote.campos_revisados) : null;
    const fonte = revisados || ia;

    setCampos({
      nome_residente: remote.ia_pessoa_sugerida || '',
      perfil: remote.perfil_no_momento || '',
      passagem: remote.passagem || '',
      local: remote.local_inferido || '',
      tipo: remote.tipo_feedback_inferido || '',
      tema: remote.tema_especifico_inferido || '',
      autonomia: fonte.autonomia_sugerida || fonte.autonomia || '',
      pontos_fortes: Array.isArray(fonte.pontos_fortes) ? fonte.pontos_fortes.join('\n• ') : (fonte.pontos_fortes || ''),
      dificuldades: Array.isArray(fonte.dificuldades) ? fonte.dificuldades.join('\n• ') : (fonte.dificuldades || ''),
      plano_de_acao: Array.isArray(fonte.plano_de_acao) ? fonte.plano_de_acao.join('\n• ') : (fonte.plano_de_acao || ''),
      nota: fonte.nota_sugerida ?? fonte.nota ?? '',
      observacoes: fonte.observacoes || fonte.observacoes_avaliador || ia.observacoes || ia.observacoes_avaliador || '',
      relatorio: fonte.relatorio || '',
    });
    setIncertos(ia.campos_incertos || []);
    setRelatorio(remote.relatorio || remote.transcricao || '');
    setTranscricao(remote.transcricao || '');
    setStatus(remote.status || '');
    setFbData(remote);
  }

  function set(key: string, val: string) {
    setCampos((prev: any) => ({ ...prev, [key]: val }));
  }

  function isUncertain(field: string) {
    return incertos.some(c => c.toLowerCase().includes(field.toLowerCase()));
  }

  async function salvar(liberar: boolean) {
    if (!id) return;
    setSaving(true);
    try {
      const camposRevisados = JSON.stringify(campos);
      // Ao liberar -> liberado. Ao salvar: se já estava liberado, mantém; senão vira 'revisado'.
      const novoStatus = liberar
        ? 'liberado_ao_residente'
        : (status === 'liberado_ao_residente' ? 'liberado_ao_residente' : 'revisado');

      // Update local
      await updateFeedbackLocal(id, {
        status: novoStatus,
        ia_pessoa_sugerida: campos.nome_residente,
        perfil_no_momento: campos.perfil,
        passagem: campos.passagem,
        local_inferido: campos.local,
        tipo_feedback_inferido: campos.tipo,
        tema_especifico_inferido: campos.tema,
        autonomia_sugerida: campos.autonomia,
        nota_sugerida: campos.nota ? Number(campos.nota) : undefined,
        campos_revisados: camposRevisados,
        relatorio,
      });

      // Update Supabase with ALL individual fields + liberado_em
      const updateData: any = {
        status: novoStatus,
        campos_revisados: camposRevisados,
        relatorio,
        ia_pessoa_sugerida: campos.nome_residente,
        perfil_no_momento: campos.perfil,
        passagem: campos.passagem,
        local_inferido: campos.local,
        tipo_feedback_inferido: campos.tipo,
        tema_especifico_inferido: campos.tema,
      };

      if (liberar) {
        updateData.liberado_ao_avaliado = true;
        updateData.liberado_em = new Date().toISOString();
      }

      await supabase.from('feedbacks').update(updateData).eq('id', id);

      if (liberar) await notificarResidente(id);

      navigate(-1);
    } finally {
      setSaving(false);
    }
  }

  async function apagar() {
    if (!id) return;
    if (!window.confirm('Apagar este feedback definitivamente? Esta ação não pode ser desfeita.')) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('feedbacks').delete().eq('id', id);
      if (error) { window.alert('Não foi possível apagar: ' + error.message); return; }
      try { await deleteFeedbackLocal(id); } catch { /* sem cópia local */ }
      navigate(-1);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="screen"><p>Carregando…</p></div>;

  return (
    <div>
      <div className="topbar">
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', marginRight: 8 }}>←</button>
        <h1>{readOnly ? '📋 Detalhes do Feedback' : '📋 Revisão da IA'}</h1>
      </div>
      <div className="screen">
        {/* Status badge */}
        {readOnly && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <span className={`badge-status s-${status}`} style={{ fontSize: '0.88rem', padding: '6px 16px' }}>
              {STATUS_LABEL[status] || status}
            </span>
          </div>
        )}

        {!readOnly && (
          <p style={{ color: 'var(--subtle)', fontSize: '0.85rem', marginBottom: 16 }}>
            Edite o que a IA errou. Campos com ⚠️ precisam de atenção.
          </p>
        )}

        {/* Relatório completo (padrão Feedback de Residente) — conteúdo principal */}
        <div className="section-title">📄 Relatório do Feedback</div>
        <div className="field-group">
          {readOnly ? (
            relatorio
              ? <div className="value-box" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{relatorio}</div>
              : <div className="value-box">— (feedback antigo, sem relatório completo)</div>
          ) : (
            <AutoTextarea value={relatorio} onChange={setRelatorio} placeholder="Relatório completo do feedback…" />
          )}
        </div>

        <button className="btn btn-outline" onClick={() => setShowCampos(v => !v)} style={{ marginBottom: 12 }}>
          {showCampos ? 'Ocultar campos estruturados' : '🗂️ Ver campos estruturados (filtros e perfil)'}
        </button>

        {showCampos && (<>
        <div className="field-group">
          <label>Residente / Avaliado {isUncertain('pessoa') && <span className="uncertain">⚠️</span>}</label>
          {readOnly ? (
            <div className="value-box">{campos.nome_residente || '—'}</div>
          ) : (
            <input className="value-box" value={campos.nome_residente} onChange={e => set('nome_residente', e.target.value)} placeholder="Nome do residente" />
          )}
        </div>

        <div className="field-group">
          <label>Papel no Momento {isUncertain('perfil') && <span className="uncertain">⚠️</span>}</label>
          {readOnly ? (
            <div className="value-box">{campos.perfil || '—'}</div>
          ) : (
            <select className="value-box" value={campos.perfil} onChange={e => set('perfil', e.target.value)}>
              <option value="">Selecionar…</option>
              {domainValues.perfis.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
        </div>

        <div className="field-group">
          <label>Passagem {isUncertain('passagem') && <span className="uncertain">⚠️</span>}</label>
          {readOnly ? (
            <div className="value-box">{campos.passagem || '—'}</div>
          ) : (
            <select className="value-box" value={campos.passagem} onChange={e => set('passagem', e.target.value)}>
              <option value="">Selecionar…</option>
              {PASSAGENS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
        </div>

        <div className="field-group">
          <label>Cenário Assistencial {isUncertain('local') && <span className="uncertain">⚠️</span>}</label>
          {readOnly ? (
            <div className="value-box">{campos.local || '—'}</div>
          ) : (
            <select className="value-box" value={campos.local} onChange={e => set('local', e.target.value)}>
              <option value="">Selecionar…</option>
              {domainValues.locais.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
        </div>

        <div className="field-group">
          <label>Tipo de Feedback {isUncertain('tipo') && <span className="uncertain">⚠️</span>}</label>
          {readOnly ? (
            <div className="value-box">{campos.tipo || '—'}</div>
          ) : (
            <select className="value-box" value={campos.tipo} onChange={e => set('tipo', e.target.value)}>
              <option value="">Selecionar…</option>
              {domainValues.tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>

        <div className="field-group">
          <label>Tema Específico</label>
          {readOnly ? (
            <div className="value-box">{campos.tema || '—'}</div>
          ) : (
            <input className="value-box" value={campos.tema} onChange={e => set('tema', e.target.value)} placeholder="Ex: intubação, comunicação de más notícias…" />
          )}
        </div>

        <div className="field-group">
          <label>Grau de Autonomia {isUncertain('autonomia') && <span className="uncertain">⚠️</span>}</label>
          {readOnly ? (
            <div className="value-box">{campos.autonomia || '—'}</div>
          ) : (
            <input className="value-box" value={campos.autonomia}
              onChange={e => set('autonomia', e.target.value)}
              placeholder={isUncertain('autonomia') ? '⚠️ Não identificado no áudio' : 'Ex: L1, L2, L3'} />
          )}
        </div>

        <div className="section-title">Pontos Fortes {!readOnly && '(inferidos pela IA)'}</div>
        <div className="field-group">
          {readOnly ? (
            <div className="value-box" style={{ whiteSpace: 'pre-wrap' }}>{campos.pontos_fortes || '—'}</div>
          ) : (
            <AutoTextarea value={campos.pontos_fortes} onChange={v => set('pontos_fortes', v)} placeholder="O que o residente fez bem…" />
          )}
        </div>

        <div className="section-title">Dificuldades {!readOnly && '(inferidas pela IA)'}</div>
        <div className="field-group">
          {readOnly ? (
            <div className="value-box" style={{ whiteSpace: 'pre-wrap' }}>{campos.dificuldades || '—'}</div>
          ) : (
            <AutoTextarea value={campos.dificuldades} onChange={v => set('dificuldades', v)} placeholder="O que precisa melhorar…" />
          )}
        </div>

        <div className="section-title">Plano de Ação</div>
        <div className="field-group">
          {readOnly ? (
            <div className="value-box" style={{ whiteSpace: 'pre-wrap' }}>{campos.plano_de_acao || '—'}</div>
          ) : (
            <AutoTextarea value={campos.plano_de_acao} onChange={v => set('plano_de_acao', v)} placeholder="Próximos passos…" />
          )}
        </div>

        <div className="field-group">
          <label>Nota {!readOnly && isUncertain('nota') && <span className="uncertain">⚠️</span>}</label>
          {readOnly ? (
            <div className="value-box">{campos.nota ? `${campos.nota}/5` : '—'}</div>
          ) : (
            <input className="value-box" type="number" min="1" max="5" value={campos.nota}
              onChange={e => set('nota', e.target.value)}
              placeholder={isUncertain('nota') ? '⚠️ Não inferida' : '1 a 5'} />
          )}
        </div>

        <div className="field-group">
          <label>Observações do Avaliador</label>
          {readOnly ? (
            campos.observacoes ? <div className="value-box" style={{ whiteSpace: 'pre-wrap' }}>{campos.observacoes}</div> : <div className="value-box">—</div>
          ) : (
            <AutoTextarea value={campos.observacoes} onChange={v => set('observacoes', v)} placeholder="Anotações livres do avaliador…" />
          )}
        </div>
        </>)}

        {/* Modo edição (feedback pendente OU clicou em Editar) */}
        {!readOnly && (
          <>
            <button className="btn btn-outline" onClick={() => salvar(false)} disabled={saving} style={{ marginBottom: 8 }}>
              {saving ? 'Salvando…' : (editing ? 'Salvar alterações' : 'Salvar Rascunho')}
            </button>
            {status !== 'liberado_ao_residente' && (
              <button className="btn btn-success" onClick={() => salvar(true)} disabled={saving} style={{ marginBottom: 8 }}>
                ✅ Salvar e Liberar ao Residente
              </button>
            )}
            {editing && (
              <button className="btn btn-secondary" onClick={() => navigate(-1)} disabled={saving} style={{ marginBottom: 8 }}>
                Cancelar
              </button>
            )}
          </>
        )}

        {/* Modo leitura: Editar + (se revisado) Liberar */}
        {readOnly && (
          <>
            <button className="btn btn-outline" onClick={() => setEditing(true)} style={{ marginBottom: 8 }}>
              ✏️ Editar
            </button>
            {status === 'revisado' && (
              <button className="btn btn-success" onClick={async () => {
                await supabase.from('feedbacks').update({
                  status: 'liberado_ao_residente',
                  liberado_ao_avaliado: true,
                  liberado_em: new Date().toISOString(),
                }).eq('id', id);
                if (id) await notificarResidente(id);
                navigate(-1);
              }} style={{ marginBottom: 8 }}>
                🟢 Liberar ao Residente
              </button>
            )}
          </>
        )}

        {/* Apagar (sempre disponível para avaliador) */}
        <button
          onClick={apagar}
          disabled={saving}
          style={{ width: '100%', padding: 14, borderRadius: 12, fontSize: '1rem', fontWeight: 700,
            cursor: 'pointer', marginBottom: 8, border: '1.5px solid var(--danger)',
            background: 'transparent', color: 'var(--danger)' }}>
          🗑️ Apagar feedback
        </button>

        {transcricao && (
          <>
            <button
              className="btn btn-outline"
              onClick={() => setShowTranscricao(v => !v)}
              style={{ marginBottom: 8 }}
            >
              🎙️ {showTranscricao ? 'Ocultar transcrição' : 'Ver transcrição completa'}
            </button>
            {showTranscricao && (
              <div className="field-group">
                <div className="value-box" style={{ whiteSpace: 'pre-wrap', fontSize: '0.88rem', color: 'var(--subtle)' }}>
                  {transcricao}
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

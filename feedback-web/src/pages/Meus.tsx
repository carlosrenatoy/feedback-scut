import { useState, useEffect } from 'react';
import { fetchFeedbacksRemoto } from '../sync';

type Fb = {
  id: string;
  ia_pessoa_sugerida: string | null;
  perfil_no_momento: string | null;
  passagem: string | null;
  local_inferido: string | null;
  tipo_feedback_inferido: string | null;
  tema_especifico_inferido: string | null;
  data_evento: string;
  campos_revisados: string | null;
  campos_ia: any;
  relatorio: string | null;
  transcricao: string | null;
};

export default function Meus() {
  const [feedbacks, setFeedbacks] = useState<Fb[]>([]);

  useEffect(() => {
    fetchFeedbacksRemoto().then(all => {
      const liberados = all.filter((f: any) => f.status === 'liberado_ao_residente');
      setFeedbacks(liberados);
    });
  }, []);

  function parseCampos(fb: Fb) {
    const dados = fb.campos_revisados
      ? (typeof fb.campos_revisados === 'string' ? JSON.parse(fb.campos_revisados) : fb.campos_revisados)
      : (fb.campos_ia ? (typeof fb.campos_ia === 'string' ? JSON.parse(fb.campos_ia) : fb.campos_ia) : {});

    const fortes = Array.isArray(dados.pontos_fortes) ? dados.pontos_fortes : (dados.pontos_fortes ? [dados.pontos_fortes] : []);
    const diffs = Array.isArray(dados.dificuldades) ? dados.dificuldades : (dados.dificuldades ? [dados.dificuldades] : []);
    const plano = Array.isArray(dados.plano_de_acao) ? dados.plano_de_acao : (dados.plano_de_acao ? [dados.plano_de_acao] : []);

    return {
      fortes,
      diffs,
      plano,
      autonomia: dados.autonomia || dados.autonomia_sugerida || '',
      nota: dados.nota || dados.nota_sugerida || '',
      observacoes: dados.observacoes || '',
    };
  }

  return (
    <div>
      <div className="topbar">
        <h1>🩺 Meus Feedbacks</h1>
        <span className="topbar-badge" style={{ background: 'var(--success)' }}>Residente</span>
      </div>
      <div className="screen">
        <p style={{ textAlign: 'center', color: 'var(--subtle)', fontSize: '0.85rem', marginBottom: 16 }}>
          Apenas feedbacks liberados pelo avaliador · {feedbacks.length} feedback{feedbacks.length !== 1 ? 's' : ''}
        </p>

        {feedbacks.map(fb => {
          const { fortes, diffs, plano, autonomia, nota, observacoes } = parseCampos(fb);
          const relatorio = fb.relatorio || fb.transcricao || '';
          return (
            <div key={fb.id} className="fb-card">
              <div className="fb-card-header">
                <h3>Feedback · {new Date(fb.data_evento).toLocaleDateString('pt-BR')}</h3>
                <small>
                  📍 {fb.local_inferido || '—'} · {fb.passagem || '—'}
                </small>
              </div>
              <div className="fb-card-body">
                {/* Dados contextuais */}
                <div className="ver-mini-header">
                  <div className="ver-mini-row">
                    <span>Perfil:</span> <strong>{fb.perfil_no_momento || '—'}</strong>
                  </div>
                  <div className="ver-mini-row">
                    <span>Tipo:</span> <strong>{fb.tipo_feedback_inferido || '—'}</strong>
                  </div>
                  {fb.tema_especifico_inferido && (
                    <div className="ver-mini-row">
                      <span>Tema:</span> <strong>{fb.tema_especifico_inferido}</strong>
                    </div>
                  )}
                  {autonomia && (
                    <div className="ver-mini-row">
                      <span>Autonomia:</span> <strong>{autonomia}</strong>
                    </div>
                  )}
                  {nota && (
                    <div className="ver-mini-row">
                      <span>Nota:</span> <strong>{nota}/5</strong>
                    </div>
                  )}
                </div>

                {/* Relatório completo (padrão Feedback de Residente) */}
                {relatorio ? (
                  <div className="fb-section">
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem', lineHeight: 1.6 }}>{relatorio}</div>
                  </div>
                ) : (<>
                {fortes.length > 0 && (
                  <div className="fb-section">
                    <h4>✅ Pontos Fortes</h4>
                    <ul className="ver-list">
                      {fortes.map((f: string, i: number) => <li key={i}>{f.replace(/^[•\-]\s*/, '')}</li>)}
                    </ul>
                  </div>
                )}
                {diffs.length > 0 && (
                  <div className="fb-section">
                    <h4>⚠️ Pontos a Desenvolver</h4>
                    <ul className="ver-list">
                      {diffs.map((d: string, i: number) => <li key={i}>{d.replace(/^[•\-]\s*/, '')}</li>)}
                    </ul>
                  </div>
                )}
                {plano.length > 0 && (
                  <div className="fb-section">
                    <h4>📋 Plano de Ação</h4>
                    <ul className="ver-list">
                      {plano.map((p: string, i: number) => <li key={i}>{p.replace(/^[•\-]\s*/, '')}</li>)}
                    </ul>
                  </div>
                )}
                </>)}
                {observacoes && !relatorio && (
                  <div className="fb-section">
                    <h4>💬 Observações do Avaliador</h4>
                    <p style={{ fontSize: '0.92rem', lineHeight: 1.6 }}>{observacoes}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {feedbacks.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🩺</div>
            <h2>Nenhum feedback liberado</h2>
            <p>Quando o avaliador liberar um feedback, ele aparecerá aqui com todos os detalhes da avaliação.</p>
          </div>
        )}
      </div>
    </div>
  );
}

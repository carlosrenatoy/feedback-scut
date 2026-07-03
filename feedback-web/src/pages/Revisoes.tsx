import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFeedbacksRemoto } from '../sync';

type FbPendente = {
  id: string;
  ia_pessoa_sugerida: string | null;
  perfil_no_momento: string | null;
  passagem: string | null;
  local_inferido: string | null;
  tipo_feedback_inferido: string | null;
  tema_especifico_inferido: string | null;
  data_evento: string;
  campos_ia: any;
};

export default function Revisoes() {
  const navigate = useNavigate();
  const [feedbacks, setFeedbacks] = useState<FbPendente[]>([]);

  useEffect(() => {
    fetchFeedbacksRemoto().then(all => {
      const pendentes = all.filter((f: any) => f.status === 'pronto_para_revisao');
      setFeedbacks(pendentes);
    });
  }, []);

  return (
    <div>
      <div className="topbar">
        <h1>📋 Revisões</h1>
        <span className="topbar-badge" style={{ background: feedbacks.length > 0 ? 'var(--warning)' : 'var(--success)' }}>
          {feedbacks.length}
        </span>
      </div>
      <div className="screen">
        <div className="revisoes-intro">
          <p className="revisoes-subtitle">
            Feedbacks processados pela IA aguardando sua revisão.
          </p>
          <p className="revisoes-hint">
            Revise, edite e libere para cada residente.
          </p>
        </div>

        {feedbacks.map(fb => {
          const ia = fb.campos_ia
            ? (typeof fb.campos_ia === 'string' ? JSON.parse(fb.campos_ia) : fb.campos_ia)
            : {};
          const autonomia = ia.autonomia_sugerida || '';
          const incertos = ia.campos_incertos || [];

          return (
            <div key={fb.id} className="revisao-card" onClick={() => navigate(`/revisar/${fb.id}`)}>
              <div className="revisao-card-top">
                <div className="revisao-card-pessoa">
                  {fb.ia_pessoa_sugerida || 'Nome não identificado'}
                  {autonomia && <span className="revisao-autonomia">{autonomia}</span>}
                </div>
                <span className="badge-status pendente">⏳ Pendente</span>
              </div>

              <div className="revisao-card-meta">
                {fb.perfil_no_momento || '—'}
                {fb.passagem ? ` · ${fb.passagem}` : ''}
                {fb.local_inferido ? ` · ${fb.local_inferido}` : ''}
              </div>
              <div className="revisao-card-meta">
                {fb.tipo_feedback_inferido || '—'}
                {fb.tema_especifico_inferido ? ` · ${fb.tema_especifico_inferido}` : ''}
                {' · '}{new Date(fb.data_evento).toLocaleDateString('pt-BR')}
              </div>

              {incertos.length > 0 && (
                <div className="revisao-card-alert">
                  ⚠️ {incertos.length} campo{incertos.length !== 1 ? 's' : ''} incerto{incertos.length !== 1 ? 's' : ''}
                </div>
              )}

              <div className="revisao-card-action">
                Revisar e editar →
              </div>
            </div>
          );
        })}

        {feedbacks.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <h2>Tudo revisado!</h2>
            <p>Não há feedbacks pendentes de revisão no momento. Grave um novo feedback para começar.</p>
          </div>
        )}
      </div>
    </div>
  );
}

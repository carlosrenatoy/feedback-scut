import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchFeedbacksRemoto } from '../sync';

const COLORS_DOTS = ['var(--primary)', 'var(--success)', 'var(--warning)', '#667eea', '#f093fb'];

const STATUS_LABEL: Record<string, string> = {
  pronto_para_revisao: 'Pendente revisão',
  revisado: 'Revisado',
  liberado_ao_residente: 'Liberado',
};

type Fb = {
  id: string;
  status: string;
  perfil_no_momento: string | null;
  passagem: string | null;
  local_inferido: string | null;
  tipo_feedback_inferido: string | null;
  tema_especifico_inferido: string | null;
  data_evento: string;
  campos_ia: any;
  campos_revisados: string | null;
};

export default function Perfil() {
  const { nome } = useParams<{ nome: string }>();
  const navigate = useNavigate();
  const [feedbacks, setFeedbacks] = useState<Fb[]>([]);
  const decoded = decodeURIComponent(nome || '');
  const initials = decoded.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    fetchFeedbacksRemoto().then(all => {
      const fbs = all.filter((f: any) => f.ia_pessoa_sugerida === decoded);
      setFeedbacks(fbs);
    });
  }, [decoded]);

  const perfilRecente = feedbacks[0]?.perfil_no_momento || '—';
  const total = feedbacks.length;
  const pendentes = feedbacks.filter(f => f.status === 'pronto_para_revisao').length;
  const revisados = feedbacks.filter(f => f.status === 'revisado').length;
  const liberados = feedbacks.filter(f => f.status === 'liberado_ao_residente').length;

  // Análise de competências
  const todasFortes: string[] = [];
  const todasDiffs: string[] = [];
  const locais = new Set<string>();
  const tipos = new Set<string>();
  const temas = new Set<string>();

  feedbacks.forEach(fb => {
    if (fb.local_inferido) locais.add(fb.local_inferido);
    if (fb.tipo_feedback_inferido) tipos.add(fb.tipo_feedback_inferido);
    if (fb.tema_especifico_inferido) temas.add(fb.tema_especifico_inferido);

    const dados = fb.campos_revisados
      ? (typeof fb.campos_revisados === 'string' ? JSON.parse(fb.campos_revisados) : fb.campos_revisados)
      : (fb.campos_ia ? (typeof fb.campos_ia === 'string' ? JSON.parse(fb.campos_ia) : fb.campos_ia) : {});

    const fortes = Array.isArray(dados.pontos_fortes) ? dados.pontos_fortes : (dados.pontos_fortes ? [dados.pontos_fortes] : []);
    const diffs = Array.isArray(dados.dificuldades) ? dados.dificuldades : (dados.dificuldades ? [dados.dificuldades] : []);
    fortes.forEach((f: string) => todasFortes.push(f.replace(/^[•\-]\s*/, '')));
    diffs.forEach((d: string) => todasDiffs.push(d.replace(/^[•\-]\s*/, '')));
  });

  function openFb(fb: Fb) {
    if (fb.status === 'pronto_para_revisao') navigate(`/revisar/${fb.id}`);
    else navigate(`/ver/${fb.id}`);
  }

  return (
    <div>
      <div className="topbar">
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', marginRight: 8 }}>←</button>
        <h1>Perfil</h1>
      </div>
      <div className="screen">
        <div className="profile-header">
          <div className="avatar">{initials}</div>
          <h2>{decoded}</h2>
          <div className="role-tag">Atualmente: {perfilRecente}</div>
        </div>

        {/* Estatísticas */}
        <div className="stats-row">
          <div className="stat-box">
            <div className="stat-num">{total}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{ color: pendentes > 0 ? 'var(--warning)' : 'var(--subtle)' }}>{pendentes}</div>
            <div className="stat-label">Pendentes</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{ color: 'var(--success)' }}>{liberados}</div>
            <div className="stat-label">Liberados</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{ color: 'var(--subtle)' }}>{revisados}</div>
            <div className="stat-label">Revisados</div>
          </div>
        </div>

        {/* Resumo de competências */}
        {(todasFortes.length > 0 || todasDiffs.length > 0) && (
          <>
            <div className="section-title">Resumo de Competências</div>
            <div className="fb-card" style={{ borderLeft: '4px solid var(--success)' }}>
              <div className="fb-card-body">
                {todasFortes.length > 0 && (
                  <div className="fb-section">
                    <h4>✅ Pontos Fortes Recorrentes</h4>
                    <ul className="ver-list">
                      {todasFortes.slice(0, 5).map((f, i) => <li key={i}>{f}</li>)}
                      {todasFortes.length > 5 && <li style={{ color: 'var(--subtle)' }}>+{todasFortes.length - 5} mais…</li>}
                    </ul>
                  </div>
                )}
                {todasDiffs.length > 0 && (
                  <div className="fb-section">
                    <h4>⚠️ Pontos a Desenvolver</h4>
                    <ul className="ver-list">
                      {todasDiffs.slice(0, 5).map((d, i) => <li key={i}>{d}</li>)}
                      {todasDiffs.length > 5 && <li style={{ color: 'var(--subtle)' }}>+{todasDiffs.length - 5} mais…</li>}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Contextos */}
        {(locais.size > 0 || tipos.size > 0 || temas.size > 0) && (
          <>
            <div className="section-title">Contextos Avaliados</div>
            <div className="fb-card">
              <div className="fb-card-body">
                {locais.size > 0 && (
                  <div className="fb-section">
                    <h4>📍 Cenários</h4>
                    <div className="chips">{Array.from(locais).map(l => <span key={l} className="chip chip-blue">{l}</span>)}</div>
                  </div>
                )}
                {tipos.size > 0 && (
                  <div className="fb-section">
                    <h4>📋 Tipos de Feedback</h4>
                    <div className="chips">{Array.from(tipos).map(t => <span key={t} className="chip chip-purple">{t}</span>)}</div>
                  </div>
                )}
                {temas.size > 0 && (
                  <div className="fb-section">
                    <h4>🏷️ Temas Específicos</h4>
                    <div className="chips">{Array.from(temas).map(t => <span key={t} className="chip chip-orange">{t}</span>)}</div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Linha do Tempo */}
        <div className="section-title">Linha do Tempo</div>

        {feedbacks.map((fb, i) => {
          const dados = fb.campos_revisados
            ? (typeof fb.campos_revisados === 'string' ? JSON.parse(fb.campos_revisados) : fb.campos_revisados)
            : (fb.campos_ia ? (typeof fb.campos_ia === 'string' ? JSON.parse(fb.campos_ia) : fb.campos_ia) : {});
          const fortes = Array.isArray(dados.pontos_fortes) ? dados.pontos_fortes : [];
          const diffs = Array.isArray(dados.dificuldades) ? dados.dificuldades : [];

          return (
            <div key={fb.id} className="timeline-item">
              <div className="timeline-left">
                <div className="timeline-dot" style={{ background: COLORS_DOTS[i % COLORS_DOTS.length] }} />
                {i < feedbacks.length - 1 && <div className="timeline-line" />}
              </div>
              <div className="card" style={{ flex: 1, marginBottom: 0, cursor: 'pointer' }}
                onClick={() => openFb(fb)}>
                <div className="meta">
                  {new Date(fb.data_evento).toLocaleDateString('pt-BR')} · {fb.perfil_no_momento || '—'} · {fb.passagem || '—'}
                </div>
                <h3>
                  {fb.local_inferido || '—'} · {fb.tipo_feedback_inferido || '—'}
                </h3>
                {fb.tema_especifico_inferido && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--subtle)', marginBottom: 6 }}>
                    🏷️ {fb.tema_especifico_inferido}
                  </div>
                )}
                <div style={{ marginBottom: 6 }}>
                  <span className={`badge-status ${fb.status === 'pronto_para_revisao' ? 'pendente' : fb.status === 'liberado_ao_residente' ? 'liberado' : 'revisado'}`}>
                    {STATUS_LABEL[fb.status] || fb.status}
                  </span>
                </div>
                {(fortes.length > 0 || diffs.length > 0) && (
                  <div className="chips">
                    {fortes.slice(0, 2).map((f: string, j: number) => (
                      <span key={`f${j}`} className="chip chip-green">✓ {f.replace(/^[•\-]\s*/, '')}</span>
                    ))}
                    {diffs.slice(0, 2).map((d: string, j: number) => (
                      <span key={`d${j}`} className="chip chip-red">✗ {d.replace(/^[•\-]\s*/, '')}</span>
                    ))}
                  </div>
                )}
                <div className="ac-action">Ver detalhes →</div>
              </div>
            </div>
          );
        })}

        {feedbacks.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h2>Sem feedbacks</h2>
            <p>Nenhum feedback encontrado para este residente.</p>
          </div>
        )}
      </div>
    </div>
  );
}

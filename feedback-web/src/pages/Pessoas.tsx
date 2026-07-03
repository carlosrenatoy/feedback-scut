import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFeedbacksRemoto } from '../sync';

const COLORS = ['#667eea','#f093fb','#4facfe','#43e97b','#fa709a','#30cfd0','#a18cd1','#fda085','#f6d365','#84fab0'];

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'r1', label: 'R1 / L1' },
  { key: 'r2', label: 'R2 / L2' },
  { key: 'r3', label: 'R3 / L3' },
  { key: 'revisao', label: 'Pendentes revisão' },
  { key: 'retaguarda', label: 'Retaguarda' },
  { key: 'emergencia', label: 'Emergência' },
];

type Pessoa = {
  nome: string;
  perfil: string;
  total: number;
  pendentes: number;
  revisados: number;
  liberados: number;
  locais: string[];
  tipos: string[];
  ultimaData: string;
  initials: string;
  color: string;
};

export default function Pessoas() {
  const navigate = useNavigate();
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');

  useEffect(() => {
    fetchFeedbacksRemoto().then(fbs => {
      const map: Record<string, {
        perfil: string; total: number; pendentes: number; revisados: number; liberados: number;
        locais: Set<string>; tipos: Set<string>; ultimaData: string;
      }> = {};
      fbs.forEach((fb: any) => {
        const nome = fb.ia_pessoa_sugerida || 'Sem nome';
        if (!map[nome]) map[nome] = {
          perfil: fb.perfil_no_momento || '—', total: 0, pendentes: 0, revisados: 0, liberados: 0,
          locais: new Set(), tipos: new Set(), ultimaData: fb.data_evento,
        };
        map[nome].total++;
        if (fb.status === 'pronto_para_revisao') map[nome].pendentes++;
        if (fb.status === 'revisado') map[nome].revisados++;
        if (fb.status === 'liberado_ao_residente') map[nome].liberados++;
        if (fb.perfil_no_momento) map[nome].perfil = fb.perfil_no_momento;
        if (fb.local_inferido) map[nome].locais.add(fb.local_inferido);
        if (fb.tipo_feedback_inferido) map[nome].tipos.add(fb.tipo_feedback_inferido);
        if (fb.data_evento > map[nome].ultimaData) map[nome].ultimaData = fb.data_evento;
      });

      const list = Object.entries(map).map(([nome, info], i) => ({
        nome,
        perfil: info.perfil,
        total: info.total,
        pendentes: info.pendentes,
        revisados: info.revisados,
        liberados: info.liberados,
        locais: Array.from(info.locais),
        tipos: Array.from(info.tipos),
        ultimaData: info.ultimaData,
        initials: nome.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
        color: COLORS[i % COLORS.length],
      }));

      setPessoas(list.sort((a, b) => a.nome.localeCompare(b.nome)));
    });
  }, []);

  const filtered = pessoas.filter(p => {
    if (search && !p.nome.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'todos') return true;
    if (filter === 'revisao') return p.pendentes > 0;
    if (filter === 'r1') return p.perfil.includes('R1');
    if (filter === 'r2') return p.perfil.includes('R2');
    if (filter === 'r3') return p.perfil.includes('R3');
    if (filter === 'retaguarda') return p.locais.some(l => l.toLowerCase().includes('retaguarda'));
    if (filter === 'emergencia') return p.locais.some(l => l.toLowerCase().includes('emergência') || l.toLowerCase().includes('sala de emergência'));
    return true;
  });

  const totalGeral = pessoas.reduce((s, p) => s + p.total, 0);
  const pendentesGeral = pessoas.reduce((s, p) => s + p.pendentes, 0);

  return (
    <div>
      <div className="topbar">
        <h1>👥 Pessoas Avaliadas</h1>
        <span className="topbar-badge">{pessoas.length} pessoas</span>
      </div>
      <div className="screen">
        <div className="stats-row">
          <div className="stat-box">
            <div className="stat-num">{totalGeral}</div>
            <div className="stat-label">Feedbacks</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{ color: 'var(--primary)' }}>{pessoas.length}</div>
            <div className="stat-label">Pessoas</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{ color: pendentesGeral > 0 ? 'var(--warning)' : 'var(--success)' }}>{pendentesGeral}</div>
            <div className="stat-label">Pendentes</div>
          </div>
        </div>

        <div className="search-bar">
          <span>🔍</span>
          <input
            type="text"
            placeholder="Buscar residente por nome…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-scroll">
          {FILTROS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`filter-chip ${filter === f.key ? 'on' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <p className="list-count">{filtered.length} pessoa{filtered.length !== 1 ? 's' : ''}</p>

        <div className="resident-grid">
        {filtered.map(p => (
          <div key={p.nome} className="resident-row" onClick={() => navigate(`/perfil/${encodeURIComponent(p.nome)}`)}>
            <div className="res-avatar" style={{ background: p.color }}>{p.initials}</div>
            <div className="res-info">
              <h3>{p.nome}</h3>
              <div className="res-meta">{p.perfil}</div>
              <div className="res-detail">
                {p.locais.length > 0 && <span>{p.locais.slice(0, 2).join(', ')}</span>}
                {p.tipos.length > 0 && <span> · {p.tipos.slice(0, 2).join(', ')}</span>}
              </div>
              <div className="res-detail">
                Último: {new Date(p.ultimaData).toLocaleDateString('pt-BR')}
              </div>
            </div>
            <div className="res-count">
              <div className="res-total">{p.total}</div>
              <div className="res-total-label">feedback{p.total !== 1 ? 's' : ''}</div>
              {p.pendentes > 0 && <div className="res-pending">{p.pendentes} pendente{p.pendentes !== 1 ? 's' : ''}</div>}
              {p.liberados > 0 && <div className="res-released">{p.liberados} liberado{p.liberados !== 1 ? 's' : ''}</div>}
            </div>
          </div>
        ))}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h2>Nenhuma pessoa</h2>
            <p>As pessoas avaliadas aparecerão aqui após a IA processar os feedbacks.</p>
          </div>
        )}
      </div>
    </div>
  );
}

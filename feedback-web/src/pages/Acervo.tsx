import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFeedbacksRemoto, fetchDomainValues } from '../sync';

const STATUS_LABEL: Record<string, string> = {
  aguardando_sincronizacao: 'Aguardando IA',
  processando_ia: 'Processando IA…',
  pronto_para_revisao: 'Pendente revisão',
  revisado: 'Revisado',
  liberado_ao_residente: 'Liberado',
};

const SITUACAO_OPTIONS = [
  { label: 'Todas', value: 'Todos' },
  { label: 'Pendente de revisão', value: 'pronto_para_revisao' },
  { label: 'Revisado', value: 'revisado' },
  { label: 'Liberado ao residente', value: 'liberado_ao_residente' },
];

const PASSAGEM_OPTIONS = [
  { label: 'Todas', value: 'Todos' },
  { label: '1ª passagem', value: '1ª passagem' },
  { label: '2ª passagem', value: '2ª passagem' },
];

type FbRemoto = {
  id: string;
  status: string;
  ia_pessoa_sugerida: string | null;
  perfil_no_momento: string | null;
  local_inferido: string | null;
  tipo_feedback_inferido: string | null;
  tema_especifico_inferido: string | null;
  passagem: string | null;
  data_evento: string;
  campos_revisados: string | null;
  campos_ia: any;
  relatorio: string | null;
};

type Mode = 'pessoa' | 'periodo' | 'tipo';

type Filters = {
  ano: string;
  perfil: string;
  tipo: string;
  situacao: string;
  local: string;
  tema: string;
  passagem: string;
};

const EMPTY_FILTERS: Filters = {
  ano: 'Todos', perfil: 'Todos', tipo: 'Todos',
  situacao: 'Todos', local: 'Todos', tema: 'Todos', passagem: 'Todos',
};

export default function Acervo() {
  const navigate = useNavigate();
  const [feedbacks, setFeedbacks] = useState<FbRemoto[]>([]);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<Mode>('pessoa');
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });
  const [sheetOpen, setSheetOpen] = useState<string | null>(null);
  const [dv, setDv] = useState<{ perfis: string[]; locais: string[]; tipos: string[]; temas: string[] }>({
    perfis: [], locais: [], tipos: [], temas: [],
  });

  useEffect(() => {
    fetchFeedbacksRemoto().then(setFeedbacks);
    fetchDomainValues().then(setDv);
  }, []);

  const anos = Array.from(new Set(feedbacks.map(fb => new Date(fb.data_evento).getFullYear().toString()))).sort().reverse();

  const filtered = feedbacks.filter(fb => {
    if (filters.ano !== 'Todos' && !fb.data_evento.startsWith(filters.ano)) return false;
    if (filters.perfil !== 'Todos' && !(fb.perfil_no_momento || '').includes(filters.perfil)) return false;
    if (filters.tipo !== 'Todos' && fb.tipo_feedback_inferido !== filters.tipo) return false;
    if (filters.situacao !== 'Todos' && fb.status !== filters.situacao) return false;
    if (filters.local !== 'Todos' && fb.local_inferido !== filters.local) return false;
    if (filters.tema !== 'Todos' && fb.tema_especifico_inferido !== filters.tema) return false;
    if (filters.passagem !== 'Todos' && fb.passagem !== filters.passagem) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (fb.ia_pessoa_sugerida || '').toLowerCase().includes(q) ||
      (fb.local_inferido || '').toLowerCase().includes(q) ||
      (fb.tipo_feedback_inferido || '').toLowerCase().includes(q) ||
      (fb.tema_especifico_inferido || '').toLowerCase().includes(q) ||
      (fb.relatorio || '').toLowerCase().includes(q)
    );
  });

  const activeFilterCount = Object.values(filters).filter(v => v !== 'Todos').length;

  function openFb(fb: FbRemoto) {
    navigate(`/revisar/${fb.id}`);
  }

  function setFilter(key: keyof Filters, val: string) {
    setFilters(prev => ({ ...prev, [key]: val }));
  }

  function pillDisplay(key: keyof Filters): string {
    const val = filters[key];
    if (val === 'Todos') return key === 'situacao' ? 'Todas' : 'Todos';
    if (key === 'situacao') return SITUACAO_OPTIONS.find(o => o.value === val)?.label || val;
    return val;
  }

  function badgeClass(status: string) {
    if (status === 'pronto_para_revisao') return 'pendente';
    if (status === 'liberado_ao_residente') return 'liberado';
    if (status === 'revisado') return 'revisado';
    return 'pendente';
  }

  function renderCard(fb: FbRemoto) {
    return (
      <div key={fb.id} className="ac-card" onClick={() => openFb(fb)}>
        <div className="ac-card-name">{fb.ia_pessoa_sugerida || 'Sem nome'}</div>
        <div className="ac-card-line1">
          {fb.perfil_no_momento || '—'}
          {fb.passagem ? ` · ${fb.passagem}` : ''}
          {fb.local_inferido ? ` · ${fb.local_inferido}` : ''}
        </div>
        <div className="ac-card-line2">
          {fb.tipo_feedback_inferido || '—'}
          {fb.tema_especifico_inferido ? ` · ${fb.tema_especifico_inferido}` : ''}
          {' · '}{new Date(fb.data_evento).toLocaleDateString('pt-BR')}
        </div>
        <span className={`badge-status ac-badge ${badgeClass(fb.status)}`}>
          {STATUS_LABEL[fb.status] || fb.status}
        </span>
        {fb.status === 'pronto_para_revisao' && (
          <div className="ac-action-link">📝 Revisar e editar →</div>
        )}
        {(fb.status === 'revisado' || fb.status === 'liberado_ao_residente') && (
          <div className="ac-action-link" style={{ color: 'var(--subtle)' }}>Ver detalhes →</div>
        )}
      </div>
    );
  }

  function groupBy(key: (fb: FbRemoto) => string) {
    const groups: Record<string, FbRemoto[]> = {};
    filtered.forEach(fb => {
      const k = key(fb) || 'Não classificado';
      if (!groups[k]) groups[k] = [];
      groups[k].push(fb);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }

  // Sheet content builder
  function renderSheetContent() {
    if (sheetOpen === 'refinar') {
      return (
        <>
          <div className="sheet-field">
            <label>Local assistencial</label>
            <div className="sheet-options">
              <span className={`sheet-opt ${filters.local === 'Todos' ? 'on' : ''}`}
                onClick={() => setFilter('local', 'Todos')}>Todos</span>
              {dv.locais.map(l => (
                <span key={l} className={`sheet-opt ${filters.local === l ? 'on' : ''}`}
                  onClick={() => setFilter('local', l)}>{l}</span>
              ))}
            </div>
          </div>
          <div className="sheet-field">
            <label>Tema específico</label>
            <div className="sheet-options">
              <span className={`sheet-opt ${filters.tema === 'Todos' ? 'on' : ''}`}
                onClick={() => setFilter('tema', 'Todos')}>Todos</span>
              {dv.temas.map(t => (
                <span key={t} className={`sheet-opt ${filters.tema === t ? 'on' : ''}`}
                  onClick={() => setFilter('tema', t)}>{t}</span>
              ))}
            </div>
          </div>
          <div className="sheet-field">
            <label>Passagem</label>
            <div className="sheet-options">
              {PASSAGEM_OPTIONS.map(o => (
                <span key={o.value} className={`sheet-opt ${filters.passagem === o.value ? 'on' : ''}`}
                  onClick={() => setFilter('passagem', o.value)}>{o.label}</span>
              ))}
            </div>
          </div>
        </>
      );
    }

    if (sheetOpen === 'ano') {
      return (
        <div className="sheet-options">
          <span className={`sheet-opt ${filters.ano === 'Todos' ? 'on' : ''}`}
            onClick={() => setFilter('ano', 'Todos')}>Todos</span>
          {anos.map(a => (
            <span key={a} className={`sheet-opt ${filters.ano === a ? 'on' : ''}`}
              onClick={() => setFilter('ano', a)}>{a}</span>
          ))}
        </div>
      );
    }

    if (sheetOpen === 'perfil') {
      return (
        <div className="sheet-options">
          <span className={`sheet-opt ${filters.perfil === 'Todos' ? 'on' : ''}`}
            onClick={() => setFilter('perfil', 'Todos')}>Todos</span>
          {dv.perfis.map(p => (
            <span key={p} className={`sheet-opt ${filters.perfil === p ? 'on' : ''}`}
              onClick={() => setFilter('perfil', p)}>{p}</span>
          ))}
        </div>
      );
    }

    if (sheetOpen === 'tipo') {
      return (
        <div className="sheet-options">
          <span className={`sheet-opt ${filters.tipo === 'Todos' ? 'on' : ''}`}
            onClick={() => setFilter('tipo', 'Todos')}>Todos</span>
          {dv.tipos.map(t => (
            <span key={t} className={`sheet-opt ${filters.tipo === t ? 'on' : ''}`}
              onClick={() => setFilter('tipo', t)}>{t}</span>
          ))}
        </div>
      );
    }

    if (sheetOpen === 'situacao') {
      return (
        <div className="sheet-options">
          {SITUACAO_OPTIONS.map(o => (
            <span key={o.value} className={`sheet-opt ${filters.situacao === o.value ? 'on' : ''}`}
              onClick={() => setFilter('situacao', o.value)}>{o.label}</span>
          ))}
        </div>
      );
    }

    return null;
  }

  const sheetTitles: Record<string, string> = {
    ano: 'Ano',
    perfil: 'Perfil avaliado',
    tipo: 'Tipo de feedback',
    situacao: 'Situação do feedback',
    refinar: 'Refinar filtros',
  };

  const MODES: { key: Mode; label: string }[] = [
    { key: 'pessoa', label: 'Por pessoa' },
    { key: 'periodo', label: 'Por período' },
    { key: 'tipo', label: 'Por tipo' },
  ];

  return (
    <div>
      <div className="topbar">
        <h1>📁 Acervo</h1>
        <span className="topbar-badge">{filtered.length}</span>
      </div>
      <div className="screen">
        <div className="acervo-subtitle">
          Busque por pessoa, período ou tipo de feedback
        </div>

        {/* Busca */}
        <div className="search-bar">
          <span>🔍</span>
          <input
            type="text"
            placeholder="Nome, tema, local, tipo…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* 3 modos de navegação */}
        <div className="mode-switch">
          {MODES.map(m => (
            <button key={m.key} className={`mode-btn ${mode === m.key ? 'on' : ''}`}
              onClick={() => setMode(m.key)}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Filtros principais — sempre visíveis, 2x2 grid */}
        <div className="filter-grid">
          <div className={`filter-pill ${filters.ano !== 'Todos' ? 'active' : ''}`}
            onClick={() => setSheetOpen('ano')}>
            <div className="filter-pill-inner">
              <span className="filter-pill-label">Ano</span>
              <span className="filter-pill-value">{pillDisplay('ano')}</span>
            </div>
            <span className="filter-pill-arrow">›</span>
          </div>
          <div className={`filter-pill ${filters.perfil !== 'Todos' ? 'active' : ''}`}
            onClick={() => setSheetOpen('perfil')}>
            <div className="filter-pill-inner">
              <span className="filter-pill-label">Perfil avaliado</span>
              <span className="filter-pill-value">{pillDisplay('perfil')}</span>
            </div>
            <span className="filter-pill-arrow">›</span>
          </div>
          <div className={`filter-pill ${filters.tipo !== 'Todos' ? 'active' : ''}`}
            onClick={() => setSheetOpen('tipo')}>
            <div className="filter-pill-inner">
              <span className="filter-pill-label">Tipo de feedback</span>
              <span className="filter-pill-value">{pillDisplay('tipo')}</span>
            </div>
            <span className="filter-pill-arrow">›</span>
          </div>
          <div className={`filter-pill ${filters.situacao !== 'Todos' ? 'active' : ''}`}
            onClick={() => setSheetOpen('situacao')}>
            <div className="filter-pill-inner">
              <span className="filter-pill-label">Situação</span>
              <span className="filter-pill-value">{pillDisplay('situacao')}</span>
            </div>
            <span className="filter-pill-arrow">›</span>
          </div>
        </div>

        {/* Refinar filtros */}
        <button className="refine-btn" onClick={() => setSheetOpen('refinar')}>
          ⊕ Refinar filtros (local, tema, passagem…)
          {activeFilterCount > 4 && (
            <span className="refine-count">{activeFilterCount - 4}</span>
          )}
        </button>

        {/* Contagem */}
        <div className="acervo-result-count">
          {filtered.length} feedback{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
        </div>

        {/* Limpar filtros quando ativos */}
        {activeFilterCount > 0 && (
          <button className="clear-filters" onClick={() => setFilters({ ...EMPTY_FILTERS })}>
            ✕ Limpar filtros
          </button>
        )}

        {/* === RESULTADOS POR MODO === */}

        {/* Por pessoa */}
        {mode === 'pessoa' && groupBy(fb => fb.ia_pessoa_sugerida || 'Sem nome').map(([nome, fbs]) => (
          <div key={nome} className="ac-group">
            <div className="ac-group-header">
              <span className="ac-group-name">{nome}</span>
              <span className="ac-group-count">{fbs.length} feedback{fbs.length !== 1 ? 's' : ''}</span>
            </div>
            {fbs.map(renderCard)}
          </div>
        ))}

        {/* Por período */}
        {mode === 'periodo' && (() => {
          const byMonth: Record<string, FbRemoto[]> = {};
          const sorted = [...filtered].sort((a, b) => b.data_evento.localeCompare(a.data_evento));
          sorted.forEach(fb => {
            const d = new Date(fb.data_evento);
            const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            if (!byMonth[label]) byMonth[label] = [];
            byMonth[label].push(fb);
          });
          return Object.entries(byMonth).map(([mes, fbs]) => (
            <div key={mes} className="ac-group">
              <div className="ac-group-header">
                <span className="ac-group-name" style={{ textTransform: 'capitalize' }}>{mes}</span>
                <span className="ac-group-count">{fbs.length}</span>
              </div>
              {fbs.map(renderCard)}
            </div>
          ));
        })()}

        {/* Por tipo */}
        {mode === 'tipo' && groupBy(fb => fb.tipo_feedback_inferido || 'Sem tipo').map(([tipo, fbs]) => (
          <div key={tipo} className="ac-group">
            <div className="ac-group-header">
              <span className="ac-group-name">{tipo}</span>
              <span className="ac-group-count">{fbs.length}</span>
            </div>
            {fbs.map(renderCard)}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📁</div>
            <h2>Nenhum feedback encontrado</h2>
            <p>
              {activeFilterCount > 0
                ? 'Tente ajustar os filtros ou limpar a busca.'
                : 'Os feedbacks aparecerão aqui depois de serem processados pela IA.'}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Sheet Overlay */}
      {sheetOpen && (
        <div className="sheet-overlay" onClick={() => setSheetOpen(null)} />
      )}

      {/* Bottom Sheet */}
      {sheetOpen && (
        <div className="sheet">
          <div className="sheet-handle" />
          <h3>{sheetTitles[sheetOpen] || 'Filtrar'}</h3>
          {renderSheetContent()}
          <button className="sheet-apply" onClick={() => setSheetOpen(null)}>Aplicar</button>
        </div>
      )}
    </div>
  );
}

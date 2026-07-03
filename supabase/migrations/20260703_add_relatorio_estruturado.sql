-- Adiciona coluna para o relatório estruturado (JSON com seções do padrão docx)
-- e índice de busca full-text em português sobre o relatório renderizado.
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS relatorio_estruturado jsonb;
CREATE INDEX IF NOT EXISTS idx_feedbacks_relatorio_gin
  ON public.feedbacks USING gin (to_tsvector('portuguese', coalesce(relatorio, '')));

COMMENT ON COLUMN public.feedbacks.relatorio_estruturado IS
  'Relatório completo estruturado em JSON: cabecalho, auto_analise, discussao_caso, analise_avaliador, plano_acao, observacao_final.';
COMMENT ON COLUMN public.feedbacks.relatorio IS
  'Relatório completo renderizado no padrão FEEDBACK DE RESIDENTE (formato docx).';

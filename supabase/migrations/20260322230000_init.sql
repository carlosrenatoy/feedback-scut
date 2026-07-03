-- 1. UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de Vocabulário de Domínio
CREATE TABLE public.domain_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('perfil', 'local_assistencial', 'tipo_feedback', 'tema_especifico')),
    valor TEXT NOT NULL,
    sinonimos TEXT[] DEFAULT '{}',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela Longitudinal de Pessoas
CREATE TABLE public.pessoas_avaliadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_completo TEXT NOT NULL,
    identificador_institucional TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Feedbacks
CREATE TABLE public.feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avaliador_id UUID REFERENCES auth.users NOT NULL,
    data_evento TIMESTAMPTZ DEFAULT NOW(),
    
    -- Vínculo pós-IA
    pessoa_avaliada_id UUID REFERENCES public.pessoas_avaliadas NULL,
    ia_pessoa_sugerida TEXT,
    ia_pessoa_confianca FLOAT,
    ia_candidatos JSONB DEFAULT '[]',
    pessoa_vinculada_por UUID REFERENCES auth.users NULL,

    -- Estado no momento (não muda se a pessoa for promovida)
    perfil_no_momento TEXT,
    passagem TEXT,

    -- Contexto Inference
    local_inferido TEXT,
    tipo_feedback_inferido TEXT,
    tema_especifico_inferido TEXT,
    ia_confianca_contexto FLOAT,

    -- Áudio Links
    audio_remoto_url TEXT,
    duracao_segundos INTEGER,

    -- Meta JSON
    transcricao TEXT,
    campos_ia JSONB,
    campos_revisados JSONB,
    ia_versao TEXT,

    -- Status Lifecycle
    status TEXT NOT NULL DEFAULT 'aguardando_sincronizacao',
    liberado_ao_avaliado BOOLEAN DEFAULT false,
    liberado_em TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Indexes Otimizados
CREATE INDEX idx_feedbacks_perfil ON public.feedbacks (perfil_no_momento);
CREATE INDEX idx_feedbacks_local ON public.feedbacks (local_inferido);
CREATE INDEX idx_feedbacks_tipo ON public.feedbacks (tipo_feedback_inferido);
CREATE INDEX idx_feedbacks_tema ON public.feedbacks (tema_especifico_inferido);
CREATE INDEX idx_feedbacks_status ON public.feedbacks (status);
CREATE INDEX idx_feedbacks_pessoa ON public.feedbacks (pessoa_avaliada_id);

-- Configurando o Storage para Áudios (caso não exista)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('feedbacks_audio', 'feedbacks_audio', false)
ON CONFLICT (id) DO NOTHING;

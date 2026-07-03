-- Relaxar regras de banco e de storage apensa para podermos testar o MVP sem tela de Login
ALTER TABLE public.feedbacks DROP CONSTRAINT IF EXISTS feedbacks_avaliador_id_fkey;
ALTER TABLE public.feedbacks ALTER COLUMN avaliador_id DROP NOT NULL;

-- Habilita o upload anônimo de áudio
CREATE POLICY "Permitir upload publico no MVP" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'feedbacks_audio');
CREATE POLICY "Permitir leitura publica no MVP" ON storage.objects FOR SELECT USING (bucket_id = 'feedbacks_audio');

-- Desliga temporariamente a obrigação de Auth na tabela (Row Level Security)
ALTER TABLE public.feedbacks DISABLE ROW LEVEL SECURITY;
